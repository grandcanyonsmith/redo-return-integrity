import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, Bot, Box, Camera, Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, FileCheck2, LoaderCircle, PackageOpen, Ruler, ScanBarcode, Scale, ShieldCheck, Upload, Warehouse } from 'lucide-react'
import { useState } from 'react'
import { Badge, PageIntro } from '../components/ui'
import { checkpoints, formatStatus, type DemoState } from '../domain'
import { evaluateCheckpoint } from '../lib/api'
import { useDemo } from '../lib/demo-context'

const evidenceImages = [
  { src: '/evidence/return-empty-box.png', label: 'Open container · Empty', view: 'Camera 02' },
  { src: '/evidence/outbound-two-cameras.png', label: 'Outbound reference', view: 'Pack station' },
  { src: '/evidence/return-wrong-item.png', label: 'Wrong-item fixture', view: 'Camera 02' },
  { src: '/evidence/return-imitation.png', label: 'Imitation fixture', view: 'Inspection mat' },
]

const protocol = [
  { label: 'Scan inbound label', value: 'RMA-8821 · matched', icon: ScanBarcode },
  { label: 'Capture sealed parcel', value: '2 views · complete', icon: Camera },
  { label: 'Record calibrated weight', value: '0.18 kg · scale S-14', icon: Scale },
  { label: 'Record dimensions', value: '31 × 24 × 12 cm', icon: Ruler },
  { label: 'Capture unpack sequence', value: '6 frames · complete', icon: PackageOpen },
  { label: 'Scan item serial & qty', value: 'No item observed · qty 0', icon: ClipboardCheck },
]

