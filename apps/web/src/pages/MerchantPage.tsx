import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Gavel,
  Link2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Warehouse,
  X,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LiveDecisionOutput } from '../components/LiveDecisionOutput'
import { Badge, EmptyNotice, MetricCard, PageIntro } from '../components/ui'
import { checkpoints, formatStatus, outcomeMetrics } from '../domain'
import { evaluateCheckpoint } from '../lib/api'
import { useDemo } from '../lib/demo-context'

const cases = [
  { id: 'RMA-8821', order: 'SK-1042', shopper: 'Alex Morgan', amount: '$116', type: 'Empty return', updated: '4m', image: '/evidence/return-empty-box.png' },
]

type Decision = 'approve' | 'partial' | 'request' | 'deny' | null

export function MerchantPage() {
  const { state, update } = useDemo()
  const [query, setQuery] = useState('')
  const [decision, setDecision] = useState<Decision>(null)
  const [note, setNote] = useState('')
  const [certified, setCertified] = useState(false)
  const rationaleRef = useRef<HTMLTextAreaElement>(null)
  const selected = cases[0]
  const operatorFindingReady = state.physical !== 'inspection-hold'
  const displayType = operatorFindingReady ? selected.type : 'Awaiting operator finding'
  const visibleCases = useMemo(() => cases.filter((item) => `${item.id} ${item.order} ${item.shopper} ${operatorFindingReady ? item.type : 'awaiting operator finding'}`.toLowerCase().includes(query.toLowerCase())), [operatorFindingReady, query])
  const inspectionCheckpoint = checkpoints.find((point) => point.id === 'ITEM_INSPECTION')!
  const liveEvaluation = useQuery({
    queryKey: ['evaluate-checkpoint', inspectionCheckpoint.id, selected.id, state.physicalFinding],
    queryFn: () => evaluateCheckpoint(inspectionCheckpoint, state),
    enabled: operatorFindingReady,
  })

  useEffect(() => {
    if (!decision) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    rationaleRef.current?.focus()
    const handleDialogKeys = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setDecision(null)
        return
      }
      if (event.key !== 'Tab') return
      const dialog = rationaleRef.current?.closest('[role="dialog"]')
      const focusable = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled]), input:not([disabled])')) : []
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleDialogKeys)
    return () => {
      document.removeEventListener('keydown', handleDialogKeys)
      previousFocus?.focus()
    }
  }, [decision])

  const finalize = () => {
    if (!decision || !certified || !note.trim()) return
    if (decision === 'approve') update({ physical: 'approved', reviewerNote: note })
    if (decision === 'partial') update({ physical: 'partial', reviewerNote: note })
    if (decision === 'request') update({ physical: 'review-pending', reviewerNote: note })
    if (decision === 'deny') update({ physical: 'denied', reviewerNote: note })
    setDecision(null); setCertified(false); setNote('')
  }

  return (
    <div className="page merchant-page">
      <PageIntro eyebrow="MERCHANT CONSOLE · SKIMS" title={<>Make the decision. <em>See the proof.</em></>} description="A case workspace that keeps model recommendation, merchant policy, and accountable human action distinct — with shopper cure and payment evidence visible from the start." actions={<Link className="button button--secondary" to="/legacy/lifecycle?checkpoint=ITEM_INSPECTION"><FileText size={16} aria-hidden="true" /> View decision contract</Link>} />
      <div className="merchant-kpis">
        {outcomeMetrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </div>
      <div className="merchant-note"><Sparkles aria-hidden="true" /><p><strong>Demo methodology:</strong> prevented and recovered dollars are separate. Abandoned verification is not counted as fraud. Values shown are illustrative fixtures, not Redo production metrics.</p></div>

      <div className="case-workspace">
        <aside className="case-queue">
          <header><div><span className="eyebrow">ACTIVE DEMO CASE</span><h2>Needs attention <b>{visibleCases.length}</b></h2></div></header>
          <label className="searchbox"><Search size={16} aria-hidden="true" /><input placeholder="Search returns" aria-label="Search returns" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <div className="case-list">
            {visibleCases.length ? visibleCases.map((item) => (
              <div key={item.id} className="case-row case-row--active" aria-current="true">
                <img src={item.image} alt="" />
                <span className="case-row__copy"><small>{item.id} · {item.updated} ago</small><strong>{operatorFindingReady ? item.type : 'Awaiting operator finding'}</strong><span>{item.order} · {item.shopper}</span></span>
                <span className="case-row__amount">{item.amount}<Badge tone="orange">High priority</Badge></span>
                <ChevronRight size={16} aria-hidden="true" />
              </div>
            )) : (
              <EmptyNotice
                icon={Search}
                title="No returns match"
                actions={<button type="button" className="button button--secondary button--small" onClick={() => setQuery('')}>Clear search</button>}
              >
                Nothing in this queue matches “{query}”. Try an RMA, order, shopper, or finding type.
              </EmptyNotice>
            )}
          </div>
          <p className="queue-scope-note"><ShieldCheck size={15} aria-hidden="true" /><span>This review surface intentionally follows one coherent case from capture through appeal. <Link to="/legacy/intake">Explore other package fixtures in Scan Return.</Link></span></p>
        </aside>

        <section className={`case-detail${visibleCases.length ? '' : ' case-detail--empty'}`}>
          {!visibleCases.length ? (
            <EmptyNotice
              icon={Search}
              title="Select a matching return"
              actions={<button type="button" className="button button--secondary button--small" onClick={() => setQuery('')}>Clear search</button>}
            >
              The queue has no cases for this search. Clear it to continue reviewing evidence, policy, and the accountable decision.
            </EmptyNotice>
          ) : (
            <>
          <header className="case-detail__header">
            <div><div className="decision-card__badges"><Badge tone={operatorFindingReady ? 'orange' : 'blue'}>{displayType.toUpperCase()}</Badge><Badge tone="violet">SYNTHETIC FIXTURE</Badge><Badge tone="neutral">{state.physical === 'inspection-hold' ? 'REFUND HELD' : formatStatus(state.physical).toUpperCase()}</Badge></div><h2>{selected.id} <span>· Order {selected.order}</span></h2><p>{selected.shopper} · Fits Everybody Cami Bodysuit · Onyx · M and L</p></div>
            <div className="case-detail__amount"><small>Refund requested</small><strong>{selected.amount}.00</strong></div>
          </header>

          {!operatorFindingReady ? (
            <section className="merchant-awaiting-operator" aria-labelledby="operator-review-required">
              <span className="merchant-awaiting-operator__icon"><Warehouse aria-hidden="true" /></span>
              <Badge tone="blue">SEQUENCE GATE</Badge>
              <h3 id="operator-review-required">Operator review required</h3>
              <p>The completed capture record is available, but no neutral warehouse observation has been confirmed or routed. A finding, model assessment, and merchant decision will remain hidden until that step is complete.</p>
              <Link className="button button--primary" to="/legacy/operator">Open warehouse capture review <ArrowRight size={16} aria-hidden="true" /></Link>
            </section>
          ) : (
            <>
          <div className="case-overview">
            <figure className="case-photo"><img src={selected.image} alt={`Synthetic evidence fixture for ${selected.type.toLowerCase()}`} /><figcaption><Badge tone="violet">SYNTHETIC EVIDENCE · NOT A CUSTOMER PHOTO</Badge><span>Inbound camera 02 · Aug 24, 2:14:08 PM</span></figcaption></figure>
            <div className="finding-summary">
              <span className="eyebrow">CORROBORATED FINDING</span>
              <div className="finding-summary__title"><ShieldAlert aria-hidden="true" /><div><strong>{selected.type === 'Empty return' ? 'Expected items not observed' : selected.type}</strong><span>{selected.type === 'Empty return' ? 'Quantity 0 of 2 pieces · no polybags in the mailer' : 'Requires operator confirmation'}</span></div></div>
              <dl>
                <div><dt>Outbound weight</dt><dd>1.80 kg</dd></div>
                <div><dt>Inbound weight</dt><dd className="text-danger">0.18 kg <ArrowDownRight size={14} /></dd></div>
                <div><dt>Expected quantity</dt><dd>2 cameras</dd></div>
                <div><dt>Observed quantity</dt><dd className="text-danger">0</dd></div>
                <div><dt>Serial</dt><dd>Not observed</dd></div>
                <div><dt>Protocol</dt><dd className="text-good"><Check size={13} /> Complete</dd></div>
              </dl>
            </div>
          </div>

          <LiveDecisionOutput assessment={liveEvaluation.data} pending={liveEvaluation.isFetching} />

          <div className="decision-separation">
            <article className="decision-separation__policy"><header><span><ShieldCheck aria-hidden="true" /><strong>Merchant policy · v3.4</strong></span><Badge tone="blue">DETERMINISTIC</Badge></header><h3>{liveEvaluation.data?.policy?.action?.replaceAll('_', ' ') ?? 'Manual review required'}</h3><p>{liveEvaluation.data?.policy?.explanation ?? 'Return value over $500 plus material weight mismatch plus complete inspection protocol. Hold remains reversible for 48 hours after adverse notice.'}</p><small><Link2 size={13} /> Policy {liveEvaluation.data?.policy?.policyId ?? 'RET-HV-04'} · {liveEvaluation.data?.policyVersion ?? 'v3.4'}</small></article>
            <article className="decision-separation__human-note"><header><span><UserCheck aria-hidden="true" /><strong>Human remains final</strong></span><Badge tone="orange">ACCOUNTABLE</Badge></header><h3>Model cannot execute this outcome</h3><p>The live chain above is a recommendation. Approve, partial, request, or deny is recorded as your decision with evidence, policy, and a shopper cure.</p><small>Actor: {liveEvaluation.data?.accountableAction?.actor?.replaceAll('_', ' ') ?? 'SYSTEM POLICY'}</small></article>
          </div>

          <div className="human-decision">
            <div className="human-decision__intro"><span className="human-avatar">DR</span><div><span className="eyebrow">ACCOUNTABLE HUMAN ACTION</span><h3>{state.physical === 'appealed' ? 'Second review required' : 'Demo reviewer · unauthenticated persona'}</h3><p>{state.physical === 'appealed' ? 'The shopper supplied new context. A different authorized reviewer must compare it to the original evidence.' : 'Review the evidence and select a reversible next step. This browser-local persona is not proof of login, role, or physical identity.'}</p></div></div>
            {state.physical === 'appealed' ? <div className="appeal-callout"><RefreshCw aria-hidden="true" /><div><strong>Shopper appeal received — timer paused</strong><p>“{state.appealExplanation ?? 'I used the same box for two returns. The other item may have been sent under this label…'}”{state.appealEvidenceName ? <small>Selected evidence filename: {state.appealEvidenceName} · file contents are not retained by this browser demo.</small> : null}</p><div><button className="button button--primary" onClick={() => update({ physical: 'overturned' })}><CheckCircle2 size={16} /> Overturn & approve refund</button><button className="button button--secondary" onClick={() => setDecision('deny')}><Gavel size={16} /> Uphold after review</button></div></div></div> : (
              <div className="decision-actions">
                <button onClick={() => setDecision('approve')}><CheckCircle2 /><strong>Approve</strong><span>Release full refund</span></button>
                <button onClick={() => setDecision('partial')}><ArrowUpRight /><strong>Partial</strong><span>Set adjusted amount</span></button>
                <button onClick={() => setDecision('request')}><Clock3 /><strong>Request info</strong><span>Extend cure window</span></button>
                <button className="decision-actions__deny" onClick={() => setDecision('deny')}><XCircle /><strong>Deny</strong><span>Requires reason + appeal</span></button>
              </div>
            )}
          </div>

          {(state.physical === 'denied' || state.physical === 'evidence-ready') ? (
            <section className="reclaim-card"><div className="reclaim-card__icon"><ShieldCheck /></div><div><Badge tone="dark">REDO RECLAIM HANDOFF</Badge><h3>{state.physical === 'evidence-ready' ? 'Evidence ready — not submitted' : 'Contest window is open'}</h3><p>The versioned evidence bundle is prepared for an authorized inquiry, alert, or dispute workflow. Preparing evidence does not mean it was submitted or won.</p><div className="reclaim-card__meta"><span><Check /> 9 artifacts checksummed</span><span><Check /> Policy + reviewer history</span><span><Check /> Shopper notice preserved</span></div></div><button className="button button--ghost-light" disabled={state.physical === 'evidence-ready'} onClick={() => update({ physical: 'evidence-ready' })}>{state.physical === 'evidence-ready' ? 'Ready · not submitted' : 'Advance demo timer'} <ArrowRight size={16} /></button></section>
          ) : null}
            </>
          )}
            </>
          )}
        </section>
      </div>

      {decision ? (
        <div className="modal-backdrop" role="presentation">
          <section className="decision-modal" role="dialog" aria-modal="true" aria-labelledby="decision-title">
            <button className="modal-close" aria-label="Close decision dialog" onClick={() => setDecision(null)}><X /></button>
            <Badge tone={decision === 'deny' ? 'red' : 'blue'} icon={UserCheck}>HUMAN DECISION</Badge>
            <h2 id="decision-title">{decision === 'deny' ? 'Document an adverse decision' : `${formatStatus(decision)} this return`}</h2>
            <p>{decision === 'deny' ? 'The shopper will receive your reason, the evidence summary, a 48-hour contest window, and an accessible appeal path. Nothing is sent to a payment network.' : 'Record why this outcome is supported. This demo stores only browser-local scenario state and does not authenticate the reviewer.'}</p>
            <div className="decision-requirements" aria-label="Decision record requirements"><span><small>Evidence set</small><strong>9 synthetic artifacts · checksummed</strong></span><span><small>Policy snapshot</small><strong>RET-HV-04 · v3.4</strong></span><span><small>Shopper notice</small><strong>48-hour cure + appeal</strong></span></div>
            <label className="field-label">Reviewer rationale<textarea ref={rationaleRef} rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Cite the evidence and policy you reviewed…" /></label>
            <label className="checkbox-label checkbox-label--boxed"><input type="checkbox" checked={certified} onChange={(event) => setCertified(event.target.checked)} /><span>I reviewed the native evidence, model recommendation, merchant policy, and available shopper context. This is my decision.</span></label>
            {decision === 'deny' ? <div className="modal-warning"><AlertTriangle /><span>Denial is reversible during appeal. Evidence remains “ready,” never “submitted,” until an authorized payment workflow accepts it.</span></div> : null}
            <button className={`button button--full ${decision === 'deny' ? 'button--danger' : 'button--primary'}`} disabled={!certified || !note.trim()} onClick={finalize}><Gavel size={16} /> Record {formatStatus(decision)} decision</button>
          </section>
        </div>
      ) : null}
    </div>
  )
}
