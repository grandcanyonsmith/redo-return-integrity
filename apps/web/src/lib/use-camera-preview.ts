import { useEffect, useRef, useState } from 'react'

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean }
type TorchConstraints = MediaTrackConstraints & { advanced?: Array<{ torch?: boolean }> }
type TorchTrack = MediaStreamTrack & {
  getCapabilities: () => TorchCapabilities
  applyConstraints: (constraints: TorchConstraints) => Promise<void>
}

export function snapshotVideoFrame(video: HTMLVideoElement): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, video.videoWidth || 1280)
  canvas.height = Math.max(1, video.videoHeight || 720)
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('Could not capture this frame.'))
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Could not capture this frame.'))
        return
      }
      resolve(new File([blob], 'scan.jpg', { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.92)
  })
}

export function useCameraPreview(active: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [live, setLive] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)

  useEffect(() => {
    if (!active) {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setLive(false)
      setTorchOn(false)
      setTorchAvailable(false)
      return
    }

    let cancelled = false
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) return
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play()
        }
        const track = stream.getVideoTracks()[0]
        const capabilities = track?.getCapabilities() as TorchCapabilities | undefined
        setTorchAvailable(Boolean(capabilities?.torch))
        setLive(true)
      } catch {
        setLive(false)
      }
    }
    void start()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setLive(false)
      setTorchOn(false)
    }
  }, [active])

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0] as TorchTrack | undefined
    if (!track || !torchAvailable) return
    const next = !torchOn
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] })
      setTorchOn(next)
    } catch {
      setTorchAvailable(false)
    }
  }

  return { videoRef, live, torchOn, torchAvailable, toggleTorch }
}
