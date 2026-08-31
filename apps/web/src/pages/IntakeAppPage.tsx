import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  House,
  Link2,
  LoaderCircle,
  LogOut,
  Flashlight,
  Keyboard,
  Mail,
  Mic,
  MicOff,
  PackageOpen,
  Phone,
  Photo,
  PhoneOff,
  Printer,
  RefreshCcw,
  ScanBarcode,
  Send,
  Settings,
  Smartphone,
  Sparkles,
  Star,
  X,
} from '@/lib/ws-icons'
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import { Message, MessageAvatar, MessageContent, MessageHeader } from '@/components/ui/message'
import { MessageScroller, MessageScrollerContent, MessageScrollerViewport } from '@/components/ui/message-scroller'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StepIndicator, WorkstationShell, type WorkstationStep } from '../components/WorkstationShell'
import {
  analyzeReturnContents,
  createRealtimeCallSession,
  currentOperator,
  draftReturnCommunication,
  getOperatorSettings,
  listIntakeActivity,
  logoutOperator,
  lookupReturnByLabel,
  queueTestCommunication,
  recordCallOutcome,
  recordIntakeDisposition,
  recordReturnReview,
  resolutionStatusFor,
  uploadIntakeEvidence,
  type CallResolution,
  type CommunicationChannel,
  type InspectionClassification,
  type IntakeActionOptionId,
  type IntakeActivityRecord,
  type IntakeDisposition,
  type IntakeFixtureId,
  type IntakeResolutionStatus,
  type PackageInspection,
  type RealtimeCallSession,
  type ReturnRecord,
} from '../lib/api'
import { prepareImage } from '../lib/prepare-image'
import { startRealtimeCall, type ActiveCall, type CallTranscriptEntry } from '../lib/realtime-call'
import { useScanStart } from '../lib/scan-start'
import { snapshotVideoFrame, useCameraPreview } from '../lib/use-camera-preview'
import { rememberIntakeActivity } from '../lib/use-refund-portfolio'

/* ── flow model ─────────────────────────────────────────────────────── */

type FlowStep =
  | 'home'         // S0
  | 'scanLabel'    // S1 (+ S1b manual entry)
  | 'matching'     // S2
  | 'matched'      // S3
  | 'scanContents' // S4 (repeats for guided retakes)
  | 'assessing'    // S5
  | 'assessed'     // S6
  | 'triage'       // S7: pass / take more photos / set aside
  | 'chooseAction' // S7b (after PASS)
  | 'compose'      // S8
  | 'setAside'     // S9a: shelved for further processing
  | 'call'         // S9b: test-mode customer voice call
  | 'done'         // S9

type CallPhase = 'connecting' | 'live' | 'wrapUp' | 'logged'

type CapturedImage = {
  previewUrl: string
  evidenceId?: string
  fixtureId?: IntakeFixtureId | 'labelRma8821'
  label: string
  synthetic: boolean
}

type TimelineEntry = { at: string; label: string; imageUrl?: string; by?: string }

const labelFixture: CapturedImage = {
  previewUrl: '/evidence/return-label-rma-8821.png',
  fixtureId: 'labelRma8821',
  label: 'Demo UPS return label · RMA-8821',
  synthetic: true,
}

const packageFixtures: ReadonlyArray<{ id: IntakeFixtureId; shortLabel: string; label: string; imageUrl: string }> = [
  { id: 'matchReturn', shortLabel: 'Match', label: 'Both pieces, tags and liners on', imageUrl: '/evidence/return-matching-contents.png' },
  { id: 'emptyReturn', shortLabel: 'Empty mailer', label: 'Opened mailer with no garment', imageUrl: '/evidence/return-empty-box.png' },
  { id: 'quantityMismatch', shortLabel: 'Qty mismatch', label: 'One of two pieces returned', imageUrl: '/evidence/return-quantity-mismatch.png' },
  { id: 'wrongItem', shortLabel: 'Decoy', label: 'Unbranded tee in the mailer', imageUrl: '/evidence/return-wrong-item.png' },
  { id: 'damagedProduct', shortLabel: 'Damaged', label: 'Snagged seam and a run', imageUrl: '/evidence/return-damaged-product.png' },
  { id: 'wardrobing', shortLabel: 'Worn', label: 'Worn, tag reattached', imageUrl: '/evidence/return-wardrobing.png' },
  { id: 'possibleImitation', shortLabel: 'Imitation?', label: 'Lookalike needing authentication', imageUrl: '/evidence/return-imitation.png' },
]

const CLAIM_FORM_TOKEN = '{{CLAIM_FORM_LINK}}'

/* ── formatting helpers ─────────────────────────────────────────────── */

const moneyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

const formatMoney = (cents: number | null | undefined) => cents === null || cents === undefined ? '—' : moneyFormatter.format(cents / 100)
const formatToken = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (character) => character.toUpperCase())
const percent = (value: number) => `${Math.round(value * 100)}%`

const classificationTone = (classification: InspectionClassification) => {
  switch (classification) {
    case 'MATCH':
      return 'success' as const
    case 'QUANTITY_MISMATCH':
    case 'INCONCLUSIVE':
      return 'warning' as const
    case 'EMPTY_BOX':
    case 'WRONG_PRODUCT':
    case 'POSSIBLE_IMITATION':
    case 'WARDROBING':
      return 'destructive' as const
    case 'DAMAGED_PRODUCT':
      return 'outline' as const
    default: {
      const exhaustive: never = classification
      return exhaustive
    }
  }
}

