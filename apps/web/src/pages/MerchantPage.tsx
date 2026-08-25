import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  FileText,
  Gavel,
  Link2,
  PackageOpen,
  PauseCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, MetricCard, PageIntro } from '../components/ui'
import { formatStatus, outcomeMetrics } from '../domain'
import { useDemo } from '../lib/demo-context'

const cases = [
  { id: 'RMA-8821', order: 'JC-1042', shopper: 'Alex Morgan', amount: '$1,849', type: 'Empty return', score: 'High', status: 'Review', updated: '4m', image: '/evidence/return-empty-box.png' },
  { id: 'RMA-8819', order: 'JC-1038', shopper: 'Jordan Lee', amount: '$729', type: 'Wrong item', score: 'Medium', status: 'Evidence', updated: '18m', image: '/evidence/return-wrong-item.png' },
  { id: 'RMA-8814', order: 'JC-1027', shopper: 'Sam Rivera', amount: '$1,249', type: 'Possible imitation', score: 'Medium', status: 'Inspection', updated: '42m', image: '/evidence/return-imitation.png' },
]

type Decision = 'approve' | 'partial' | 'request' | 'deny' | null

export function MerchantPage() {
  const { state, update } = useDemo()
  const [selectedId, setSelectedId] = useState('RMA-8821')
  const [query, setQuery] = useState('')
  const [decision, setDecision] = useState<Decision>(null)
  const [note, setNote] = useState('')
  const [certified, setCertified] = useState(false)
  const selected = cases.find((item) => item.id === selectedId) ?? cases[0]
  const visibleCases = useMemo(() => cases.filter((item) => `${item.id} ${item.order} ${item.shopper} ${item.type}`.toLowerCase().includes(query.toLowerCase())), [query])

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
      <PageIntro eyebrow="MERCHANT CONSOLE · JUNIPER CIRCUIT" title={<>Make the decision. <em>See the proof.</em></>} description="A case workspace that keeps model recommendation, merchant policy, and accountable human action distinct — with shopper cure and payment evidence visible from the start." actions={<button className="button button--secondary"><FileText size={16} aria-hidden="true" /> Export audit log</button>} />
      <div className="merchant-kpis">
        {outcomeMetrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </div>
      <div className="merchant-note"><Sparkles aria-hidden="true" /><p><strong>Demo methodology:</strong> prevented and recovered dollars are separate. Abandoned verification is not counted as fraud. Values shown are illustrative fixtures, not Redo production metrics.</p></div>

      <div className="case-workspace">
        <aside className="case-queue">
          <header><div><span className="eyebrow">CASE QUEUE</span><h2>Needs attention <b>3</b></h2></div><button aria-label="Queue settings">•••</button></header>
          <label className="searchbox"><Search size={16} aria-hidden="true" /><input placeholder="Search returns" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <div className="queue-filters"><button className="active">All 12</button><button>Review 3</button><button>Appeals 1</button></div>
          <div className="case-list">
            {visibleCases.map((item) => (
              <button key={item.id} className={selectedId === item.id ? 'case-row case-row--active' : 'case-row'} onClick={() => setSelectedId(item.id)}>
                <img src={item.image} alt="" />
                <span className="case-row__copy"><small>{item.id} · {item.updated} ago</small><strong>{item.type}</strong><span>{item.order} · {item.shopper}</span></span>
                <span className="case-row__amount">{item.amount}<Badge tone={item.score === 'High' ? 'red' : 'orange'}>{item.score}</Badge></span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
        </aside>

        <section className="case-detail">
          <header className="case-detail__header">
            <div><div className="decision-card__badges"><Badge tone="orange">{selected.type.toUpperCase()}</Badge><Badge tone="violet">SYNTHETIC FIXTURE</Badge><Badge tone="neutral">{state.physical === 'inspection-hold' ? 'REFUND HELD' : formatStatus(state.physical).toUpperCase()}</Badge></div><h2>{selected.id} <span>· Order {selected.order}</span></h2><p>{selected.shopper} · Juniper Arc One 2-camera field kit</p></div>
            <div className="case-detail__amount"><small>Refund requested</small><strong>{selected.amount}.00</strong></div>
          </header>

          <div className="case-overview">
            <figure className="case-photo"><img src={selected.image} alt={`Synthetic evidence fixture for ${selected.type.toLowerCase()}`} /><figcaption><Badge tone="violet">SYNTHETIC EVIDENCE · NOT A CUSTOMER PHOTO</Badge><span>Inbound camera 02 · Aug 24, 2:14:08 PM</span></figcaption></figure>
            <div className="finding-summary">
              <span className="eyebrow">CORROBORATED FINDING</span>
              <div className="finding-summary__title"><ShieldAlert aria-hidden="true" /><div><strong>{selected.type === 'Empty return' ? 'Expected items not observed' : selected.type}</strong><span>{selected.type === 'Empty return' ? 'Quantity 0 of 2 cameras · serials absent' : 'Requires operator confirmation'}</span></div></div>
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

          <div className="decision-separation">
            <article className="decision-separation__ai"><header><span><Bot aria-hidden="true" /><strong>OpenAI assessment</strong></span><Badge tone="violet">SIMULATED FALLBACK</Badge></header><h3>Likely empty return <span>0.93</span></h3><p>No retail item is visible across the complete unpacking sequence. Packaging and label appear consistent with RMA-8821. Imitation is not assessable because no product is present.</p><small><FileCheck2 size={13} /> Cites EV-12-WEIGHT, EV-13-FRAMES-01–06, EV-13-SERIAL</small></article>
            <article className="decision-separation__policy"><header><span><ShieldCheck aria-hidden="true" /><strong>Merchant policy · v3.4</strong></span><Badge tone="blue">DETERMINISTIC</Badge></header><h3>Manual review required</h3><p>Return value over $500 plus material weight mismatch plus complete inspection protocol. Hold remains reversible for 48 hours after adverse notice.</p><small><Link2 size={13} /> Policy RET-HV-04 · Published Jul 1, 2026</small></article>
          </div>

          <div className="human-decision">
            <div className="human-decision__intro"><span className="human-avatar">CS</span><div><span className="eyebrow">ACCOUNTABLE HUMAN ACTION</span><h3>{state.physical === 'appealed' ? 'Second review required' : 'Canyon Smith · Merchant reviewer'}</h3><p>{state.physical === 'appealed' ? 'The shopper supplied new context. A different authorized reviewer must compare it to the original evidence.' : 'Review the evidence and select a reversible next step. The model has no authority to execute your choice.'}</p></div></div>
            {state.physical === 'appealed' ? <div className="appeal-callout"><RefreshCw aria-hidden="true" /><div><strong>Shopper appeal received — timer paused</strong><p>“I used the same box for two returns. The other item may have been sent under this label…”</p><div><button className="button button--primary" onClick={() => update({ physical: 'overturned' })}><CheckCircle2 size={16} /> Overturn & approve refund</button><button className="button button--secondary" onClick={() => setDecision('deny')}><Gavel size={16} /> Uphold after review</button></div></div></div> : (
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
        </section>
      </div>

      {decision ? (
        <div className="modal-backdrop" role="presentation">
          <section className="decision-modal" role="dialog" aria-modal="true" aria-labelledby="decision-title">
            <button className="modal-close" aria-label="Close decision dialog" onClick={() => setDecision(null)}><X /></button>
            <Badge tone={decision === 'deny' ? 'red' : 'blue'} icon={UserCheck}>HUMAN DECISION</Badge>
            <h2 id="decision-title">{decision === 'deny' ? 'Document an adverse decision' : `${formatStatus(decision)} this return`}</h2>
            <p>{decision === 'deny' ? 'The shopper will receive your reason, the evidence summary, a 48-hour contest window, and an accessible appeal path. Nothing is sent to a payment network.' : 'Record why this outcome is supported. The audit trail will identify you as the accountable reviewer.'}</p>
            <label className="field-label">Reviewer rationale<textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Cite the evidence and policy you reviewed…" /></label>
            <label className="checkbox-label checkbox-label--boxed"><input type="checkbox" checked={certified} onChange={(event) => setCertified(event.target.checked)} /><span>I reviewed the native evidence, model recommendation, merchant policy, and available shopper context. This is my decision.</span></label>
            {decision === 'deny' ? <div className="modal-warning"><AlertTriangle /><span>Denial is reversible during appeal. Evidence remains “ready,” never “submitted,” until an authorized payment workflow accepts it.</span></div> : null}
            <button className={`button button--full ${decision === 'deny' ? 'button--danger' : 'button--primary'}`} disabled={!certified || !note.trim()} onClick={finalize}><Gavel size={16} /> Record {formatStatus(decision)} decision</button>
          </section>
        </div>
      ) : null}
    </div>
  )
}
