import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Fingerprint,
  FlaskConical,
  Gauge,
  GitBranch,
  Info,
  Mail,
  MessageSquareText,
  PackageCheck,
  PackageOpen,
  RefreshCw,
  RotateCcw,
  ScanBarcode,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  Upload,
  UserCheck,
  Warehouse,
  Weight,
  type LucideIcon,
} from 'lucide-react'
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge } from '../components/ui'
import './tools-page.css'

type GroupId = 'operations' | 'shopper' | 'merchant' | 'intelligence'

type DemoId =
  | 'scan-return'
  | 'inspect-contents'
  | 'grade-route'
  | 'ground-truth'
  | 'checkout-challenge'
  | 'return-handoff'
  | 'contest-appeal'
  | 'review-evidence'
  | 'set-refund'
  | 'approve-message'
  | 'decision-map'
  | 'evaluation-lab'
  | 'value-model'

type DemoDefinition = {
  id: DemoId
  label: string
  description: string
  icon: LucideIcon
  fullPath: string
  fullLabel: string
}

type DemoGroup = {
  id: GroupId
  label: string
  headline: string
  demos: DemoDefinition[]
}

const groups: DemoGroup[] = [
  {
    id: 'operations',
    label: 'Operations',
    headline: 'Verify every physical return.',
    demos: [
      { id: 'scan-return', label: 'Scan return label', description: 'Extract and resolve the RMA', icon: ScanBarcode, fullPath: '/legacy/intake', fullLabel: 'Open live intake' },
      { id: 'inspect-contents', label: 'Inspect package', description: 'Compare contents with the SKU', icon: PackageOpen, fullPath: '/legacy/intake', fullLabel: 'Open vision workflow' },
      { id: 'grade-route', label: 'Grade & route', description: 'Choose disposition and owner', icon: Warehouse, fullPath: '/legacy/operator', fullLabel: 'Open warehouse view' },
      { id: 'ground-truth', label: 'Record ground truth', description: 'Write a verified outcome label', icon: FileCheck2, fullPath: '/legacy/operator', fullLabel: 'Open evidence station' },
    ],
  },
  {
    id: 'shopper',
    label: 'Shopper',
    headline: 'Give good shoppers a way through.',
    demos: [
      { id: 'checkout-challenge', label: 'Clear checkout', description: 'Choose a low-friction check', icon: Fingerprint, fullPath: '/legacy/shopper?journey=checkout', fullLabel: 'Open checkout journey' },
      { id: 'return-handoff', label: 'Resolve handoff', description: 'Correct impossible logistics', icon: Truck, fullPath: '/legacy/shopper?journey=return', fullLabel: 'Open return journey' },
      { id: 'contest-appeal', label: 'Contest a finding', description: 'Add context before settlement', icon: MessageSquareText, fullPath: '/legacy/shopper?journey=appeal', fullLabel: 'Open appeal journey' },
    ],
  },
  {
    id: 'merchant',
    label: 'Merchant',
    headline: 'Turn evidence into accountable action.',
    demos: [
      { id: 'review-evidence', label: 'Review evidence', description: 'Compare expected and observed', icon: Store, fullPath: '/legacy/merchant', fullLabel: 'Open merchant console' },
      { id: 'set-refund', label: 'Set resolution', description: 'Apply policy-safe refund math', icon: CircleDollarSign, fullPath: '/legacy/merchant', fullLabel: 'Open decision workspace' },
      { id: 'approve-message', label: 'Approve message', description: 'Review email or SMS before queue', icon: Mail, fullPath: '/legacy/intake', fullLabel: 'Open communication review' },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    headline: 'Measure what the model really changed.',
    demos: [
      { id: 'decision-map', label: 'Decision lifecycle', description: 'Inspect every evidence checkpoint', icon: GitBranch, fullPath: '/legacy/lifecycle', fullLabel: 'Open 15-stage map' },
      { id: 'evaluation-lab', label: 'Evaluation lab', description: 'Balance detection and friction', icon: FlaskConical, fullPath: '/legacy/lab', fullLabel: 'Open evaluation lab' },
      { id: 'value-model', label: 'Prevented value', description: 'Separate prevented and recovered', icon: BarChart3, fullPath: '/legacy', fullLabel: 'Open operations dashboard' },
    ],
  },
]

const isGroupId = (value: string | null): value is GroupId => groups.some((group) => group.id === value)

const inspectionScenarios = {
  match: {
    label: 'Complete return',
    image: '/evidence/return-matching-contents.png',
    classification: 'MATCH',
    observed: '2 of 2',
    action: 'Continue to full-refund review',
    amount: '$116.00',
    tone: 'green' as const,
  },
  empty: {
    label: 'Empty box',
    image: '/evidence/return-empty-box.png',
    classification: 'EMPTY_BOX',
    observed: '0 of 2',
    action: 'Hold refund and request review',
    amount: '$116.00 withheld',
    tone: 'orange' as const,
  },
  quantity: {
    label: 'Quantity mismatch',
    image: '/evidence/return-quantity-mismatch.png',
    classification: 'QUANTITY_MISMATCH',
    observed: '1 of 2',
    action: 'Review a one-unit partial refund',
    amount: '$58.00 refund',
    tone: 'blue' as const,
  },
  wrong: {
    label: 'Wrong product',
    image: '/evidence/return-wrong-item.png',
    classification: 'WRONG_PRODUCT',
    observed: '0 matching',
    action: 'Hold and request shopper context',
    amount: '$116.00 withheld',
    tone: 'red' as const,
  },
}

type InspectionScenario = keyof typeof inspectionScenarios

const checkpoints = [
  { label: 'Checkout', signal: 'New address + high order value', owner: 'Policy orchestration', action: 'Offer reversible challenge' },
  { label: 'Return request', signal: 'Reason, quantity, history, policy', owner: 'Returns policy', action: 'Approve, hold, or request evidence' },
  { label: 'Carrier handoff', signal: 'Scan timing and route feasibility', owner: 'Logistics', action: 'Continue, trace, or request receipt' },
  { label: 'Warehouse', signal: 'Weight, photos, count, variant SKU, tag', owner: 'Operations', action: 'Grade, quarantine, or corroborate' },
  { label: 'Settlement', signal: 'Evidence + policy + human record', owner: 'Merchant reviewer', action: 'Refund, adjust, or contest' },
]

function StageRail({ labels, active }: { labels: string[]; active: number }) {
  return (
    <ol className="tools-stage-rail" aria-label="Demo progress">
      {labels.map((label, index) => (
        <li key={label} className={index < active ? 'complete' : index === active ? 'active' : ''} aria-current={index === active ? 'step' : undefined}>
          <span>{index < active ? <Check aria-hidden="true" /> : index + 1}</span>
          <small>{label}</small>
          <em className="sr-only">{index < active ? 'Completed step' : index === active ? 'Current step' : 'Upcoming step'}</em>
        </li>
      ))}
    </ol>
  )
}

function DemoStatus({ children }: { children: ReactNode }) {
  return <div className="tools-live-status" role="status" aria-live="polite">{children}</div>
}

export function ToolsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const demoViewportRef = useRef<HTMLDivElement>(null)
  const inspectionResultRef = useRef<HTMLDivElement>(null)
  const focusNextDemoRef = useRef(false)
  const [showInfo, setShowInfo] = useState(false)
  const [labelResolved, setLabelResolved] = useState(false)
  const [inspectionScenario, setInspectionScenario] = useState<InspectionScenario>('empty')
  const [inspectionComplete, setInspectionComplete] = useState(false)
  const [grade, setGrade] = useState<'restock' | 'quarantine' | 'manual' | null>(null)
  const [groundTruthWritten, setGroundTruthWritten] = useState(false)
  const [checkoutMethod, setCheckoutMethod] = useState<'email' | 'bank' | 'support' | null>(null)
  const [handoffResolved, setHandoffResolved] = useState(false)
  const [appealText, setAppealText] = useState('I used the same carton for two returns and can provide both staffed drop-off receipts.')
  const [appealSubmitted, setAppealSubmitted] = useState(false)
  const [evidenceReviewed, setEvidenceReviewed] = useState(false)
  const [resolution, setResolution] = useState<'full' | 'partial' | 'hold'>('hold')
  const [resolutionRecorded, setResolutionRecorded] = useState(false)
  const [channel, setChannel] = useState<'email' | 'sms'>('email')
  const [messageApproved, setMessageApproved] = useState(false)
  const [checkpointIndex, setCheckpointIndex] = useState(3)
  const [threshold, setThreshold] = useState(65)
  const [returnVolume, setReturnVolume] = useState(20)

  const requestedGroupId = searchParams.get('category')
  const groupId: GroupId = isGroupId(requestedGroupId) ? requestedGroupId : 'operations'
  const activeGroup = groups.find((group) => group.id === groupId) ?? groups[0]
  const activeDemo = activeGroup.demos.find((demo) => demo.id === searchParams.get('demo')) ?? activeGroup.demos[0]
  const scenario = inspectionScenarios[inspectionScenario]

  useEffect(() => {
    if (focusNextDemoRef.current) {
      focusNextDemoRef.current = false
      demoViewportRef.current?.focus()
    }
  }, [activeDemo.id])

  useEffect(() => {
    if (inspectionComplete) inspectionResultRef.current?.focus()
  }, [inspectionComplete])

  const selectDemo = (nextDemoId: DemoId, nextGroupId = groupId) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('category', nextGroupId)
    nextParams.set('demo', nextDemoId)
    setSearchParams(nextParams, { replace: true })
    setShowInfo(false)
  }

  const chooseGroup = (nextGroup: DemoGroup) => {
    selectDemo(nextGroup.demos[0].id, nextGroup.id)
  }

  const continueToDemo = (nextDemoId: DemoId) => {
    focusNextDemoRef.current = true
    selectDemo(nextDemoId)
  }

  const moveGroupFocus = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex = currentIndex
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % groups.length
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + groups.length) % groups.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = groups.length - 1
    if (nextIndex === currentIndex) return
    event.preventDefault()
    chooseGroup(groups[nextIndex])
    document.getElementById(`tools-group-${groups[nextIndex].id}`)?.focus()
  }

  const resetDemo = () => {
    setLabelResolved(false)
    setInspectionScenario('empty')
    setInspectionComplete(false)
    setGrade(null)
    setGroundTruthWritten(false)
    setCheckoutMethod(null)
    setHandoffResolved(false)
    setAppealText('I used the same carton for two returns and can provide both staffed drop-off receipts.')
    setAppealSubmitted(false)
    setEvidenceReviewed(false)
    setResolution('hold')
    setResolutionRecorded(false)
    setChannel('email')
    setMessageApproved(false)
    setCheckpointIndex(3)
    setThreshold(65)
    setReturnVolume(20)
  }

  const renderDemo = () => {
    switch (activeDemo.id) {
      case 'scan-return':
        return (
          <>
            <StageRail labels={['Capture', 'Resolve', 'Inspect']} active={labelResolved ? 1 : 0} />
            <div className="tools-demo-centered">
              <div className="tools-demo-heading"><Badge tone="violet">SIMULATED LOOKUP · LIVE PATH AVAILABLE</Badge><h3>{labelResolved ? 'Return preview found.' : 'Scan or photograph the return label'}</h3><p>{labelResolved ? 'This browser-local preview populated the same fields returned by the seeded DynamoDB record.' : 'This compact demo previews the evidence contract without calling AWS or OpenAI. Open live intake for the connected workflow.'}</p></div>
              <div className="tools-label-lookup">
                <figure><img src="/evidence/return-label-rma-8821.png" alt="Synthetic return label for demo RMA 8821" /><figcaption>Synthetic label · no real shopper data</figcaption></figure>
                <div className="tools-label-fields">
                  <span><small>RMA</small><strong>{labelResolved ? 'RMA-8821' : 'Waiting for extraction'}</strong></span>
                  <span><small>Order</small><strong>{labelResolved ? 'SK-1042' : '—'}</strong></span>
                  <span><small>Tracking</small><strong>{labelResolved ? '1Z-REDO-8821' : '—'}</strong></span>
                  <button type="button" className="button button--primary" onClick={() => setLabelResolved(true)} disabled={labelResolved}><ScanBarcode size={17} aria-hidden="true" /> {labelResolved ? 'Preview complete' : 'Preview label lookup'}</button>
                </div>
              </div>
              {labelResolved ? <DemoStatus><CheckCircle2 aria-hidden="true" /><span><strong>Fits Everybody Cami Bodysuit · 2 pieces</strong>Requested and eligible refund: $116.00</span><button type="button" aria-label="Continue from label lookup to inspect package" onClick={() => continueToDemo('inspect-contents')}>Inspect package <ArrowRight aria-hidden="true" /></button></DemoStatus> : null}
            </div>
          </>
        )

      case 'inspect-contents':
        return (
          <>
            <StageRail labels={['Evidence', 'Analyze', 'Recommend']} active={inspectionComplete ? 2 : 1} />
            <div className="tools-demo-centered tools-demo-centered--wide">
              <div className="tools-demo-heading"><Badge tone="orange">STRUCTURED VISION</Badge><h3>What came back?</h3><p>Select a synthetic evidence fixture, then run the same validated result contract used by the intake API.</p></div>
              <div className="tools-scenario-picker" role="group" aria-label="Inspection evidence scenarios">
                {(Object.entries(inspectionScenarios) as [InspectionScenario, typeof scenario][]).map(([id, item]) => (
                  <button key={id} type="button" className={inspectionScenario === id ? 'active' : ''} aria-pressed={inspectionScenario === id} onClick={() => { setInspectionScenario(id); setInspectionComplete(false) }}>
                    <img src={item.image} alt="" /><span>{item.label}</span>
                  </button>
                ))}
              </div>
              <div className="tools-inspection-stage">
                <figure><img src={scenario.image} alt={`Synthetic ${scenario.label.toLowerCase()} return evidence`} /><figcaption>Warehouse evidence · version and checksum bound</figcaption></figure>
                {inspectionComplete ? (
                  <div className="tools-result-card" ref={inspectionResultRef} role="status" aria-live="polite" tabIndex={-1}>
                    <Badge tone={scenario.tone}>{scenario.classification}</Badge>
                    <dl><div><dt>Expected</dt><dd>2 × SK-FE-CAMI-BODYSUIT</dd></div><div><dt>Observed</dt><dd>{scenario.observed}</dd></div><div><dt>Next action</dt><dd>{scenario.action}</dd></div><div><dt>Policy amount</dt><dd>{scenario.amount}</dd></div></dl>
                    <small><ShieldCheck aria-hidden="true" /> The model observed evidence; deterministic policy calculated the amount.</small>
                  </div>
                ) : (
                  <div className="tools-analysis-ready"><Sparkles aria-hidden="true" /><strong>Evidence ready</strong><span>Strict schema · contradiction checks · human-final adverse decisions</span><button type="button" className="button button--primary" onClick={() => setInspectionComplete(true)}>Analyze contents <ArrowRight aria-hidden="true" /></button></div>
                )}
              </div>
            </div>
          </>
        )

      case 'grade-route':
        return (
          <>
            <StageRail labels={['Observe', 'Grade', 'Route']} active={grade ? 2 : 1} />
            <div className="tools-demo-centered">
              <div className="tools-demo-heading"><Badge tone="blue">WAREHOUSE DECISION</Badge><h3>Grade the verified item</h3><p>The warehouse records condition and custody. Merchant policy owns the financial outcome.</p></div>
              <div className="tools-grade-card">
                <div className="tools-product-identity"><img src="/evidence/catalog-fits-everybody-bodysuit.png" alt="Synthetic catalog reference for the two-piece bodysuit order" /><span><small>EXPECTED SKU</small><strong>Fits Everybody Cami Bodysuit</strong><b>SK-FE-CAMI-BODYSUIT · quantity 2</b></span></div>
                <div className="tools-choice-grid" role="group" aria-label="Disposition grade">
                  <button type="button" className={grade === 'restock' ? 'active' : ''} aria-pressed={grade === 'restock'} onClick={() => setGrade('restock')}><PackageCheck aria-hidden="true" /><strong>Restock</strong><span>Complete and sellable</span></button>
                  <button type="button" className={grade === 'quarantine' ? 'active' : ''} aria-pressed={grade === 'quarantine'} onClick={() => setGrade('quarantine')}><ShieldCheck aria-hidden="true" /><strong>Quarantine</strong><span>Mismatch or authentication</span></button>
                  <button type="button" className={grade === 'manual' ? 'active' : ''} aria-pressed={grade === 'manual'} onClick={() => setGrade('manual')}><UserCheck aria-hidden="true" /><strong>Manual bench</strong><span>Damage or uncertainty</span></button>
                </div>
              </div>
              {grade ? <DemoStatus><CheckCircle2 aria-hidden="true" /><span><strong>Route: {grade === 'restock' ? 'Sellable inventory' : grade === 'quarantine' ? 'Secure authentication queue' : 'Senior grader review'}</strong>Operator, timestamp, evidence set, and reason are preserved.</span><button type="button" aria-label="Continue from grading to record the outcome" onClick={() => continueToDemo('ground-truth')}>Record outcome <ArrowRight aria-hidden="true" /></button></DemoStatus> : null}
            </div>
          </>
        )

      case 'ground-truth':
        return (
          <>
            <StageRail labels={['Evidence', 'Adjudicate', 'Learn']} active={groundTruthWritten ? 2 : 1} />
            <div className="tools-demo-centered">
              <div className="tools-demo-heading"><Badge tone="green">OUTCOME LABEL</Badge><h3>Turn inspection into ground truth</h3><p>The outcome is useful only when its sources, reviewer, policy version, and later appeal remain attached.</p></div>
              <div className="tools-truth-ledger" role="status" aria-live="polite">
                <div><Weight aria-hidden="true" /><span><small>NATIVE FACT</small><strong>Inbound 0.18 kg</strong></span><CheckCircle2 aria-hidden="true" /></div>
                <div><PackageOpen aria-hidden="true" /><span><small>NATIVE FACT</small><strong>0 of 2 expected units observed</strong></span><CheckCircle2 aria-hidden="true" /></div>
                <div><Bot aria-hidden="true" /><span><small>MODEL OBSERVATION</small><strong>EMPTY_BOX · 0.99 confidence</strong></span><CheckCircle2 aria-hidden="true" /></div>
                <div><UserCheck aria-hidden="true" /><span><small>ACCOUNTABLE OUTCOME</small><strong>{groundTruthWritten ? 'Confirmed empty return · appealable' : 'Awaiting human adjudication'}</strong></span>{groundTruthWritten ? <CheckCircle2 aria-hidden="true" /> : <Clock3 aria-hidden="true" />}</div>
              </div>
              <button type="button" className="button button--primary" disabled={groundTruthWritten} onClick={() => setGroundTruthWritten(true)}><FileCheck2 aria-hidden="true" /> {groundTruthWritten ? 'Verified outcome written' : 'Write verified outcome'}</button>
            </div>
          </>
        )

      case 'checkout-challenge':
        return (
          <>
            <StageRail labels={['Order', 'Verify', 'Release']} active={checkoutMethod ? 2 : 1} />
            <div className="tools-demo-centered">
              <div className="tools-demo-heading"><Badge tone="orange">SHOPPER RECOVERY</Badge><h3>{checkoutMethod ? 'Thanks — your order is moving.' : 'One quick check before we ship'}</h3><p>{checkoutMethod ? 'The shopper cleared the reversible challenge. No fraud label was created.' : 'A new address and high order value trigger choices, not an accusation.'}</p></div>
              <div className="tools-checkout-card">
                <div className="tools-order-line"><img src="/evidence/catalog-fits-everybody-bodysuit.png" alt="Catalog reference for the returned bodysuit" /><span><strong>Fits Everybody Cami Bodysuit</strong><small>Onyx · sizes M and L</small></span><b>$116</b></div>
                {!checkoutMethod ? <div className="tools-verification-list">
                  <button type="button" onClick={() => setCheckoutMethod('email')}><Mail aria-hidden="true" /><span><strong>Email + payment check</strong><small>Verify two channels already on the order</small></span><ChevronRight aria-hidden="true" /></button>
                  <button type="button" onClick={() => setCheckoutMethod('bank')}><Fingerprint aria-hidden="true" /><span><strong>Verify with your bank</strong><small>Complete a secure 3DS approval</small></span><ChevronRight aria-hidden="true" /></button>
                  <button type="button" onClick={() => setCheckoutMethod('support')}><UserCheck aria-hidden="true" /><span><strong>Assisted review</strong><small>Use an accessible human-supported option</small></span><ChevronRight aria-hidden="true" /></button>
                </div> : <DemoStatus><CheckCircle2 aria-hidden="true" /><span><strong>Order released via {checkoutMethod === 'email' ? 'email + payment check' : checkoutMethod === 'bank' ? 'bank verification' : 'assisted review'}</strong>Decline, expiry, and technical failure remain separate from confirmed fraud.</span><button type="button" onClick={() => setCheckoutMethod(null)}>Try another path <RefreshCw aria-hidden="true" /></button></DemoStatus>}
              </div>
            </div>
          </>
        )

      case 'return-handoff':
        return (
          <>
            <StageRail labels={['Tender', 'Contradiction', 'Cure']} active={handoffResolved ? 2 : 1} />
            <div className="tools-demo-centered">
              <div className="tools-demo-heading"><Badge tone={handoffResolved ? 'green' : 'orange'}>{handoffResolved ? 'RESOLVED' : 'RETURN PAUSED'}</Badge><h3>{handoffResolved ? 'The return is moving again.' : 'Help us confirm the drop-off'}</h3><p>A physically impossible route can indicate bad data. The shopper gets a receipt path before an adverse decision.</p></div>
              <div className="tools-route-card">
                <div className="tools-route-line"><span className="good"><Check aria-hidden="true" /></span><div><strong>10:02 AM · Denver, CO</strong><small>QR return label created</small></div><i /><span className={handoffResolved ? 'good' : 'warn'}>{handoffResolved ? <Check aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}</span><div><strong>10:20 AM · Omaha, NE</strong><small>{handoffResolved ? 'Delayed carrier event reconciled' : 'Carrier ingest · 620 miles away'}</small></div></div>
                <button type="button" className="tools-upload-action" onClick={() => setHandoffResolved(true)} disabled={handoffResolved}><Upload aria-hidden="true" /><span><strong>{handoffResolved ? 'Staffed receipt matched' : 'Use staffed drop-off receipt'}</strong><small>{handoffResolved ? 'Hold cleared · no adverse label' : 'Shopper-provided cure evidence'}</small></span><ChevronRight aria-hidden="true" /></button>
              </div>
            </div>
          </>
        )

      case 'contest-appeal':
        return (
          <>
            <StageRail labels={['Notice', 'Contest', 'Review']} active={appealSubmitted ? 2 : 1} />
            <div className="tools-demo-centered">
              <div className="tools-demo-heading"><Badge tone="violet">REVERSIBLE DECISION</Badge><h3>{appealSubmitted ? 'New evidence is preserved.' : 'Tell us what we may have missed'}</h3><p>The original evidence stays intact while the shopper adds context for a second human reviewer.</p></div>
              <div className="tools-appeal-card">
                <div className="tools-notice"><AlertTriangle aria-hidden="true" /><span><strong>Expected items were not observed</strong><small>Refund remains on temporary hold. This is not a finding of intent.</small></span></div>
                <label>Shopper explanation<textarea rows={4} value={appealText} disabled={appealSubmitted} onChange={(event) => setAppealText(event.target.value)} /></label>
                <button type="button" className="button button--primary" disabled={!appealText.trim() || appealSubmitted} onClick={() => setAppealSubmitted(true)}><MessageSquareText aria-hidden="true" /> {appealSubmitted ? 'Second review requested' : 'Submit for second review'}</button>
              </div>
            </div>
          </>
        )

      case 'review-evidence':
        return (
          <>
            <StageRail labels={['Compare', 'Policy', 'Decide']} active={evidenceReviewed ? 1 : 0} />
            <div className="tools-demo-centered tools-demo-centered--wide">
              <div className="tools-demo-heading"><Badge tone="orange">MERCHANT REVIEW</Badge><h3>Expected versus observed</h3><p>The reviewer sees native evidence, model interpretation, and merchant policy as separate layers.</p></div>
              <div className="tools-evidence-compare">
                <figure><span>ORIGINAL SKU</span><img src="/evidence/catalog-fits-everybody-bodysuit.png" alt="Synthetic catalog reference for the returned bodysuit" /><figcaption>2 pieces · unit price $58.00</figcaption></figure>
                <div className="tools-compare-mark"><span>≠</span><small>1.62 kg delta</small></div>
                <figure><span>WAREHOUSE EVIDENCE</span><img src="/evidence/return-empty-box.png" alt="Synthetic warehouse photograph of an empty return mailer" /><figcaption>0 garments · inbound 0.04 kg</figcaption></figure>
              </div>
              <button type="button" className="button button--primary" disabled={evidenceReviewed} onClick={() => setEvidenceReviewed(true)}><ClipboardCheck aria-hidden="true" /> {evidenceReviewed ? 'Evidence comparison recorded' : 'Record evidence review'}</button>
              {evidenceReviewed ? <DemoStatus><ShieldCheck aria-hidden="true" /><span><strong>Policy RET-HV-04 applies</strong>High value + material weight mismatch + complete inspection → reversible hold and human review.</span><button type="button" aria-label="Continue from evidence review to set resolution" onClick={() => continueToDemo('set-refund')}>Set resolution <ArrowRight aria-hidden="true" /></button></DemoStatus> : null}
            </div>
          </>
        )

      case 'set-refund': {
        const amounts = { full: ['$116.00', '$0.00'], partial: ['$58.00', '$58.00'], hold: ['$0.00 now', '$116.00'] }
        return (
          <>
            <StageRail labels={['Evidence', 'Resolution', 'Record']} active={resolutionRecorded ? 2 : 1} />
            <div className="tools-demo-centered">
              <div className="tools-demo-heading"><Badge tone="blue">DETERMINISTIC MONEY</Badge><h3>Choose the accountable resolution</h3><p>The model cannot create the amount. Catalog price, eligible amount, observed quantity, and policy constrain it.</p></div>
              <div className="tools-resolution-card">
                <div className="tools-resolution-choices" role="group" aria-label="Refund resolution">
                  {(['full', 'partial', 'hold'] as const).map((value) => <button key={value} type="button" className={resolution === value ? 'active' : ''} aria-pressed={resolution === value} onClick={() => { setResolution(value); setResolutionRecorded(false) }}><strong>{value === 'full' ? 'Full refund' : value === 'partial' ? 'Partial refund' : 'Temporary hold'}</strong><span>{value === 'full' ? 'Verified match' : value === 'partial' ? '1 of 2 units verified' : 'Evidence needs review'}</span></button>)}
                </div>
                <dl><div><dt>Refund now</dt><dd>{amounts[resolution][0]}</dd></div><div><dt>Withhold</dt><dd>{amounts[resolution][1]}</dd></div><div><dt>Cap</dt><dd>$116.00 eligible</dd></div></dl>
                <button type="button" className="button button--primary" disabled={resolutionRecorded} onClick={() => setResolutionRecorded(true)}><UserCheck aria-hidden="true" /> {resolutionRecorded ? 'Human resolution recorded' : 'Record human resolution'}</button>
                <p className="sr-only" role="status" aria-live="polite">{resolutionRecorded ? `Human resolution recorded: ${resolution}.` : ''}</p>
              </div>
            </div>
          </>
        )
      }

      case 'approve-message':
        return (
          <>
            <StageRail labels={['Draft', 'Review', 'Queue']} active={messageApproved ? 2 : 1} />
            <div className="tools-demo-centered tools-demo-centered--wide">
              <div className="tools-demo-heading"><Badge tone="violet">SIMULATED DRAFT · LIVE PATH AVAILABLE</Badge><h3>Review the customer-message contract</h3><p>This fixed synthetic preview demonstrates policy-bound, non-accusatory copy. The full intake workflow can request an OpenAI draft and binds approval to its exact content hash.</p></div>
              <div className="tools-message-card">
                <div className="tools-message-tabs" role="group" aria-label="Communication channel"><button type="button" className={channel === 'email' ? 'active' : ''} aria-pressed={channel === 'email'} onClick={() => { setChannel('email'); setMessageApproved(false) }}>Email</button><button type="button" className={channel === 'sms' ? 'active' : ''} aria-pressed={channel === 'sms'} onClick={() => { setChannel('sms'); setMessageApproved(false) }}>SMS</button></div>
                <div className="tools-message-body"><small>{channel === 'email' ? 'SUBJECT · More information about return RMA-8821' : 'TEXT PREVIEW'}</small><p>{channel === 'email' ? 'Our inspection did not observe the two Fits Everybody Cami Bodysuits expected in your return. Your refund is temporarily on hold while we review the evidence. If anything may have been packed or labeled differently, reply with details or supporting photos so a second reviewer can check the record.' : 'SKIMS: Return RMA-8821 is temporarily paused because the expected items were not observed. Reply with context or evidence for a second review.'}</p><div><span><img src="/evidence/catalog-fits-everybody-bodysuit.png" alt="" />Original SKU</span><span><img src="/evidence/return-empty-box.png" alt="" />Inspection evidence</span></div></div>
                <button type="button" className="button button--primary" disabled={messageApproved} onClick={() => setMessageApproved(true)}><ShieldCheck aria-hidden="true" /> {messageApproved ? 'Preview marked approved locally' : 'Approve preview draft'}</button>
                <p className="sr-only" role="status" aria-live="polite">{messageApproved ? 'The synthetic preview draft was marked approved in this browser only.' : ''}</p>
              </div>
            </div>
          </>
        )

      case 'decision-map': {
        const checkpoint = checkpoints[checkpointIndex]
        return (
          <>
            <StageRail labels={['Signal', 'Policy', 'Outcome']} active={1} />
            <div className="tools-demo-centered tools-demo-centered--wide">
              <div className="tools-demo-heading"><Badge tone="blue">POINT-IN-TIME EVIDENCE</Badge><h3>Inspect the decision lifecycle</h3><p>Later warehouse facts never leak backward into an earlier checkout evaluation.</p></div>
              <div className="tools-checkpoint-picker" role="group" aria-label="Lifecycle checkpoint">
                {checkpoints.map((item, index) => <button key={item.label} type="button" className={checkpointIndex === index ? 'active' : ''} aria-pressed={checkpointIndex === index} onClick={() => setCheckpointIndex(index)}><span>{index + 1}</span>{item.label}</button>)}
              </div>
              <div className="tools-checkpoint-detail"><span><small>AVAILABLE SIGNAL</small><strong>{checkpoint.signal}</strong></span><ChevronRight aria-hidden="true" /><span><small>ACCOUNTABLE OWNER</small><strong>{checkpoint.owner}</strong></span><ChevronRight aria-hidden="true" /><span><small>AVAILABLE ACTION</small><strong>{checkpoint.action}</strong></span></div>
            </div>
          </>
        )
      }

      case 'evaluation-lab': {
        const recall = Math.round(116 - threshold * .82)
        const challenge = Math.max(.4, Number((8.1 - threshold * .09).toFixed(1)))
        const review = Math.max(1.2, Number((12 - threshold * .12).toFixed(1)))
        return (
          <>
            <StageRail labels={['Shadow', 'Compare', 'Gate']} active={1} />
            <div className="tools-demo-centered">
              <div className="tools-demo-heading"><Badge tone="violet">ILLUSTRATIVE LAB</Badge><h3>Set a threshold, see the tradeoff</h3><p>These values demonstrate the evaluation UX; they are not measured Redo performance.</p></div>
              <div className="tools-threshold-card">
                <label><span>Risk-score cutoff <strong>{threshold}</strong></span><input type="range" min="35" max="90" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /></label>
                <div><span><small>Fraud-dollar recall</small><strong>{recall}%</strong></span><span><small>Legitimate challenge</small><strong>{challenge}%</strong></span><span><small>Manual review</small><strong>{review}%</strong></span></div>
                <p><Gauge aria-hidden="true" /> A higher cutoff reduces recall, legitimate challenges, and review volume. Production activation still requires independently matured labels, a holdout, friction gates, and stable segment performance.</p>
              </div>
            </div>
          </>
        )
      }

      case 'value-model': {
        const attempted = returnVolume * .09
        const prevented = attempted * .48
        const residual = attempted - prevented
        return (
          <>
            <StageRail labels={['Exposure', 'Prevent', 'Residual']} active={1} />
            <div className="tools-demo-centered">
              <div className="tools-demo-heading"><Badge tone="orange">SCENARIO · NOT A FORECAST</Badge><h3>Keep the dollars in one waterfall</h3><p>Addressable amounts do not add across checkpoints. Each prevented dollar receives one attribution stage.</p></div>
              <div className="tools-value-card">
                <label><span>Annual requested return value <strong>${returnVolume}M</strong></span><input type="range" min="5" max="100" step="5" value={returnVolume} onChange={(event) => setReturnVolume(Number(event.target.value))} /></label>
                <div className="tools-waterfall"><span><small>Attempted fraud scenario</small><strong>${attempted.toFixed(2)}M</strong></span><ArrowRight aria-hidden="true" /><span><small>Incrementally prevented</small><strong>${prevented.toFixed(2)}M</strong></span><ArrowRight aria-hidden="true" /><span><small>Residual exposure</small><strong>${residual.toFixed(2)}M</strong></span></div>
                <p><Info aria-hidden="true" /> Uses an illustrative 9% attempted-fraud share and 48% incremental prevention solely to demonstrate the calculator. Replace both with measured merchant-cohort inputs.</p>
              </div>
            </div>
          </>
        )
      }
    }
  }

  return (
    <div className="tools-page">
      <header className="tools-hero">
        <div><p className="eyebrow">INTERACTIVE PRODUCT TOUR</p><h1>Try the return integrity layer.</h1><p>Click through the same decision story from four perspectives. Each compact demo works here, and every one opens into a deeper live workflow.</p></div>
        <div className="tools-hero__proof"><span><CheckCircle2 aria-hidden="true" />13 guided demos</span><span><ShieldCheck aria-hidden="true" />Synthetic data</span><span><Sparkles aria-hidden="true" />Live versus simulated labeled</span></div>
      </header>

      <section className="tools-playground" aria-labelledby="tools-playground-title">
        <div className="tools-playground__title"><div><p className="eyebrow">CHOOSE A PERSPECTIVE</p><h2 id="tools-playground-title">{activeGroup.headline}</h2></div><button type="button" className="tools-reset" onClick={resetDemo}><RotateCcw aria-hidden="true" /> Reset interactions</button></div>

        <div className="tools-group-tabs" role="tablist" aria-label="Demo perspectives">
          {groups.map((group, index) => <button key={group.id} id={`tools-group-${group.id}`} type="button" role="tab" aria-selected={groupId === group.id} aria-controls="tools-demo-frame" tabIndex={groupId === group.id ? 0 : -1} className={groupId === group.id ? 'active' : ''} onClick={() => chooseGroup(group)} onKeyDown={(event) => moveGroupFocus(event, index)}>{group.label}<span>{group.demos.length}</span></button>)}
        </div>

        <div id="tools-demo-frame" className="tools-frame" role="tabpanel" aria-labelledby={`tools-group-${groupId}`}>
          <aside className="tools-demo-menu" aria-label={`${activeGroup.label} demos`}>
            {activeGroup.demos.map(({ id, label, description, icon: Icon }) => <button key={id} type="button" className={activeDemo.id === id ? 'active' : ''} aria-current={activeDemo.id === id ? 'page' : undefined} onClick={() => selectDemo(id)}><Icon aria-hidden="true" /><span><strong>{label}</strong><small>{description}</small></span><ChevronRight aria-hidden="true" /></button>)}
          </aside>

          <section className="tools-demo-surface">
            <div className="tools-demo-toolbar"><div><span className="tools-window-dot" /><span className="tools-window-dot" /><span className="tools-window-dot" /><small>Interactive synthetic demo</small></div><div><Link to={activeDemo.fullPath}>{activeDemo.fullLabel} <ArrowRight aria-hidden="true" /></Link><button type="button" aria-label="About this demo" aria-expanded={showInfo} onClick={() => setShowInfo((value) => !value)}><Info aria-hidden="true" /></button></div></div>
            {showInfo ? <aside className="tools-info-panel" role="note"><ShieldCheck aria-hidden="true" /><span><strong>What is live here?</strong>This page uses synthetic browser state for fast exploration. “Open full workflow” takes you to the deeper implementation. The Intake path explicitly labels whether it used OpenAI, direct identifiers, a fixture, or a safe fallback.</span></aside> : null}
            <div className="tools-demo-viewport" ref={demoViewportRef} tabIndex={-1} aria-label={`${activeDemo.label} interactive preview`}>{renderDemo()}</div>
          </section>
        </div>

        <footer className="tools-story-strip">
          <div><small>ACTIVE DEMO</small><strong>{activeDemo.label}</strong><span>{activeDemo.description}</span></div>
          <div><small>DESIGN PRINCIPLE</small><strong>Observe → constrain → decide</strong><span>The model describes. Policy calculates. An accountable person owns adverse outcomes.</span></div>
          <Link to={activeDemo.fullPath} aria-label={`${activeDemo.fullLabel}: ${activeDemo.label}`}>Open full demo <ArrowRight aria-hidden="true" /></Link>
        </footer>
      </section>
    </div>
  )
}