const statusTone = (status: IntakeResolutionStatus) => {
  switch (status) {
    case 'REFUND_APPROVAL_PENDING':
    case 'CALL_RESOLVED':
      return 'success' as const
    case 'PARTIAL_REFUND_PENDING':
    case 'AWAITING_CUSTOMER':
      return 'warning' as const
    case 'ON_HOLD_REVIEW':
    case 'SET_ASIDE':
      return 'outline' as const
    case 'AUTHENTICATION_REVIEW':
      return 'destructive' as const
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}

const callResolutionOptions: ReadonlyArray<{ id: CallResolution; label: string; description: string }> = [
  { id: 'RESOLVED_REFUND_CONFIRMED', label: 'Resolved — refund path confirmed', description: 'The customer agreed with the refund math; queue it for human approval.' },
  { id: 'CUSTOMER_WILL_SHIP_ITEM_BACK', label: 'Customer will ship the item back', description: 'Hold the return open while the customer sends the missing or correct item.' },
  { id: 'FOLLOW_UP_EMAIL_NEEDED', label: 'Needs a written follow-up', description: 'Draft the recap message next so the customer has it in writing.' },
  { id: 'NO_RESOLUTION_ESCALATE', label: 'No resolution — escalate', description: 'Route the case to a supervisor with the call transcript digest.' },
]

/* ── small presentational pieces ────────────────────────────────────── */

function ProgressChecklist({ rows, activeIndex, failed }: { rows: string[]; activeIndex: number; failed?: boolean }) {
  return (
    <div className="ws-progress" role="status" aria-live="polite">
      {rows.map((row, index) => {
        const state = index < activeIndex ? 'done' : index === activeIndex ? (failed ? 'failed' : 'active') : 'pending'
        return (
          <Marker key={row} variant="border" className={`ws-progress__row ws-progress__row--${state === 'failed' ? 'pending' : state}`}>
            <MarkerIcon className={`ws-progress__mark${state === 'done' ? ' ws-progress__mark--done' : ''}`}>
              {state === 'done' ? <Check size={15} /> : state === 'active' ? <LoaderCircle size={15} className="ws-spin" /> : <CircleDashed size={15} />}
            </MarkerIcon>
            <MarkerContent className={state === 'active' && !failed ? 'shimmer' : undefined}>{row}</MarkerContent>
          </Marker>
        )
      })}
    </div>
  )
}

function CallTurn({ entry }: { entry: CallTranscriptEntry }) {
  switch (entry.speaker) {
    case 'AGENT':
      return (
        <Message align="end" className="ws-call-turn">
          <MessageAvatar>
            <Avatar className="size-8">
              <AvatarFallback>AI</AvatarFallback>
            </Avatar>
          </MessageAvatar>
          <MessageContent>
            <MessageHeader>Agent</MessageHeader>
            <Bubble variant="default" align="end">
              <BubbleContent>{entry.text}</BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>
      )
    case 'CUSTOMER':
      return (
        <Message align="start" className="ws-call-turn">
          <MessageAvatar>
            <Avatar className="size-8">
              <AvatarFallback>CU</AvatarFallback>
            </Avatar>
          </MessageAvatar>
          <MessageContent>
            <MessageHeader>Customer</MessageHeader>
            <Bubble variant="secondary" align="start">
              <BubbleContent>{entry.text}</BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>
      )
    case 'SYSTEM':
      return (
        <Marker className="ws-call-turn" variant="separator">
          <MarkerContent>{entry.text}</MarkerContent>
        </Marker>
      )
    default: {
      const exhaustive: never = entry.speaker
      return exhaustive
    }
  }
}

/** Advances a fake stage pointer while a real MCP call is in flight so the
 * checklist reads as live progress; the final row completes on real data. */
function useStagedProgress(active: boolean, stageCount: number) {
  const [stage, setStage] = useState(0)
  useEffect(() => {
    if (!active) {
      setStage(0)
      return
    }
    const timer = setInterval(() => setStage((current) => Math.min(current + 1, stageCount - 1)), 750)
    return () => clearInterval(timer)
  }, [active, stageCount])
  return stage
}

function ScanStage({
  title,
  hint,
  image,
  busy,
  live,
  videoRef,
  torchOn,
  torchAvailable,
  onClose,
  onManual,
  onTorch,
  onCapture,
  onPickFile,
  children,
}: {
  title: string
  hint: string
  image: CapturedImage | null
  busy: boolean
  live: boolean
  videoRef: RefObject<HTMLVideoElement | null>
  torchOn: boolean
  torchAvailable: boolean
  onClose: () => void
  onManual?: () => void
  onTorch: () => void
  onCapture: () => void
  onPickFile: () => void
  children?: ReactNode
}) {
  return (
    <div className="ws-scan ws-viewfinder">
      <div className="ws-scan__feed" aria-hidden="true">
        <video ref={videoRef} className={live && !image ? 'is-live' : undefined} autoPlay muted playsInline />
        {image ? <img src={image.previewUrl} alt="" /> : null}
      </div>
      <div className="ws-scan__window" aria-hidden="true" />
      <div className="ws-scan__chrome">
        <header className="ws-scan__top">
          <button type="button" className="ws-scan__icon-btn" onClick={onClose} aria-label="Cancel">
            <X size={18} />
          </button>
          <h1 className="ws-scan__title">{title}</h1>
          <span className="ws-scan__top-spacer" aria-hidden="true" />
        </header>
        <p className="ws-scan__hint">{busy ? 'Verifying capture…' : hint}</p>
        {children}
        <div className="ws-scan__dock">
          {onManual ? (
            <button type="button" className="ws-scan__icon-btn ws-scan__icon-btn--lg" onClick={onManual} aria-label="Enter RMA, order # or tracking">
              <Keyboard size={22} />
            </button>
          ) : <span className="ws-scan__icon-btn ws-scan__icon-btn--lg ws-scan__icon-btn--spacer" aria-hidden="true" />}
          <button type="button" className="ws-scan__shutter" disabled={busy} onClick={onCapture} aria-label="Capture">
            {busy ? <LoaderCircle className="ws-spin" size={26} /> : <span />}
          </button>
          {torchAvailable ? (
            <button type="button" className={`ws-scan__icon-btn ws-scan__icon-btn--lg${torchOn ? ' is-on' : ''}`} onClick={onTorch} aria-label={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'} aria-pressed={torchOn}>
              <Flashlight size={22} />
            </button>
          ) : (
            <button type="button" className="ws-scan__icon-btn ws-scan__icon-btn--lg" onClick={onPickFile} aria-label="Choose a photo">
              <Photo size={22} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ClassificationChip({ classification, confidence }: { classification: InspectionClassification; confidence?: number }) {
  return (
    <Badge variant={classificationTone(classification)} className="ws-chip">
      {classification.replaceAll('_', ' ')}
      {confidence !== undefined ? <span className="ws-mono">{percent(confidence)}</span> : null}
    </Badge>
  )
}

function StatusChip({ status }: { status: IntakeResolutionStatus }) {
  return <Badge variant={statusTone(status)} className="ws-chip">{status.replaceAll('_', ' ')}</Badge>
}

function ModelAuditRow({ audit, mode, recordId, recordLabel }: {
  audit: PackageInspection['modelAudit']
  mode: string
  recordId: string
  recordLabel: string
}) {
  return (
    <details className="ws-audit">
      <summary><ChevronDown aria-hidden="true" size={14} /> Model audit ({audit.providerModel ?? audit.requestedModel}, v{audit.promptVersion}, {(audit.latencyMs / 1000).toFixed(1)}s)</summary>
      <div className="ws-audit__body">
        <dl className="ws-kv"><dt>Mode</dt><dd>{mode}</dd></dl>
        <dl className="ws-kv"><dt>Provider</dt><dd>{audit.provider}</dd></dl>
        <dl className="ws-kv"><dt>Model</dt><dd className="ws-mono">{audit.providerModel ?? audit.requestedModel}</dd></dl>
        <dl className="ws-kv"><dt>Request</dt><dd className="ws-mono">{audit.requestId ?? 'not returned'}</dd></dl>
        <dl className="ws-kv"><dt>Prompt</dt><dd className="ws-mono">v{audit.promptVersion} · {audit.schemaName}</dd></dl>
        <dl className="ws-kv"><dt>Latency</dt><dd className="ws-mono">{audit.latencyMs.toLocaleString()} ms</dd></dl>
        <dl className="ws-kv"><dt>{recordLabel}</dt><dd className="ws-mono">{recordId}</dd></dl>
        <dl className="ws-kv"><dt>Input SHA-256</dt><dd className="ws-mono">{audit.inputSha256.slice(0, 16)}…</dd></dl>
        <dl className="ws-kv"><dt>Provider storage</dt><dd>store: false</dd></dl>
      </div>
    </details>
  )
}

const initialsOf = (name: string) => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase() ?? '')
  .join('')

function ActivityList({ records, pending }: { records: IntakeActivityRecord[]; pending: boolean }) {
  if (pending) return <p className="ws-activity__empty">Loading session activity…</p>
  if (records.length === 0) return <p className="ws-activity__empty">Nothing yet today</p>
  return (
    <div className="ws-activity">
      {records.map((record) => {
        const meta = record.kind === 'CALL_COMPLETED'
          ? 'call logged'
          : record.kind === 'DISPOSITION_RECORDED'
            ? 'set aside'
            : record.channel === 'SMS' ? 'text queued' : 'email queued'
        return (
          <article key={record.activityId} className="ws-activity__item">
            <Avatar className="ws-avatar size-9" aria-hidden="true">
              <AvatarFallback>{initialsOf(record.customerName)}</AvatarFallback>
            </Avatar>
            <span className="ws-activity__who">{record.customerName} · <span className="ws-mono">{record.rmaId}</span></span>
            <span className="ws-activity__meta">{record.productTitle} · {meta}{record.handledBy ? ` · ${record.handledBy}` : ''}</span>
            <time className="ws-activity__time">{timeFormatter.format(new Date(record.recordedAt))}</time>
            <span className="ws-activity__status">
              <ClassificationChip classification={record.classification} />
              <StatusChip status={record.resolutionStatus} />
            </span>
          </article>
        )
      })}
    </div>
  )
}

function TimelineList({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="ws-timeline">
      {entries.map((entry, index) => (
        <li key={`${entry.at}-${index}`}>
          <time>{entry.at}</time>
          {entry.imageUrl ? <img className="ws-timeline__thumb" src={entry.imageUrl} alt="" /> : null}
          <span className="ws-timeline__text">
            {entry.label}
            {entry.by ? <small className="ws-timeline__by">{entry.by}</small> : null}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Draft bodies keep the server-owned {{CLAIM_FORM_LINK}} placeholder; render
 * it as a chip so the operator sees exactly where the link lands. */
function DraftBody({ body }: { body: string }) {
  const parts = body.split(CLAIM_FORM_TOKEN)
  return (
    <p className="ws-draft__body">
      {parts.map((part, index) => (
        <span key={index}>
          {part}
          {index < parts.length - 1 ? <span className="ws-draft__chip"><Link2 aria-hidden="true" size={12} /> claim-form link</span> : null}
        </span>
      ))}
    </p>
  )
}

/* ── the workstation ────────────────────────────────────────────────── */

const flowIndicator = (step: FlowStep): WorkstationStep | 'done' => {
  switch (step) {
    case 'home':
    case 'scanLabel':
    case 'matching':
      return 'Scan'
    case 'matched':
      return 'Match'
    case 'scanContents':
    case 'assessing':
    case 'assessed':
      return 'Inspect'
    case 'triage':
    case 'chooseAction':
    case 'compose':
    case 'call':
      return 'Act'
    case 'setAside':
    case 'done':
      return 'done'
    default: {
      const exhaustive: never = step
      return exhaustive
    }
  }
}

export function IntakeAppPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { setStartScan, setImmersive } = useScanStart()
  const operator = currentOperator()
  const [step, setStep] = useState<FlowStep>('home')
  const [labelImage, setLabelImage] = useState<CapturedImage | null>(null)
  const [packageImage, setPackageImage] = useState<CapturedImage | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualId, setManualId] = useState('')
  const [preparing, setPreparing] = useState(false)
  const [captureError, setCaptureError] = useState('')
  const [selectedOptionId, setSelectedOptionId] = useState<IntakeActionOptionId | null>(null)
  const [selectedDisposition, setSelectedDisposition] = useState<IntakeDisposition | null>(null)
  const [retakeCount, setRetakeCount] = useState(0)
  const [retakeInstructions, setRetakeInstructions] = useState<string[]>([])
  const [channel, setChannel] = useState<CommunicationChannel>('EMAIL')
  const [acknowledged, setAcknowledged] = useState(false)
  const [reviewerLabel, setReviewerLabel] = useState(operator?.displayName ?? 'Station 04 operator')
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [callPhase, setCallPhase] = useState<CallPhase>('connecting')
  const [callTranscript, setCallTranscript] = useState<CallTranscriptEntry[]>([])
  const [callError, setCallError] = useState('')
  const [callMuted, setCallMuted] = useState(false)
  const [callResolution, setCallResolution] = useState<CallResolution>('RESOLVED_REFUND_CONFIRMED')
  const [callNote, setCallNote] = useState('')
  const labelInputRef = useRef<HTMLInputElement>(null)
  const contentsInputRef = useRef<HTMLInputElement>(null)
  const scanning = step === 'scanLabel' || step === 'scanContents'
  const camera = useCameraPreview(scanning)
  const activeCallRef = useRef<ActiveCall | null>(null)
  const callStartedAtRef = useRef('')
  const callLiveLoggedRef = useRef(false)

  // Never leave a microphone or socket open when the console is not on screen.
  useEffect(() => {
    if (step !== 'call') {
      activeCallRef.current?.end()
      activeCallRef.current = null
    }
    return () => activeCallRef.current?.end()
  }, [step])

  const pushTimeline = (label: string, imageUrl?: string) => setTimeline((entries) => [...entries, {
    at: timeFormatter.format(new Date()),
    label,
    ...(imageUrl ? { imageUrl } : {}),
    ...(operator ? { by: operator.displayName } : {}),
  }])

  const activityQuery = useQuery({ queryKey: ['intake-activity'], queryFn: listIntakeActivity })
  const activity = activityQuery.data ?? []
  const settingsQuery = useQuery({ queryKey: ['operator-settings'], queryFn: getOperatorSettings })
  const voiceCallsEnabled = settingsQuery.data?.voiceCallsEnabled ?? true
  const suggestCallOnSetAside = settingsQuery.data?.suggestCallOnSetAside ?? true

  const lookup = useMutation({
    mutationFn: (input: { evidenceId?: string; fixtureId?: 'labelRma8821'; scanValue?: string }) => lookupReturnByLabel(input),
    onSuccess: (result) => {
      pushTimeline('Label scanned', labelImage?.previewUrl)
      pushTimeline(`Matched ${result.returnRecord.orderId}`, result.returnRecord.product.imageUrl)
      setStep('matched')
    },
  })

  const inspectionMutation = useMutation({
    mutationFn: (input: { returnRecordId: string; fixtureId?: IntakeFixtureId; evidenceId?: string; retakeCount?: number }) => analyzeReturnContents(input),
    onSuccess: (result) => {
      pushTimeline(
        `${result.inspection.classification.replaceAll('_', ' ')} (${percent(result.inspection.confidence)})`,
        packageImage?.previewUrl,
      )
      const recommended = result.inspection.actionOptions.find((option) => option.recommended) ?? result.inspection.actionOptions[0]
      setSelectedOptionId(recommended?.id ?? null)
      setChannel(recommended?.channel ?? settingsQuery.data?.defaultChannel ?? 'EMAIL')
      setSelectedDisposition(result.inspection.dispositionRecommendation.disposition)
      setStep('assessed')
    },
  })

  const draftMutation = useMutation({
    mutationFn: (input: { inspectionId: string; channel: CommunicationChannel; actionOptionId?: IntakeActionOptionId }) => draftReturnCommunication(input),
    onSuccess: (result) => {
      pushTimeline(`${result.draft.channel === 'SMS' ? 'Text' : 'Email'} drafted`)
      setStep('compose')
    },
  })

  const sendMutation = useMutation({
    mutationFn: async () => {
      const inspectionRecord = inspectionMutation.data?.inspection
      const draftRecord = draftMutation.data?.draft
      if (!inspectionRecord || !draftRecord) throw new Error('Draft the message before sending.')
      const review = await recordReturnReview({
        inspectionId: inspectionRecord.inspectionId,
        draftId: draftRecord.draftId,
        reviewerLabel: reviewerLabel.trim(),
        evidenceIds: inspectionRecord.evidenceIds,
      })
      const queue = await queueTestCommunication({ draftId: draftRecord.draftId, reviewId: review.reviewId })
      if (queue.status !== 'QUEUED_TEST_OUTBOX') throw new Error(queue.message)
      return { review, queue }
    },
    onSuccess: (result) => {
      pushTimeline(`${draftMutation.data?.draft.channel === 'SMS' ? 'Text' : 'Email'} queued · record updated`)
      rememberIntakeActivity(queryClient, result.queue.activity)
      setStep('done')
    },
  })

  const dispositionMutation = useMutation({
    mutationFn: (input: { disposition: IntakeDisposition }) => {
      const inspectionRecord = inspectionMutation.data?.inspection
      if (!inspectionRecord) throw new Error('Assess the contents before recording a disposition.')
      return recordIntakeDisposition({
        inspectionId: inspectionRecord.inspectionId,
        disposition: input.disposition,
        recordedBy: reviewerLabel.trim() || 'Workstation operator',
      })
    },
    onSuccess: (_result, variables) => {
      const inspectionRecord = inspectionMutation.data?.inspection
      if (variables.disposition === 'PASS') {
        pushTimeline('Disposition: pass')
        setStep('chooseAction')
        return
      }
      if (variables.disposition === 'TAKE_MORE_PHOTOS') {
        pushTimeline(`Disposition: more photos (retake ${retakeCount + 1})`)
        setRetakeCount((count) => count + 1)
        setRetakeInstructions(inspectionRecord?.dispositionRecommendation.photoInstructions ?? [])
        setPackageImage(null)
        setStep('scanContents')
        return
      }
      pushTimeline('Set aside for further processing')
      rememberIntakeActivity(queryClient, _result.activity)
      setStep('setAside')
    },
  })

  const beginCall = (session: RealtimeCallSession) => {
    callStartedAtRef.current = new Date().toISOString()
    callLiveLoggedRef.current = false
    setCallTranscript([])
    setCallError('')
    setCallMuted(false)
    activeCallRef.current = startRealtimeCall(session, {
      onState: (state, detail) => {
        if (state === 'live') {
          setCallPhase('live')
          if (!callLiveLoggedRef.current) {
            callLiveLoggedRef.current = true
            pushTimeline(`Call started (${session.mode === 'SIMULATED' ? 'simulated' : 'realtime voice'})`)
          }
        } else if (state === 'ended') {
          setCallPhase('wrapUp')
        } else if (state === 'error') {
          setCallError(detail ?? 'The call could not continue.')
          setCallPhase('wrapUp')
        }
      },
      onTranscript: (entry) => {
        setCallTranscript((entries) => {
          const existing = entries.findIndex((candidate) => candidate.id === entry.id)
          if (existing === -1) return [...entries, entry]
          const next = [...entries]
          next[existing] = entry
          return next
        })
      },
    })
  }

  const callSessionMutation = useMutation({
    mutationFn: (input: { returnRecordId: string; inspectionId?: string }) => createRealtimeCallSession(input),
    onSuccess: (session) => beginCall(session),
  })

  const callOutcomeMutation = useMutation({
    mutationFn: () => {
      const record = lookup.data?.returnRecord
      const inspectionRecord = inspectionMutation.data?.inspection
      const session = callSessionMutation.data
      if (!record || !inspectionRecord || !session) throw new Error('The call context is incomplete.')
      const startedAt = callStartedAtRef.current || new Date().toISOString()
      const durationSeconds = Math.min(3_600, Math.max(1, Math.round((Date.now() - new Date(startedAt).getTime()) / 1_000)))
      const transcript = callTranscript.map((entry) => `${entry.speaker}: ${entry.text}`).join('\n')
        || 'No transcript captured.'
      return recordCallOutcome({
        returnRecordId: record.returnRecordId,
        inspectionId: inspectionRecord.inspectionId,
        mode: session.mode === 'SIMULATED' ? 'SIMULATED' : 'OPENAI_REALTIME',
        startedAt,
        durationSeconds,
        transcript,
        resolution: callResolution,
        ...(callNote.trim() ? { resolutionNote: callNote.trim() } : {}),
        operatorLabel: reviewerLabel.trim() || 'Workstation operator',
      })
    },
    onSuccess: (result) => {
      pushTimeline('Call outcome recorded · record updated')
      rememberIntakeActivity(queryClient, result.activity)
      setCallPhase('logged')
    },
  })

  const startCall = () => {
    const record = lookup.data?.returnRecord
    if (!record) return
    setCallPhase('connecting')
    setCallTranscript([])
    setCallError('')
    setCallResolution('RESOLVED_REFUND_CONFIRMED')
    setCallNote('')
    callOutcomeMutation.reset()
    setStep('call')
    callSessionMutation.mutate({
      returnRecordId: record.returnRecordId,
      inspectionId: inspectionMutation.data?.inspection.inspectionId,
    })
  }

  const resetFlow = () => {
    activeCallRef.current?.end()
    activeCallRef.current = null
    lookup.reset()
    inspectionMutation.reset()
    draftMutation.reset()
    sendMutation.reset()
    dispositionMutation.reset()
    callSessionMutation.reset()
    callOutcomeMutation.reset()
    setLabelImage(null)
    setPackageImage(null)
    setManualOpen(false)
    setManualId('')
    setCaptureError('')
    setSelectedOptionId(null)
    setSelectedDisposition(null)
    setRetakeCount(0)
    setRetakeInstructions([])
    setChannel('EMAIL')
    setAcknowledged(false)
    setTimeline([])
    setCallPhase('connecting')
    setCallTranscript([])
    setCallError('')
    setCallNote('')
  }

  const startScan = () => {
    resetFlow()
    setStep('scanLabel')
  }

  useEffect(() => {
    setStartScan(() => startScan)
    return () => setStartScan(null)
  }, [setStartScan])

  useEffect(() => {
    setImmersive(scanning)
    return () => setImmersive(false)
  }, [scanning, setImmersive])

  const resetToReady = () => {
    resetFlow()
    setStep('home')
  }

  const goHome = () => {
    resetToReady()
    void queryClient.invalidateQueries({ queryKey: ['refund-portfolio'], refetchType: 'all' })
    void queryClient.invalidateQueries({ queryKey: ['intake-activity'], refetchType: 'all' })
    navigate('/')
  }

  const captureFile = async (file: File, kind: 'label' | 'contents') => {
    setCaptureError('')
    setPreparing(true)
    try {
      const dataUrl = await prepareImage(file)
      const upload = await uploadIntakeEvidence(dataUrl, kind === 'label' ? 'RETURN_LABEL' : 'PACKAGE_CONTENTS')
      const image: CapturedImage = { previewUrl: dataUrl, evidenceId: upload.evidenceId, label: file.name, synthetic: false }
      if (kind === 'label') {
        setLabelImage(image)
        setStep('matching')
        lookup.mutate({ evidenceId: upload.evidenceId })
      } else {
        setPackageImage(image)
        setStep('assessing')
        inspectionMutation.mutate({ returnRecordId: requireReturnRecord().returnRecordId, evidenceId: upload.evidenceId, retakeCount })
      }
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : 'Image capture failed.')
    } finally {
      setPreparing(false)
    }
  }

  const onFileInput = (kind: 'label' | 'contents') => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void captureFile(file, kind)
    event.target.value = ''
  }

  const captureFromScanner = (kind: 'label' | 'contents') => {
    const video = camera.videoRef.current
    if (camera.live && video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
      void snapshotVideoFrame(video)
        .then((file) => captureFile(file, kind))
        .catch((error: unknown) => {
          setCaptureError(error instanceof Error ? error.message : 'Image capture failed.')
        })
      return
    }
    if (kind === 'label') labelInputRef.current?.click()
    else contentsInputRef.current?.click()
  }

  const useDemoLabel = () => {
    setCaptureError('')
    setLabelImage(labelFixture)
    setStep('matching')
    lookup.mutate({ fixtureId: 'labelRma8821' })
  }

  const searchManualId = () => {
    const identifier = manualId.trim()
    if (!identifier) return
    setCaptureError('')
    setStep('matching')
    lookup.mutate({ scanValue: identifier })
  }

  const requireReturnRecord = (): ReturnRecord => {
    const record = lookup.data?.returnRecord
    if (!record) throw new Error('Match a return before continuing.')
    return record
  }

  const analyzeFixture = (fixture: (typeof packageFixtures)[number]) => {
    setCaptureError('')
    setPackageImage({ previewUrl: fixture.imageUrl, fixtureId: fixture.id, label: fixture.label, synthetic: true })
    setStep('assessing')
    inspectionMutation.mutate({ returnRecordId: requireReturnRecord().returnRecordId, fixtureId: fixture.id, retakeCount })
  }

  const draftForSelection = (nextChannel?: CommunicationChannel) => {
    const inspectionRecord = inspectionMutation.data?.inspection
    if (!inspectionRecord) return
    const option = inspectionRecord.actionOptions.find((candidate) => candidate.id === selectedOptionId)
    const requestedChannel = nextChannel ?? option?.channel ?? channel
    setChannel(requestedChannel)
    setAcknowledged(false)
    draftMutation.mutate({
      inspectionId: inspectionRecord.inspectionId,
      channel: requestedChannel,
      actionOptionId: option?.id,
    })
  }

  const returnRecord = lookup.data?.returnRecord
  const inspection = inspectionMutation.data?.inspection
  const draft = draftMutation.data?.draft
  const selectedOption = inspection?.actionOptions.find((option) => option.id === selectedOptionId)
  const queuedActivity = sendMutation.data?.queue.activity
  const resolutionStatus = queuedActivity?.resolutionStatus ?? (selectedOptionId ? resolutionStatusFor(selectedOptionId) : undefined)
  const awaitingCount = activity.filter((record) => record.resolutionStatus === 'AWAITING_CUSTOMER').length

  const lookupStage = useStagedProgress(step === 'matching' && lookup.isPending, 3)
  const assessStage = useStagedProgress(step === 'assessing' && inspectionMutation.isPending, 3)

  /* ── per-step screen config ───────────────────────────────────────── */

  let topLeft: ReactNode
  let actionBar: ReactNode
  let content: ReactNode

  switch (step) {
    case 'home': {
      actionBar = (
        <Button type="button" size="lg" className="min-w-0 flex-1" onClick={startScan}>
          <Camera aria-hidden="true" size={18} /> Scan return label
        </Button>
      )
      content = (
        <>
          <div className="ws-empty">
            <span className="ws-empty__icon"><PackageOpen aria-hidden="true" size={26} /></span>
            <h1 className="ws-empty__title">{activity.length === 0 ? 'No returns scanned' : 'Ready for the next box'}</h1>
            <p className="ws-empty__hint">Scan a label to begin</p>
          </div>
          <div className="ws-kpis">
            <Card className="ws-kpi shadow-none"><b>{activity.length}</b><span>processed this session</span></Card>
            <Card className="ws-kpi shadow-none"><b>{awaitingCount}</b><span>awaiting customer</span></Card>
          </div>
          <section aria-label="Session activity" className="ws-only-mobile">
            <p className="ws-divider">Activity</p>
            <ActivityList records={activity} pending={activityQuery.isPending} />
          </section>
        </>
      )
      break
    }

    case 'scanLabel': {
      content = (
        <ScanStage
          title="Scan label"
          hint="Align the shipping label"
          image={labelImage}
          busy={preparing}
          live={camera.live}
          videoRef={camera.videoRef}
          torchOn={camera.torchOn}
          torchAvailable={camera.torchAvailable}
          onClose={resetToReady}
          onManual={() => setManualOpen((open) => !open)}
          onTorch={() => { void camera.toggleTorch() }}
          onCapture={() => captureFromScanner('label')}
          onPickFile={() => labelInputRef.current?.click()}
        >
          {captureError ? <Alert variant="destructive"><AlertCircle size={15} /><AlertDescription>{captureError}</AlertDescription></Alert> : null}
          {manualOpen ? (
            <div className="ws-scan__sheet">
              <Label htmlFor="return-identifier">Return identifier</Label>
              <Input
                id="return-identifier"
                value={manualId}
                onChange={(event) => setManualId(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') searchManualId() }}
                placeholder="RMA-8821, order, tracking, or label ID"
                autoFocus
              />
              <Button type="button" size="lg" className="w-full" disabled={!manualId.trim()} onClick={searchManualId}>
                <ScanBarcode aria-hidden="true" size={16} /> Search returns
              </Button>
            </div>
          ) : null}
          <button type="button" className="ws-scan__ghost" onClick={useDemoLabel}>Use the demo label</button>
        </ScanStage>
      )
      break
    }

    case 'matching': {
      topLeft = <Button type="button" size="sm" variant="ghost" onClick={resetToReady}><X aria-hidden="true" size={16} /> Cancel</Button>
      const rows = ['Reading label', 'Extracting RMA / tracking', 'Searching return records']
      content = (
        <>
          {labelImage ? (
            <div className="ws-evidence-strip">
              <figure><img src={labelImage.previewUrl} alt={labelImage.label} /><figcaption>Label</figcaption></figure>
            </div>
          ) : (
            <p className="ws-capture-help">Looking up <span className="ws-mono">{manualId.trim()}</span></p>
          )}
          <ProgressChecklist rows={rows} activeIndex={lookup.isPending ? lookupStage : rows.length} failed={lookup.isError} />
          {lookup.isError ? (
            <>
              <Alert variant="destructive"><AlertCircle size={15} /><AlertDescription>No return matched this label. Nothing was recorded.</AlertDescription></Alert>
              <div className="ws-actionbar__inner">
                <Button type="button" size="lg" variant="secondary" className="min-w-0 flex-1" onClick={() => { setStep('scanLabel'); lookup.reset() }}><ArrowLeft aria-hidden="true" size={16} /> Rescan</Button>
                <Button type="button" size="lg" variant="secondary" className="min-w-0 flex-1" onClick={() => { setStep('scanLabel'); setManualOpen(true); lookup.reset() }}>Enter ID manually</Button>
              </div>
            </>
          ) : null}
        </>
      )
      break
    }

    case 'matched': {
      const record = returnRecord
      topLeft = <Button type="button" size="sm" variant="ghost" onClick={startScan}><ArrowLeft aria-hidden="true" size={16} /> Rescan</Button>
      actionBar = (
        <Button type="button" size="lg" className="min-w-0 flex-1" onClick={() => setStep('scanContents')}>
          <Camera aria-hidden="true" size={18} /> Open box &amp; photograph
        </Button>
      )
      content = record ? (
        <>
          <p className="ws-match-banner"><CheckCircle2 aria-hidden="true" size={18} /> Return matched by {lookup.data?.matchedBy.toLowerCase()}</p>
          <Card>
            <CardContent className="ws-card__section pt-4">
              <h1 className="ws-h">{record.customer.name}</h1>
              <p className="ws-sub">Order <span className="ws-mono">{record.orderId}</span></p>
              <p className="ws-sub"><span className="ws-mono">{record.rmaId}</span> · {record.carrier} <span className="ws-mono">{record.trackingNumber}</span></p>
            </CardContent>
            <CardContent className="ws-card__section">
              <div className="ws-product">
                <img src={record.product.imageUrl} alt={`Catalog reference for ${record.product.title}`} />
                <div>
                  <p className="ws-product__title">{record.product.title}</p>
                  <p className="ws-product__meta">Qty {record.product.quantity} · {formatMoney(record.product.unitPriceCents)} ea</p>
                  <p className="ws-product__meta">Reason: {record.return.reason}</p>
                </div>
              </div>
            </CardContent>
            <CardContent className="ws-card__section">
              <dl className="ws-kv"><dt>Requested refund</dt><dd>{formatMoney(record.return.requestedRefundCents)}</dd></dl>
              <dl className="ws-kv"><dt>Eligible ceiling</dt><dd>{formatMoney(record.product.totalEligibleRefundCents)}</dd></dl>
              <dl className="ws-kv"><dt>Policy</dt><dd className="ws-mono">{record.return.policyVersion} · #{record.return.policySnapshotSha256.slice(0, 8)}…</dd></dl>
            </CardContent>
          </Card>
          {lookup.data && lookup.data.warnings.length > 0 ? (
            <p className="ws-note"><AlertCircle aria-hidden="true" size={14} /> {lookup.data.warnings.join(' ')}</p>
          ) : null}
          <p className="ws-capture-help">
            Wrong match? <button type="button" className="ws-inline-link" onClick={startScan}>Search again</button>
          </p>
        </>
      ) : null
      break
    }

    case 'scanContents': {
      content = (
        <ScanStage
          title="Scan contents"
          hint="Photograph the opened box"
          image={packageImage}
          busy={preparing}
          live={camera.live}
          videoRef={camera.videoRef}
          torchOn={camera.torchOn}
          torchAvailable={camera.torchAvailable}
          onClose={() => setStep('matched')}
          onTorch={() => { void camera.toggleTorch() }}
          onCapture={() => captureFromScanner('contents')}
          onPickFile={() => contentsInputRef.current?.click()}
        >
          {retakeCount > 0 && retakeInstructions.length > 0 ? (
            <div className="ws-retake ws-scan__sheet" role="note" aria-label="Retake instructions">
              <p className="ws-retake__title"><Camera aria-hidden="true" size={14} /> Retake {retakeCount} — capture next:</p>
              <ul>
                {retakeInstructions.map((instruction) => <li key={instruction}>{instruction}</li>)}
              </ul>
            </div>
          ) : null}
          {captureError ? <Alert variant="destructive"><AlertCircle size={15} /><AlertDescription>{captureError}</AlertDescription></Alert> : null}
          <div className="ws-demo-strip ws-scan__demos">
            <p className="ws-divider">Demo boxes</p>
            <div className="ws-demo-strip__row">
              {packageFixtures.slice(0, 3).map((fixture) => (
                <button key={fixture.id} type="button" className="ws-demo-thumb" aria-pressed={packageImage?.fixtureId === fixture.id} onClick={() => analyzeFixture(fixture)}>
                  <img src={fixture.imageUrl} alt="" /> {fixture.shortLabel}
                </button>
              ))}
            </div>
            <div className="ws-demo-strip__row">
              {packageFixtures.slice(3).map((fixture) => (
                <button key={fixture.id} type="button" className="ws-demo-thumb" aria-pressed={packageImage?.fixtureId === fixture.id} onClick={() => analyzeFixture(fixture)}>
                  <img src={fixture.imageUrl} alt="" /> {fixture.shortLabel}
                </button>
              ))}
            </div>
          </div>
        </ScanStage>
      )
      break
    }

    case 'assessing': {
      topLeft = <Button type="button" size="sm" variant="ghost" onClick={() => setStep('scanContents')}><ArrowLeft aria-hidden="true" size={16} /> Back</Button>
      const rows = ['Evidence verified', `Comparing against catalog ${returnRecord?.product.title ?? 'record'}`, 'Scoring classification + refund math']
      content = (
        <>
          <div className="ws-evidence-strip">
            {labelImage ? <figure><img src={labelImage.previewUrl} alt={labelImage.label} /><figcaption>Label</figcaption></figure> : null}
            {packageImage ? <figure><img src={packageImage.previewUrl} alt={packageImage.label} /><figcaption>Contents</figcaption></figure> : null}
          </div>
          <ProgressChecklist rows={rows} activeIndex={inspectionMutation.isPending ? assessStage : rows.length} failed={inspectionMutation.isError} />
          {inspectionMutation.isError ? (
            <>
              <Alert variant="destructive"><AlertCircle size={15} /><AlertDescription>The contents could not be analyzed safely. No classification was recorded.</AlertDescription></Alert>
              <div className="ws-actionbar__inner">
                <Button type="button" size="lg" variant="secondary" className="min-w-0 flex-1" onClick={() => setStep('scanContents')}><ArrowLeft aria-hidden="true" size={16} /> Re-photograph</Button>
              </div>
            </>
          ) : null}
        </>
      )
      break
    }

    case 'assessed': {
      topLeft = <Button type="button" size="sm" variant="ghost" onClick={() => setStep('scanContents')}><ArrowLeft aria-hidden="true" size={16} /> Back</Button>
      actionBar = (
        <Button type="button" size="lg" className="min-w-0 flex-1" onClick={() => setStep('triage')}>
          Choose next step <ArrowRight aria-hidden="true" size={18} />
        </Button>
      )
      if (inspection && returnRecord) {
        const observed = inspection.observedItems[0]
        const missing = Math.max(0, inspection.comparison.expectedQuantity - inspection.comparison.observedQuantity)
        content = (
          <>
            <div className="ws-assess-head">
              <ClassificationChip classification={inspection.classification} />
              <span className="ws-confidence">{percent(inspection.confidence)} confidence</span>
            </div>
            <div className="ws-compare">
              <figure>
                <img src={returnRecord.product.imageUrl} alt={`Catalog reference for ${returnRecord.product.title}`} />
                <figcaption><b>Expected</b><span>{returnRecord.product.title} · ×{inspection.comparison.expectedQuantity}</span><span>Merchant catalog</span></figcaption>
              </figure>
              <figure>
                <img src={inspection.warehouseEvidenceImageUrl ?? packageImage?.previewUrl ?? ''} alt="Warehouse contents evidence" />
                <figcaption>
                  <b>Observed</b>
                  <span>{observed?.description ?? 'No merchandise visible'} · ×{inspection.comparison.observedQuantity}</span>
                  <span>{missing > 0 ? `${missing} missing · ` : ''}Warehouse capture</span>
                </figcaption>
              </figure>
            </div>
            <Message>
              <MessageAvatar>
                <Avatar className="size-8">
                  <AvatarFallback>AI</AvatarFallback>
                </Avatar>
              </MessageAvatar>
              <MessageContent>
                <MessageHeader>Redo intake</MessageHeader>
                <Bubble variant="tinted">
                  <BubbleContent>
                    <b className="mb-1 block text-[11px] font-bold uppercase tracking-[0.06em]">AI notes</b>
                    {inspection.summary}
                  </BubbleContent>
                </Bubble>
              </MessageContent>
            </Message>
            <Card>
              <CardContent className="ws-card__section pt-4">
                <p className="ws-divider">Refund math</p>
                <div className="ws-math">
                  {inspection.classification === 'QUANTITY_MISMATCH' && inspection.comparison.observedQuantity > 0 ? (
                    <div className="ws-math__row"><span>{inspection.comparison.observedQuantity} × {formatMoney(returnRecord.product.unitPriceCents)}</span><span>{formatMoney(inspection.comparison.observedQuantity * returnRecord.product.unitPriceCents)}</span></div>
                  ) : null}
                  <div className="ws-math__row"><span>Requested</span><span>{formatMoney(returnRecord.return.requestedRefundCents)}</span></div>
                  {inspection.refund.withholdAmountCents ? (
                    <div className="ws-math__row"><span>Hold</span><span>{formatMoney(inspection.refund.withholdAmountCents)}</span></div>
                  ) : null}
                  <div className="ws-math__row ws-math__row--total"><span>{formatToken(inspection.refund.recommendedType)} recommended</span><span>{formatMoney(inspection.refund.recommendedAmountCents)}</span></div>
                </div>
                <p className="ws-sub" style={{ marginTop: 8 }}>{inspection.refund.rationale}</p>
              </CardContent>
            </Card>
            <p className="ws-note">
              <Sparkles aria-hidden="true" size={14} />
              Next-step recommendation: <b>{formatToken(inspection.dispositionRecommendation.disposition)}</b>
              {inspection.dispositionRecommendation.source === 'OPERATOR_SETTING' ? ' (station setting)' : ''} — {inspection.dispositionRecommendation.reason}
            </p>
            <ModelAuditRow audit={inspection.modelAudit} mode={inspection.analysisMode} recordId={inspection.inspectionId} recordLabel="Inspection" />
          </>
        )
      }
      break
    }

    case 'triage': {
      topLeft = <Button type="button" size="sm" variant="ghost" onClick={() => setStep('assessed')}><ArrowLeft aria-hidden="true" size={16} /> Assessment</Button>
      const recommendation = inspection?.dispositionRecommendation
      const dispositionCards: ReadonlyArray<{ id: IntakeDisposition; label: string; description: string; icon: ReactNode }> = [
        { id: 'PASS', label: 'Pass', description: 'Label, product, and contents check out. Continue to the customer action list.', icon: <CheckCircle2 aria-hidden="true" size={16} /> },
        { id: 'TAKE_MORE_PHOTOS', label: 'Take more photos', description: 'The AI tells you exactly what to photograph next, then re-assesses.', icon: <Camera aria-hidden="true" size={16} /> },
        { id: 'SET_ASIDE', label: 'Set aside', description: 'Shelve the box for further processing and log it to the session feed.', icon: <Archive aria-hidden="true" size={16} /> },
      ]
      const confirmLabel = selectedDisposition === 'PASS'
        ? 'Confirm: pass'
        : selectedDisposition === 'TAKE_MORE_PHOTOS'
          ? 'Confirm: take more photos'
          : selectedDisposition === 'SET_ASIDE'
            ? 'Confirm: set aside'
            : 'Pick a next step'
      actionBar = (
        <Button type="button" size="lg" className="min-w-0 flex-1"
          disabled={!selectedDisposition || dispositionMutation.isPending}
          onClick={() => selectedDisposition && dispositionMutation.mutate({ disposition: selectedDisposition })}
        >
          {dispositionMutation.isPending ? <LoaderCircle className="ws-spin" aria-hidden="true" size={18} /> : null}
          {dispositionMutation.isPending ? 'Recording…' : <>{confirmLabel} <ArrowRight aria-hidden="true" size={18} /></>}
        </Button>
      )
      if (inspection && recommendation) {
        content = (
          <>
            <div className="ws-assess-head">
              <ClassificationChip classification={inspection.classification} confidence={inspection.confidence} />
            </div>
            <p className="ws-note">
              <Sparkles aria-hidden="true" size={14} />
              {recommendation.source === 'OPERATOR_SETTING' ? 'Station setting: ' : 'AI recommends: '}
              <b>{formatToken(recommendation.disposition)}</b> — {recommendation.reason}
            </p>
            <div className="ws-options" role="radiogroup" aria-label="Next step">
              {dispositionCards.map((card) => (
                <label key={card.id} className={`ws-option${selectedDisposition === card.id ? ' ws-option--selected' : ''}`}>
                  <input
                    type="radio"
                    name="disposition"
                    value={card.id}
                    checked={selectedDisposition === card.id}
                    onChange={() => setSelectedDisposition(card.id)}
                  />
                  <span>
                    <span className="ws-option__label">
                      {recommendation.disposition === card.id ? (
                        <span className="ws-option__flag"><Star aria-hidden="true" size={11} /> Recommended</span>
                      ) : null}
                      {card.icon} {card.label}
                    </span>
                    <span className="ws-option__desc">{card.description}</span>
                    {card.id === 'TAKE_MORE_PHOTOS' && recommendation.photoInstructions.length > 0 ? (
                      <ul className="ws-option__list">
                        {recommendation.photoInstructions.map((instruction) => <li key={instruction}>{instruction}</li>)}
                      </ul>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
            {dispositionMutation.isError ? (
              <Alert variant="destructive"><AlertCircle size={15} /><AlertDescription>The disposition was not recorded. Nothing changed.</AlertDescription></Alert>
            ) : null}
            <p className="ws-note"><Sparkles aria-hidden="true" size={14} /> The recommendation follows this station&rsquo;s settings. A human confirms; the decision is logged.</p>
          </>
        )
      }
      break
    }

    case 'chooseAction': {
      topLeft = <Button type="button" size="sm" variant="ghost" onClick={() => setStep('triage')}><ArrowLeft aria-hidden="true" size={16} /> Next step</Button>
      actionBar = (
        <Button type="button" size="lg" className="min-w-0 flex-1"
          disabled={!selectedOption || draftMutation.isPending}
          onClick={() => draftForSelection()}
        >
          {draftMutation.isPending ? <LoaderCircle className="ws-spin" aria-hidden="true" size={18} /> : null}
          {draftMutation.isPending ? 'Drafting…' : <>Draft message <ArrowRight aria-hidden="true" size={18} /></>}
        </Button>
      )
      if (inspection) {
        const recommended = inspection.actionOptions.filter((option) => option.recommended)
        const others = inspection.actionOptions.filter((option) => !option.recommended)
        const phone = returnRecord?.customer.phone
        const renderOption = (option: (typeof inspection.actionOptions)[number]) => {
          const smsBlocked = option.channel === 'SMS' && !phone
          return (
            <label key={option.id} className={`ws-option${selectedOptionId === option.id ? ' ws-option--selected' : ''}`} aria-disabled={smsBlocked}>
              <input
                type="radio"
                name="next-action"
                value={option.id}
                checked={selectedOptionId === option.id}
                disabled={smsBlocked}
                onChange={() => { setSelectedOptionId(option.id); setChannel(option.channel) }}
              />
              <span>
                <span className="ws-option__label">
                  {option.recommended ? <span className="ws-option__flag"><Star aria-hidden="true" size={11} /> Recommended</span> : null}
                  {option.label}
                  <Badge className="ws-chip">{option.channel === 'SMS' ? 'Text' : 'Email'}</Badge>
                </span>
                <span className="ws-option__desc">{option.description}{smsBlocked ? ' (no phone on file)' : ''}</span>
              </span>
            </label>
          )
        }
        content = (
          <>
            <div className="ws-options" role="radiogroup" aria-label="Next action">
              {recommended.length > 0 ? <p className="ws-divider">Recommended</p> : null}
              {recommended.map(renderOption)}
              {others.length > 0 ? <p className="ws-divider">Other options</p> : null}
              {others.map(renderOption)}
            </div>
            {draftMutation.isError ? <Alert variant="destructive"><AlertCircle size={15} /><AlertDescription>Draft generation is unavailable. Nothing was sent.</AlertDescription></Alert> : null}
            {voiceCallsEnabled ? (
              <Button type="button" size="lg" variant="secondary" className="min-w-0 flex-1" onClick={startCall}>
                <Phone aria-hidden="true" size={16} /> Call the customer instead (test mode)
              </Button>
            ) : null}
            <p className="ws-note"><Sparkles aria-hidden="true" size={14} /> Options come from the server-side recommendation for {inspection.classification.replaceAll('_', ' ').toLowerCase()}. A human picks; nothing auto-executes.</p>
          </>
        )
      }
      break
    }

    case 'compose': {
      topLeft = <Button type="button" size="sm" variant="ghost" onClick={() => setStep('chooseAction')}><ArrowLeft aria-hidden="true" size={16} /> Options</Button>
      const phone = returnRecord?.customer.phone
      const canSend = Boolean(draft) && acknowledged && reviewerLabel.trim().length >= 2 && !sendMutation.isPending && !draftMutation.isPending
      actionBar = (
        <Button type="button" size="lg" className="min-w-0 flex-1" disabled={!canSend} onClick={() => sendMutation.mutate()}>
          {sendMutation.isPending ? <LoaderCircle className="ws-spin" aria-hidden="true" size={18} /> : <Send aria-hidden="true" size={18} />}
          {sendMutation.isPending ? 'Sending…' : 'Send to customer'}
        </Button>
      )
      content = (
        <>
          <div className="ws-compose-to">
            <span className="ws-sub">To: <b>{draft?.recipient ?? returnRecord?.customer.name}</b></span>
            <Tabs className="gap-0" value={channel} onValueChange={(value) => { if (value !== channel) draftForSelection(value as CommunicationChannel) }}>
              <TabsList aria-label="Channel" className="w-full sm:w-fit">
                <TabsTrigger value="EMAIL" className="flex-1 sm:flex-none" disabled={draftMutation.isPending}><Mail size={13} /> Email</TabsTrigger>
                <TabsTrigger value="SMS" className="flex-1 sm:flex-none" disabled={!phone || draftMutation.isPending}><Smartphone size={13} /> Text</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          {draftMutation.isPending || !draft ? (
            <Marker role="status">
              <MarkerIcon><LoaderCircle size={15} className="ws-spin" /></MarkerIcon>
              <MarkerContent className="shimmer">Drafting {channel === 'SMS' ? 'text' : 'email'}…</MarkerContent>
            </Marker>
          ) : (
            <>
              <Message>
                <MessageAvatar>
                  <Avatar className="size-8">
                    <AvatarFallback>AI</AvatarFallback>
                  </Avatar>
                </MessageAvatar>
                <MessageContent className="max-w-none">
                  <MessageHeader>Draft to {draft.recipient ?? returnRecord?.customer.name}</MessageHeader>
                  <Bubble variant="outline" className="ws-draft w-full max-w-none">
                    <BubbleContent>
                      {draft.subject ? <p className="ws-draft__subject">{draft.subject}</p> : null}
                      <DraftBody body={draft.body} />
                    </BubbleContent>
                  </Bubble>
                </MessageContent>
              </Message>
              <div className="ws-attachments" aria-label="Attachments">
                {draft.attachments.map((attachment) => (
                  <span key={`${attachment.label}-${attachment.url}`} className="ws-attachment"><Link2 aria-hidden="true" size={12} /> {attachment.label || attachment.role || 'attachment'}</span>
                ))}
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => draftForSelection()}>
                <RefreshCcw aria-hidden="true" size={14} /> Regenerate draft
              </Button>
              <div className="grid gap-2">
                <Label htmlFor="reviewer-label">Reviewer</Label>
                <Input id="reviewer-label" value={reviewerLabel} maxLength={100} onChange={(event) => setReviewerLabel(event.target.value)} />
              </div>
              <div className="ws-ack">
                <Checkbox
                  id="approve-as-written"
                  checked={acknowledged}
                  onCheckedChange={(checked) => setAcknowledged(checked === true)}
                />
                <Label htmlFor="approve-as-written" className="font-normal leading-snug text-foreground">
                  I reviewed the evidence, refund math, and this exact message ({<span className="ws-mono">#{draft.contentSha256.slice(0, 8)}</span>}). Approve as written.
                </Label>
              </div>
              <p className="ws-note"><Send aria-hidden="true" size={13} /> Test mode: the message queues to a delivery-disabled outbox and the return record updates. Nothing reaches a real customer.</p>
            </>
          )}
          {sendMutation.isError ? <Alert variant="destructive"><AlertCircle size={15} /><AlertDescription>Not sent: the review/outbox API is unavailable. Nothing was queued.</AlertDescription></Alert> : null}
        </>
      )
      break
    }

    case 'setAside': {
      actionBar = (
        <>
          <Button type="button" size="lg" variant="secondary" onClick={goHome} aria-label="Back to home"><House aria-hidden="true" size={17} /></Button>
          <Button type="button" size="lg" className="min-w-0 flex-1" onClick={startScan}>
            <Camera aria-hidden="true" size={18} /> Scan next return
          </Button>
        </>
      )
      const dispositionRecord = dispositionMutation.data?.record
      content = (
        <>
          <div className="ws-done-banner">
            <span className="ws-done-banner__icon ws-done-banner__icon--slate"><Archive aria-hidden="true" size={22} /></span>
            <h1 className="ws-h">Set aside &amp; logged</h1>
            <p className="ws-sub">Shelved for further processing · session feed updated</p>
          </div>
          <Card>
            <CardContent className="ws-card__section pt-4">
              <dl className="ws-kv"><dt><span className="ws-mono">{returnRecord?.rmaId}</span></dt><dd><StatusChip status="SET_ASIDE" /></dd></dl>
              <dl className="ws-kv"><dt>Reason</dt><dd>{dispositionRecord?.reason}</dd></dl>
              <dl className="ws-kv"><dt>Recorded by</dt><dd>{dispositionRecord?.recordedBy}</dd></dl>
            </CardContent>
            <CardContent className="ws-card__section">
              <Button type="button" size="sm" variant="secondary" onClick={() => window.print()}>
                <Printer aria-hidden="true" size={15} /> Print shelf tag
              </Button>
            </CardContent>
          </Card>
          {voiceCallsEnabled && suggestCallOnSetAside ? (
            <Card>
              <CardContent className="ws-card__section pt-4">
                <p className="ws-divider">Resolve it now</p>
                <p className="ws-sub">Call the customer to sort out what happened while the box is still on the bench.</p>
                <Button type="button" size="lg" className="min-w-0 flex-1" onClick={startCall}>
                  <Phone aria-hidden="true" size={16} /> Call customer now (test mode)
                </Button>
              </CardContent>
            </Card>
          ) : null}
          <section aria-label="Intake timeline">
            <p className="ws-divider">Timeline</p>
            <TimelineList entries={timeline} />
          </section>
        </>
      )
      break
    }

    case 'call': {
      const session = callSessionMutation.data
      const record = returnRecord
      topLeft = callPhase === 'logged'
        ? undefined
        : (
          <Button type="button" size="sm" variant="ghost"
            onClick={() => {
              activeCallRef.current?.end()
              setStep(selectedDisposition === 'SET_ASIDE' ? 'setAside' : 'chooseAction')
            }}
          >
            <ArrowLeft aria-hidden="true" size={16} /> Back
          </Button>
        )
      if (callPhase === 'live') {
        actionBar = (
          <>
            {session?.mode === 'OPENAI_REALTIME' ? (
              <Button type="button" size="lg" variant="secondary"
                aria-pressed={callMuted}
                aria-label={callMuted ? 'Unmute microphone' : 'Mute microphone'}
                onClick={() => {
                  const next = !callMuted
                  setCallMuted(next)
                  activeCallRef.current?.setMuted(next)
                }}
              >
                {callMuted ? <MicOff aria-hidden="true" size={17} /> : <Mic aria-hidden="true" size={17} />}
              </Button>
            ) : null}
            <Button type="button" size="lg" variant="destructive" className="min-w-0 flex-1" onClick={() => activeCallRef.current?.end()}>
              <PhoneOff aria-hidden="true" size={17} /> End call
            </Button>
          </>
        )
      } else if (callPhase === 'wrapUp') {
        actionBar = (
          <Button type="button" size="lg" className="min-w-0 flex-1"
            disabled={callOutcomeMutation.isPending}
            onClick={() => callOutcomeMutation.mutate()}
          >
            {callOutcomeMutation.isPending ? <LoaderCircle className="ws-spin" aria-hidden="true" size={18} /> : <Check aria-hidden="true" size={18} />}
            {callOutcomeMutation.isPending ? 'Recording…' : 'Record outcome & log'}
          </Button>
        )
      } else if (callPhase === 'logged') {
        actionBar = (
          <>
            <Button type="button" size="lg" variant="secondary" onClick={goHome} aria-label="Back to home"><House aria-hidden="true" size={17} /></Button>
            {callResolution === 'FOLLOW_UP_EMAIL_NEEDED' && inspection ? (
              <Button type="button" size="lg" variant="secondary" className="min-w-0 flex-1" onClick={() => setStep('chooseAction')}>
                <Mail aria-hidden="true" size={16} /> Draft follow-up
              </Button>
            ) : null}
            <Button type="button" size="lg" className="min-w-0 flex-1" onClick={startScan}>
              <Camera aria-hidden="true" size={18} /> Scan next return
            </Button>
          </>
        )
      }
      const outcomeActivity = callOutcomeMutation.data?.activity
      content = (
        <>
          <div className="ws-call-head">
            <span className={`ws-call-status${callPhase === 'live' ? ' ws-call-status--live' : ''}`}>
              <Phone aria-hidden="true" size={14} />
              {callPhase === 'connecting' ? 'Connecting…' : callPhase === 'live' ? 'On call' : callPhase === 'wrapUp' ? 'Call ended' : 'Outcome logged'}
            </span>
            <span className="ws-sub">
              {record?.customer.name} · <span className="ws-mono">{record?.customer.phone ?? 'no phone on file'}</span>
            </span>
            {session ? (
              <Badge variant="outline" className="ws-chip">
                {session.mode === 'SIMULATED' ? 'Simulated call · no OpenAI key' : `OpenAI Realtime · WebSocket · ${session.model}`}
              </Badge>
            ) : null}
          </div>
          <p className="ws-note"><Phone aria-hidden="true" size={13} /> Test mode: no real telephone call is placed and no real customer is contacted.</p>
          {callSessionMutation.isPending ? (
            <div className="ws-progress">
              <div className="ws-progress__row ws-progress__row--active">
                <span className="ws-progress__mark" aria-hidden="true"><LoaderCircle size={15} className="ws-spin" /></span>
                Preparing the call session…
              </div>
            </div>
          ) : null}
          {callSessionMutation.isError ? (
            <Alert variant="destructive"><AlertCircle size={15} /><AlertDescription>The call session could not be prepared. Nothing was recorded.</AlertDescription></Alert>
          ) : null}
          {callError ? <Alert variant="destructive"><AlertCircle size={15} /><AlertDescription>{callError}</AlertDescription></Alert> : null}
          {callTranscript.length > 0 ? (
            <MessageScroller className="ws-call-transcript" aria-label="Live transcript" aria-live="polite">
              <MessageScrollerViewport>
                <MessageScrollerContent>
                  {callTranscript.map((entry) => <CallTurn key={entry.id} entry={entry} />)}
                </MessageScrollerContent>
              </MessageScrollerViewport>
            </MessageScroller>
          ) : callPhase === 'live' ? (
            <Marker role="status">
              <MarkerIcon><LoaderCircle size={15} className="ws-spin" /></MarkerIcon>
              <MarkerContent className="shimmer">Waiting for the first words…</MarkerContent>
            </Marker>
          ) : null}
          {callPhase === 'wrapUp' ? (
            <Card>
              <CardContent className="ws-card__section pt-4">
                <p className="ws-divider">Call outcome</p>
                <div className="ws-options" role="radiogroup" aria-label="Call outcome">
                  {callResolutionOptions.map((option) => (
                    <label key={option.id} className={`ws-option${callResolution === option.id ? ' ws-option--selected' : ''}`}>
                      <input
                        type="radio"
                        name="call-resolution"
                        value={option.id}
                        checked={callResolution === option.id}
                        onChange={() => setCallResolution(option.id)}
                      />
                      <span>
                        <span className="ws-option__label">{option.label}</span>
                        <span className="ws-option__desc">{option.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="call-note">Note (optional)</Label>
                  <Input
                    id="call-note"
                    value={callNote}
                    maxLength={400}
                    placeholder="e.g. customer will ship the second unit this week"
                    onChange={(event) => setCallNote(event.target.value)}
                  />
                </div>
                {callOutcomeMutation.isError ? (
                  <Alert variant="destructive"><AlertCircle size={15} /><AlertDescription>The outcome was not recorded. Try again.</AlertDescription></Alert>
                ) : null}
                <p className="ws-note"><Sparkles aria-hidden="true" size={13} /> Recording the outcome triggers the MCP tools: the call log persists and the return record status updates.</p>
              </CardContent>
            </Card>
          ) : null}
          {callPhase === 'logged' && outcomeActivity ? (
            <Card>
              <CardContent className="ws-card__section pt-4">
                <dl className="ws-kv"><dt><span className="ws-mono">{record?.rmaId}</span></dt><dd><StatusChip status={outcomeActivity.resolutionStatus} /></dd></dl>
                <dl className="ws-kv"><dt>Call</dt><dd className="ws-mono">{callOutcomeMutation.data?.call.callId}</dd></dl>
                <dl className="ws-kv"><dt>Duration</dt><dd className="ws-mono">{callOutcomeMutation.data?.call.durationSeconds}s</dd></dl>
                <dl className="ws-kv"><dt>Transcript digest</dt><dd className="ws-mono">{callOutcomeMutation.data?.call.transcriptSha256.slice(0, 16)}…</dd></dl>
              </CardContent>
            </Card>
          ) : null}
          {callPhase === 'logged' ? (
            <section aria-label="Intake timeline">
              <p className="ws-divider">Timeline</p>
              <TimelineList entries={timeline} />
            </section>
          ) : null}
        </>
      )
      break
    }

    case 'done': {
      actionBar = (
        <>
          <Button type="button" size="lg" variant="secondary" onClick={goHome} aria-label="Back to home"><House aria-hidden="true" size={17} /></Button>
          <Button type="button" size="lg" className="min-w-0 flex-1" onClick={startScan}>
            <Camera aria-hidden="true" size={18} /> Scan next return
          </Button>
        </>
      )
      content = (
        <>
          <div className="ws-done-banner">
            <span className="ws-done-banner__icon"><Check aria-hidden="true" size={22} /></span>
            <h1 className="ws-h">Queued &amp; logged</h1>
            <p className="ws-sub">Delivery-disabled test outbox · no real customer contacted</p>
          </div>
          <Card>
            <CardContent className="ws-card__section pt-4">
              <dl className="ws-kv"><dt><span className="ws-mono">{returnRecord?.rmaId}</span></dt><dd>{resolutionStatus ? <StatusChip status={resolutionStatus} /> : null}</dd></dl>
              <dl className="ws-kv"><dt>Action</dt><dd>{selectedOption?.label}</dd></dl>
              <dl className="ws-kv"><dt>Message</dt><dd className="ws-mono">{sendMutation.data?.queue.messageId ?? 'queued'}</dd></dl>
              <dl className="ws-kv"><dt>Review</dt><dd className="ws-mono">{sendMutation.data?.review.reviewId}</dd></dl>
            </CardContent>
            <CardContent className="ws-card__section">
              <Button type="button" size="sm" variant="secondary" onClick={() => window.print()}>
                <Printer aria-hidden="true" size={15} /> Print shelf tag
              </Button>
            </CardContent>
          </Card>
          <section aria-label="Intake timeline">
            <p className="ws-divider">Timeline</p>
            <TimelineList entries={timeline} />
          </section>
        </>
      )
      break
    }

    default: {
      const exhaustive: never = step
      content = exhaustive
    }
  }

  const rail = step === 'home' ? (
    <Card>
      <CardContent className="ws-card__section pt-4">
        <p className="ws-divider">Activity</p>
        <ActivityList records={activity} pending={activityQuery.isPending} />
      </CardContent>
    </Card>
  ) : (
    <Card>
      <CardContent className="ws-card__section pt-4">
        <p className="ws-divider">This intake</p>
        {timeline.length > 0 ? <TimelineList entries={timeline} /> : <p className="ws-activity__empty">Steps log here as they complete</p>}
      </CardContent>
    </Card>
  )

  const handleLogout = () => {
    void logoutOperator().finally(() => navigate('/login', { replace: true }))
  }

  const homeTopRight = (
    <>
      <span className="ws-operator">{operator?.displayName ?? 'Operator'}</span>
      <Button type="button" variant="ghost" size="icon" onClick={() => navigate('/settings')} aria-label="Station settings"><Settings size={16} /></Button>
      <Button type="button" variant="ghost" size="icon" onClick={handleLogout} aria-label="Log out"><LogOut size={16} /></Button>
    </>
  )

  return (
    <WorkstationShell
      withTabs={!scanning}
      scanMode={scanning}
      topLeft={topLeft}
      topRight={step === 'home' ? homeTopRight : <StepIndicator current={flowIndicator(step)} />}
      actionBar={actionBar}
      rail={rail}
    >
      <input ref={labelInputRef} className="ws-hidden-input" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={onFileInput('label')} aria-label="Capture return label photo" />
      <input ref={contentsInputRef} className="ws-hidden-input" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={onFileInput('contents')} aria-label="Capture package contents photo" />
      {content}
    </WorkstationShell>
  )
}
