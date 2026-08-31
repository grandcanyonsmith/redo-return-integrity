import type { RealtimeCallSession } from './api'

export type CallSpeaker = 'AGENT' | 'CUSTOMER' | 'SYSTEM'
export type CallState = 'connecting' | 'live' | 'ended' | 'error'
export type CallTranscriptEntry = { id: string; speaker: CallSpeaker; text: string }

export interface ActiveCall {
  setMuted(muted: boolean): void
  end(): void
}

export interface CallCallbacks {
  onState(state: CallState, detail?: string): void
  onTranscript(entry: CallTranscriptEntry): void
}

/** Starts the test-mode resolution call for a prepared session: a live OpenAI
 * Realtime WebSocket when the server minted a client secret, otherwise the
 * deterministic scripted playback. Returns controls for mute/end. */
export function startRealtimeCall(session: RealtimeCallSession, callbacks: CallCallbacks): ActiveCall {
  return session.mode === 'OPENAI_REALTIME'
    ? startLiveCall(session, callbacks)
    : startSimulatedCall(session, callbacks)
}

let transcriptSequence = 0
const entryId = () => `turn-${(transcriptSequence += 1)}`

function startSimulatedCall(
  session: Extract<RealtimeCallSession, { mode: 'SIMULATED' }>,
  callbacks: CallCallbacks,
): ActiveCall {
  const timers: number[] = []
  let endedState = false
  const finish = (state: CallState, detail?: string) => {
    if (endedState) return
    endedState = true
    for (const timer of timers) window.clearTimeout(timer)
    callbacks.onState(state, detail)
  }
  callbacks.onState('live', session.reason)
  let at = 600
  for (const turn of session.script) {
    timers.push(window.setTimeout(() => {
      callbacks.onTranscript({ id: entryId(), speaker: turn.speaker, text: turn.text })
    }, at))
    // Pace playback roughly like speech so the console reads as a call.
    at += Math.min(4_200, 900 + turn.text.length * 28)
  }
  timers.push(window.setTimeout(() => finish('ended'), at + 400))
  return {
    setMuted: () => {},
    end: () => finish('ended'),
  }
}

const REALTIME_WS_URL = 'wss://api.openai.com/v1/realtime'

function startLiveCall(
  session: Extract<RealtimeCallSession, { mode: 'OPENAI_REALTIME' }>,
  callbacks: CallCallbacks,
): ActiveCall {
  let socket: WebSocket | undefined
  let audioContext: AudioContext | undefined
  let mediaStream: MediaStream | undefined
  let processor: ScriptProcessorNode | undefined
  let source: MediaStreamAudioSourceNode | undefined
  let muted = false
  let finished = false
  let agentEntryId: string | null = null
  let agentText = ''
  let nextPlayTime = 0

  const cleanup = () => {
    processor?.disconnect()
    source?.disconnect()
    for (const track of mediaStream?.getTracks() ?? []) track.stop()
    void audioContext?.close().catch(() => undefined)
    if (socket && socket.readyState <= WebSocket.OPEN) socket.close()
  }
  const finish = (state: CallState, detail?: string) => {
    if (finished) return
    finished = true
    cleanup()
    callbacks.onState(state, detail)
  }

  const playAgentAudio = (base64: string) => {
    if (!audioContext) return
    const binary = window.atob(base64)
    const pcm = new Int16Array(new Uint8Array([...binary].map((char) => char.charCodeAt(0))).buffer)
    if (pcm.length === 0) return
    const floats = Float32Array.from(pcm, (sample) => sample / 32768)
    const buffer = audioContext.createBuffer(1, floats.length, 24_000)
    buffer.copyToChannel(floats, 0)
    const node = audioContext.createBufferSource()
    node.buffer = buffer
    node.connect(audioContext.destination)
    nextPlayTime = Math.max(nextPlayTime, audioContext.currentTime)
    node.start(nextPlayTime)
    nextPlayTime += buffer.duration
  }

  const handleServerEvent = (raw: string) => {
    let event: { type?: string; delta?: string; transcript?: string; error?: { message?: string } }
    try {
      event = JSON.parse(raw)
    } catch {
      return
    }
    switch (event.type) {
      // GA names, with the pre-GA aliases kept for compatibility.
      case 'response.output_audio.delta':
      case 'response.audio.delta':
        if (typeof event.delta === 'string') playAgentAudio(event.delta)
        break
      case 'response.output_audio_transcript.delta':
      case 'response.audio_transcript.delta':
        if (typeof event.delta === 'string') {
          agentEntryId ??= entryId()
          agentText += event.delta
          callbacks.onTranscript({ id: agentEntryId, speaker: 'AGENT', text: agentText })
        }
        break
      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done':
        agentEntryId = null
        agentText = ''
        break
      case 'conversation.item.input_audio_transcription.completed':
        if (typeof event.transcript === 'string' && event.transcript.trim()) {
          callbacks.onTranscript({ id: entryId(), speaker: 'CUSTOMER', text: event.transcript.trim() })
        }
        break
      case 'error':
        finish('error', event.error?.message ?? 'The realtime session reported an error.')
        break
      default:
        break
    }
  }

  const start = async () => {
    callbacks.onState('connecting')
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 24_000, echoCancellation: true, noiseSuppression: true },
      })
    } catch {
      finish('error', 'Microphone access was denied. Allow the microphone or use the scripted call.')
      return
    }
    audioContext = new AudioContext({ sampleRate: 24_000 })
    const url = `${REALTIME_WS_URL}?model=${encodeURIComponent(session.model)}`
    // Browser WebSockets cannot set Authorization headers; OpenAI accepts the
    // (ephemeral, minutes-lived) client secret via this subprotocol instead.
    socket = new WebSocket(url, ['realtime', `openai-insecure-api-key.${session.clientSecret}`])

    socket.onopen = () => {
      socket?.send(JSON.stringify({
        type: 'session.update',
        session: {
          type: 'realtime',
          audio: {
            input: {
              format: { type: 'audio/pcm', rate: 24_000 },
              transcription: { model: 'gpt-4o-mini-transcribe' },
              turn_detection: { type: 'server_vad' },
            },
            output: { format: { type: 'audio/pcm', rate: 24_000 }, voice: session.voice },
          },
        },
      }))
      // The agent opens the call like an outbound caller would.
      socket?.send(JSON.stringify({ type: 'response.create' }))
      callbacks.onState('live')

      if (!audioContext || !mediaStream) return
      source = audioContext.createMediaStreamSource(mediaStream)
      processor = audioContext.createScriptProcessor(4_096, 1, 1)
      processor.onaudioprocess = (audioEvent) => {
        if (muted || !socket || socket.readyState !== WebSocket.OPEN) return
        const input = audioEvent.inputBuffer.getChannelData(0)
        const pcm = new Int16Array(input.length)
        for (let index = 0; index < input.length; index += 1) {
          pcm[index] = Math.max(-32768, Math.min(32767, Math.round(input[index]! * 32767)))
        }
        const bytes = new Uint8Array(pcm.buffer)
        let binary = ''
        for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]!)
        socket.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: window.btoa(binary) }))
      }
      source.connect(processor)
      processor.connect(audioContext.destination)
    }
    socket.onmessage = (message) => {
      if (typeof message.data === 'string') handleServerEvent(message.data)
    }
    socket.onerror = () => finish('error', 'The realtime WebSocket connection failed.')
    socket.onclose = () => finish('ended')
  }

  void start()
  return {
    setMuted: (value: boolean) => {
      muted = value
    },
    end: () => finish('ended'),
  }
}
