import { useQuery } from '@tanstack/react-query'
import { Bot, Box, Camera, Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, LoaderCircle, PackageOpen, Ruler, ScanBarcode, Scale, ShieldCheck, Warehouse } from 'lucide-react'
import { type KeyboardEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { LiveDecisionOutput } from '../components/LiveDecisionOutput'
import { Badge, PageIntro } from '../components/ui'
import { checkpoints, formatStatus, type DemoState } from '../domain'
import { evaluateCheckpoint } from '../lib/api'
import { useDemo } from '../lib/demo-context'

const evidenceImages = [
  { src: '/evidence/return-empty-box.png', label: 'Open mailer · Empty', view: 'Camera 02' },
  { src: '/evidence/outbound-two-bodysuits.png', label: 'Outbound reference', view: 'Pack station' },
]

const protocol = [
  { label: 'Scan inbound label', value: 'RMA-8821 · matched', icon: ScanBarcode },
  { label: 'Capture sealed mailer', value: '2 views · complete', icon: Camera },
  { label: 'Record calibrated weight', value: '0.04 kg · scale S-14', icon: Scale },
  { label: 'Record dimensions', value: '30 × 25 × 2 cm', icon: Ruler },
  { label: 'Capture unpack sequence', value: '6 frames · complete', icon: PackageOpen },
  { label: 'Scan hang tag & qty', value: 'No garment observed · qty 0', icon: ClipboardCheck },
]

const findingOptions = ['empty', 'decoy', 'wrong-item', 'possible-imitation', 'quantity-mismatch', 'inconclusive'] as const

export function OperatorPage() {
  const { state, update } = useDemo()
  const [imageIndex, setImageIndex] = useState(0)
  const [finding, setFinding] = useState<DemoState['physicalFinding'] | null>(state.physical === 'inspection-hold' ? null : state.physicalFinding)
  const [operatorConfirmed, setOperatorConfirmed] = useState(false)
  const inspectionCheckpoint = checkpoints.find((point) => point.id === 'ITEM_INSPECTION')!
  const assessment = useQuery({
    queryKey: ['evaluate-checkpoint', inspectionCheckpoint.id, finding ?? 'unselected'],
    queryFn: () => {
      if (!finding) throw new Error('Select a native finding before requesting an assessment.')
      return evaluateCheckpoint(inspectionCheckpoint, { ...state, physicalFinding: finding })
    },
    enabled: false,
  })

  const finalize = () => {
    if (!operatorConfirmed || !finding) return
    update({ physical: 'review-pending', physicalFinding: finding })
  }
  const selectFinding = (next: DemoState['physicalFinding']) => {
    setFinding(next)
    setOperatorConfirmed(false)
  }
  const moveFindingFocus = (event: KeyboardEvent<HTMLButtonElement>, current: DemoState['physicalFinding']) => {
    const index = findingOptions.indexOf(current)
    let nextIndex = index
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % findingOptions.length
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + findingOptions.length) % findingOptions.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = findingOptions.length - 1
    if (nextIndex === index) return
    event.preventDefault()
    const next = findingOptions[nextIndex]
    selectFinding(next)
    document.getElementById(`finding-${next}`)?.focus()
  }

  return (
    <div className="page operator-page">
      <PageIntro eyebrow="MANAGED VERIFY · CAPTURE REVIEW" title={<>Review the capture. <em>Record only what you see.</em></>} description="This synthetic station starts after the six-step warehouse capture is complete. Confirm a neutral native observation before requesting any model assessment or routing the case to a merchant." actions={<Badge tone="violet" icon={Warehouse}>Station DEN-04 · Synthetic fixture</Badge>} />

      <div className="operator-header">
        <Link className="operator-back" to="/legacy"><ChevronLeft aria-hidden="true" /> Dashboard</Link>
        <div><Badge tone="blue">RMA-8821</Badge><strong>Fits Everybody Cami Bodysuit · Order SK-1042</strong><span>Expected: 2 pieces · Onyx · sizes M and L · 0.38 kg</span></div>
        <div className="operator-progress"><small>Protocol</small><strong>6 / 6</strong><span><i style={{ width: '100%' }} /></span></div>
      </div>

      <div className="operator-layout">
        <section className="capture-viewer">
          <header><div>COMPLETED CAPTURE RECORD</div><Badge tone="violet">SYNTHETIC FIXTURE</Badge></header>
          <figure>
            <img src={evidenceImages[imageIndex].src} alt={`Synthetic fixture: ${evidenceImages[imageIndex].label}`} />
            <figcaption><span>{evidenceImages[imageIndex].view}</span><strong>{evidenceImages[imageIndex].label}</strong><small>Aug 24, 2026 · 14:14:08.422 · fixture checksum logged</small></figcaption>
            <button className="viewer-control viewer-control--left" aria-label="Previous evidence image" onClick={() => setImageIndex((current) => (current - 1 + evidenceImages.length) % evidenceImages.length)}><ChevronLeft /></button>
            <button className="viewer-control viewer-control--right" aria-label="Next evidence image" onClick={() => setImageIndex((current) => (current + 1) % evidenceImages.length)}><ChevronRight /></button>
          </figure>
          <div className="thumbnail-strip">
            {evidenceImages.map((image, index) => <button key={image.src} className={imageIndex === index ? 'active' : ''} aria-label={`View ${image.label}`} onClick={() => setImageIndex(index)}><img src={image.src} alt="" /><span>{index + 1}</span></button>)}
          </div>
          <p className="fixture-disclosure"><ShieldCheck size={15} aria-hidden="true" /><strong>Privacy-safe demo:</strong> all shown imagery is synthetic and bound to RMA-8821. No customer upload or production analysis occurs on this surface.</p>
        </section>

        <aside className="protocol-panel">
          <header><div><span className="eyebrow">CAPTURE PROTOCOL v1.3</span><h2>Evidence checklist</h2></div><Badge tone="green" icon={Check}>Complete</Badge></header>
          <ol>{protocol.map(({ label, value, icon: Icon }, index) => <li key={label}><span className="protocol-index"><Check size={13} /></span><Icon aria-hidden="true" /><div><strong>{label}</strong><span>{value}</span></div><small>0{index + 1}</small></li>)}</ol>
          <div className="calibration-card"><Scale aria-hidden="true" /><div><strong>Scale S-14 calibrated</strong><span>50 g / 2 kg checks passed at 13:58 · valid through 17:58</span></div></div>
        </aside>
      </div>

      <section className="inspection-workbench">
        <div className="inspection-finding">
          <span className="eyebrow">OPERATOR FINDING</span>
          <h2>What was physically observed?</h2>
          <div className="finding-options" role="radiogroup" aria-label="Inspection finding">
            {findingOptions.map((option) => <button id={`finding-${option}`} role="radio" aria-checked={finding === option} tabIndex={finding === option || (!finding && option === 'empty') ? 0 : -1} className={finding === option ? 'active' : ''} key={option} onClick={() => selectFinding(option)} onKeyDown={(event) => moveFindingFocus(event, option)}><span>{finding === option ? <Check /> : null}</span>{formatStatus(option)}</button>)}
          </div>
          <div className="operator-observation"><Box aria-hidden="true" /><div><strong>Structured observation</strong><p>{!finding ? 'No discrepancy classification is selected. Review the capture record, then choose the observation that the images and native measurements support.' : finding === 'empty' ? 'No garment observed after a complete six-frame unpacking sequence. Outer mailer and RMA label are present. Expected quantity 2 pieces; observed quantity 0.' : `${formatStatus(finding)} selected. This finding remains an operator observation until confirmed and routed to merchant review.`}</p></div></div>
          <label className="checkbox-label checkbox-label--boxed"><input type="checkbox" checked={operatorConfirmed} disabled={!finding} onChange={(event) => setOperatorConfirmed(event.target.checked)} /><span>I reviewed the completed capture protocol and confirm this describes what I observed. I am not making the refund decision.</span></label>
          <button className="button button--primary" disabled={!operatorConfirmed || !finding} onClick={finalize}><ClipboardCheck size={17} /> Confirm finding & route to merchant</button>
        </div>

        <div className="vision-panel">
          <header>
            <span><Bot aria-hidden="true" /><strong>OpenAI vision support</strong></span>
            {assessment.data
              ? <Badge tone={assessment.data.mode === 'live' ? 'green' : assessment.data.mode === 'unavailable' ? 'orange' : 'violet'}>{assessment.data.mode === 'live' ? 'LIVE OPENAI' : assessment.data.mode === 'unavailable' ? 'MODEL UNAVAILABLE' : 'SIMULATED FALLBACK'}</Badge>
              : <Badge tone="neutral">{assessment.isFetching ? 'RUNNING' : 'NOT RUN'}</Badge>}
          </header>
          <LiveDecisionOutput assessment={assessment.data} pending={assessment.isFetching} />
          <button className="button button--secondary" disabled={!finding || !operatorConfirmed || assessment.isFetching} onClick={() => assessment.refetch()}>
            {assessment.isFetching ? <LoaderCircle className="spin" /> : <Bot />}
            {assessment.isFetching ? 'Analyzing evidence…' : !finding ? 'Select a native finding first' : !operatorConfirmed ? 'Confirm the observation first' : assessment.data ? 'Run assessment again' : 'Run evidence assessment'}
          </button>
        </div>
      </section>

      {state.physical === 'review-pending' ? <div className="route-confirmation" role="status"><CheckCircle2 aria-hidden="true" /><div><strong>Finding routed to merchant review</strong><span>Refund remains on a reversible hold. The shopper’s contest path is ready; no adverse decision has been made.</span></div><Badge tone="blue">HUMAN REVIEW</Badge></div> : null}
    </div>
  )
}