export function OperatorPage() {
  const { state, update } = useDemo()
  const [imageIndex, setImageIndex] = useState(0)
  const [finding, setFinding] = useState<DemoState['physicalFinding']>(state.physicalFinding)
  const [operatorConfirmed, setOperatorConfirmed] = useState(false)
  const inspectionCheckpoint = checkpoints.find((point) => point.id === 'ITEM_INSPECTION')!
  const assessment = useMutation({ mutationFn: () => evaluateCheckpoint(inspectionCheckpoint, { ...state, physicalFinding: finding }) })

  const finalize = () => {
    if (!operatorConfirmed) return
    update({ physical: 'review-pending', physicalFinding: finding })
  }

  return (
    <div className="page operator-page">
      <PageIntro eyebrow="MANAGED VERIFY · OPERATOR STATION" title={<>Capture once. <em>Trust the record.</em></>} description="A guided warehouse workflow creates controlled, reproducible ground truth for empty, decoy, wrong-item, possible-imitation, and quantity-mismatch returns." actions={<Badge tone="orange" icon={Warehouse}>Station DEN-04 · Online</Badge>} />

      <div className="operator-header">
        <button><ChevronLeft aria-hidden="true" /> Queue</button>
        <div><Badge tone="blue">RMA-8821</Badge><strong>Juniper Arc One · Order JC-1042</strong><span>Expected: 2 cameras · 1.80 kg · Serials JCA1-88K2 / JCA1-91M7</span></div>
        <div className="operator-progress"><small>Protocol</small><strong>6 / 6</strong><span><i style={{ width: '100%' }} /></span></div>
      </div>

      <div className="operator-layout">
        <section className="capture-viewer">
          <header><div><span className="live-dot" /> LIVE CAPTURE REVIEW</div><Badge tone="violet">SYNTHETIC FIXTURE</Badge></header>
          <figure>
            <img src={evidenceImages[imageIndex].src} alt={`Synthetic fixture: ${evidenceImages[imageIndex].label}`} />
            <figcaption><span>{evidenceImages[imageIndex].view}</span><strong>{evidenceImages[imageIndex].label}</strong><small>Aug 24, 2026 · 14:14:08.422 · fixture checksum logged</small></figcaption>
            <button className="viewer-control viewer-control--left" aria-label="Previous evidence image" onClick={() => setImageIndex((current) => (current - 1 + evidenceImages.length) % evidenceImages.length)}><ChevronLeft /></button>
            <button className="viewer-control viewer-control--right" aria-label="Next evidence image" onClick={() => setImageIndex((current) => (current + 1) % evidenceImages.length)}><ChevronRight /></button>
          </figure>
          <div className="thumbnail-strip">
            {evidenceImages.map((image, index) => <button key={image.src} className={imageIndex === index ? 'active' : ''} aria-label={`View ${image.label}`} onClick={() => setImageIndex(index)}><img src={image.src} alt="" /><span>{index + 1}</span></button>)}
            <label className="thumbnail-upload" title="Local fixture selection only — not uploaded"><Upload aria-hidden="true" /><span>Local only</span><input type="file" accept="image/jpeg,image/png,image/webp" /></label>
          </div>
          <p className="fixture-disclosure"><ShieldCheck size={15} aria-hidden="true" /><strong>Privacy-safe demo:</strong> all shown imagery is synthetic. Optional file selection stays local and is not analyzed or transmitted.</p>
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
            {(['empty', 'decoy', 'wrong-item', 'possible-imitation', 'quantity-mismatch', 'inconclusive'] as const).map((option) => <button role="radio" aria-checked={finding === option} className={finding === option ? 'active' : ''} key={option} onClick={() => { setFinding(option); setOperatorConfirmed(false); assessment.reset() }}><span>{finding === option ? <Check /> : null}</span>{formatStatus(option)}</button>)}
          </div>
          <div className="operator-observation"><Box aria-hidden="true" /><div><strong>Structured observation</strong><p>{finding === 'empty' ? 'No merchandise observed after a complete six-frame unpacking sequence. Outer packaging and RMA label are present. Expected quantity 2 cameras; observed quantity 0.' : `${formatStatus(finding)} selected. This finding remains an operator observation until confirmed and routed to merchant review.`}</p></div></div>
          <label className="checkbox-label checkbox-label--boxed"><input type="checkbox" checked={operatorConfirmed} onChange={(event) => setOperatorConfirmed(event.target.checked)} /><span>I completed the required capture protocol and confirm this describes what I observed. I am not making the refund decision.</span></label>
          <button className="button button--primary" disabled={!operatorConfirmed} onClick={finalize}><ClipboardCheck size={17} /> Confirm finding & route to merchant</button>
        </div>

        <div className="vision-panel">
          <header><span><Bot aria-hidden="true" /><strong>OpenAI vision support</strong></span>{assessment.data ? <Badge tone={assessment.data.mode === 'live' ? 'green' : assessment.data.mode === 'unavailable' ? 'orange' : 'violet'}>{assessment.data.mode === 'live' ? 'LIVE OPENAI' : assessment.data.mode === 'unavailable' ? 'MODEL UNAVAILABLE' : 'SIMULATED FALLBACK'}</Badge> : <Badge tone="neutral">NOT RUN</Badge>}</header>
          {!assessment.data ? <div className="vision-empty"><div className="vision-empty__scan"><Camera aria-hidden="true" /></div><h3>Compare images with the order record</h3><p>The model can describe contents, count visible items, read labels, compare form factors, and cite frames. It cannot declare fraud or execute a refund decision.</p><button className="button button--secondary" disabled={assessment.isPending} onClick={() => assessment.mutate()}>{assessment.isPending ? <LoaderCircle className="spin" /> : <Bot />} {assessment.isPending ? 'Analyzing evidence…' : 'Run multimodal assessment'}</button></div> : <div className="vision-result"><div className="vision-result__headline"><AlertTriangle aria-hidden="true" /><div><small>RECOMMENDATION ONLY</small><h3>{assessment.data.recommendation.replaceAll('_', ' ')}</h3></div></div><p>{assessment.data.summary}</p><div className="vision-result__facts"><span><strong>Quantity visible</strong>0 of 2</span><span><strong>Serials legible</strong>No</span><span><strong>Image sufficiency</strong>Complete</span></div><small><FileCheck2 size={13} /> Evidence: {assessment.data.evidenceIds.join(', ')} · No action executed</small></div>}
        </div>
      </section>

      {state.physical === 'review-pending' ? <div className="route-confirmation" role="status"><CheckCircle2 aria-hidden="true" /><div><strong>Finding routed to merchant review</strong><span>Refund remains on a reversible hold. The shopper’s contest path is ready; no adverse decision has been made.</span></div><Badge tone="blue">HUMAN REVIEW</Badge></div> : null}
    </div>
  )
}
