import { useMutation } from '@tanstack/react-query'
import {
  ArrowRight,
  Box,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleDollarSign,
  Factory,
  Fingerprint,
  GitBranch,
  LoaderCircle,
  PackageSearch,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { checkpoints, outcomeMetrics } from '../domain'
import { joinWaitlist } from '../lib/api'
import { Badge, MetricCard } from '../components/ui'

const layers = [
  { name: 'Evidence & Observe', tier: 'Free', description: 'Turn existing return evidence into consistent cases, communications, and outcome labels.', icon: PackageSearch },
  { name: 'Predict & Decide', tier: 'Pro', description: 'Score interventions, shadow-test policy, and choose the least-friction next step.', icon: BrainCircuit },
  { name: 'Managed Verify', tier: 'Network', description: 'Capture calibrated weight, serial, quantity, photos, and custody at managed facilities.', icon: ScanLine },
  { name: 'Protection', tier: 'Risk transfer', description: 'Keep merchant compensation visibly separate from fraud prevention and recovery.', icon: ShieldCheck },
]

export function LandingPage() {
  const [fields, setFields] = useState({ email: '', role: 'Merchant operations', companyUrl: '', consent: false })
  const waitlist = useMutation({ mutationFn: () => joinWaitlist(fields) })

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero__ambient hero__ambient--one" />
        <div className="hero__ambient hero__ambient--two" />
        <div className="hero__content">
          <Badge tone="orange" icon={Sparkles}>RETURN INTELLIGENCE, WITH DUE PROCESS</Badge>
          <h1>Catch the return.<br /><em>Keep the customer.</em></h1>
          <p className="hero__lede">A decision and evidence layer that helps Redo prevent empty-box, decoy, wrong-item, imitation, and quantity fraud — while giving every good shopper a clear path forward.</p>
          <div className="hero__actions">
            <Link className="button button--primary" to="/merchant">Enter merchant console <ArrowRight aria-hidden="true" size={17} /></Link>
            <Link className="button button--ghost-light" to="/lifecycle">Explore 15 checkpoints <GitBranch aria-hidden="true" size={17} /></Link>
          </div>
          <div className="hero__trust">
            <span><Check size={15} aria-hidden="true" /> Point-in-time evidence</span>
            <span><Check size={15} aria-hidden="true" /> Human final decisions</span>
            <span><Check size={15} aria-hidden="true" /> Measured shopper friction</span>
          </div>
        </div>
        <div className="hero__visual" role="img" aria-label="Illustration of the return evidence lifecycle">
          <div className="parcel-scene">
            <div className="parcel-scene__scan" />
            <div className="parcel-scene__box"><Box aria-hidden="true" strokeWidth={1.2} /></div>
            <div className="parcel-scene__label"><span>JC–1042</span><i /><i /><i /><i /></div>
            <div className="evidence-float evidence-float--weight"><strong>0.18 kg</strong><span>−1.62 kg delta</span></div>
            <div className="evidence-float evidence-float--vision"><Fingerprint size={16} aria-hidden="true" /><span>Serial absent</span></div>
            <div className="evidence-float evidence-float--policy"><ShieldCheck size={16} aria-hidden="true" /><span>Human review</span></div>
          </div>
        </div>
      </section>

      <section className="scenario-strip" aria-label="Strategic scenario">
        <div><small>Broad signal cohort</small><strong>$200M</strong><span>merchant GMV scenario</span></div>
        <ChevronRight aria-hidden="true" />
        <div><small>Managed ground truth</small><strong>$80M</strong><span>Q1 2028 target cohort</span></div>
        <ChevronRight aria-hidden="true" />
        <div><small>Decision surface</small><strong>15</strong><span>auditable checkpoints</span></div>
        <p>Planning scenario, not current live volume. Cohorts remain separate until a shared merchant-GMV and refund-exposure denominator is available.</p>
      </section>

      <section className="section section--split">
        <div className="section-heading">
          <p className="eyebrow">THE PRODUCT THESIS</p>
          <h2>Ground truth makes every earlier decision smarter.</h2>
          <p>Checkout signals are useful, but only facility inspection can conclusively label what came back. The managed network creates high-quality outcome labels; the broader platform learns where and when proportionate intervention works.</p>
          <Link to="/operator" className="text-link">See the operator capture protocol <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
        <div className="truth-loop">
          <div className="truth-loop__center"><Factory aria-hidden="true" /><strong>Ground<br />truth</strong></div>
          <div className="truth-loop__node truth-loop__node--one"><Fingerprint aria-hidden="true" /><span>Identity</span></div>
          <div className="truth-loop__node truth-loop__node--two"><Box aria-hidden="true" /><span>Weight</span></div>
          <div className="truth-loop__node truth-loop__node--three"><ScanLine aria-hidden="true" /><span>Vision</span></div>
          <div className="truth-loop__node truth-loop__node--four"><CircleDollarSign aria-hidden="true" /><span>Outcome</span></div>
        </div>
      </section>

      <section className="section section--dark">
        <div className="section-heading section-heading--wide">
          <p className="eyebrow">ONE EVIDENCE GRAPH, FOUR PRODUCTS</p>
          <h2>Start with free workflow value. Earn the right to predict.</h2>
          <p>Each layer produces better evidence and cleaner labels without blurring prevention, recovery, or risk transfer.</p>
        </div>
        <div className="layer-grid">
          {layers.map(({ name, tier, description, icon: Icon }, index) => (
            <article className="layer-card" key={name}>
              <span className="layer-card__index">0{index + 1}</span>
              <Icon aria-hidden="true" />
              <Badge tone="dark">{tier}</Badge>
              <h3>{name}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading section-heading--row">
          <div><p className="eyebrow">MEASURE WHAT ACTUALLY HAPPENED</p><h2>A fraud dashboard finance can trust.</h2></div>
          <Link to="/lab" className="button button--secondary">Open evaluation lab <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        <div className="metric-grid">
          {outcomeMetrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
        </div>
        <p className="method-note"><strong>Method note:</strong> non-verification is abandonment, not fraud. Estimated deterrence requires a randomized treatment/control experiment. Verified loss stopped requires a confirmed outcome. Dollars never appear in more than one bucket.</p>
      </section>

      <section className="section checkpoint-preview">
        <div className="section-heading">
          <p className="eyebrow">DECIDE EARLY, VERIFY LATE</p>
          <h2>Every checkpoint has an accountable next step.</h2>
        </div>
        <div className="mini-checkpoints">
          {checkpoints.map((point) => (
            <Link key={point.id} to={`/lifecycle?checkpoint=${point.id}`} className={`mini-checkpoint mini-checkpoint--${point.phase.toLowerCase()}`}>
              <span>{String(point.number).padStart(2, '0')}</span><strong>{point.label}</strong><small>{point.phase}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="section waitlist-section" id="waitlist">
        <div className="waitlist-copy">
          <p className="eyebrow">DESIGN PARTNER RESEARCH</p>
          <h2>Help shape fairer return decisions.</h2>
          <p>Join the product-research waitlist. We’ll use this only to follow up about Return Integrity research; no marketing email is sent from this prototype.</p>
          <div className="privacy-card"><ShieldCheck aria-hidden="true" /><div><strong>Minimal by design</strong><span>Email, role, optional company URL, consent, and notice version. 30-day active-retention target; AWS TTL deletion and retained backups may lag per policy.</span></div></div>
        </div>
        <form className="waitlist-form" onSubmit={(event) => { event.preventDefault(); waitlist.mutate() }}>
          <label>Email<input type="email" required autoComplete="email" value={fields.email} onChange={(event) => setFields({ ...fields, email: event.target.value })} placeholder="you@company.com" /></label>
          <label>Role<select value={fields.role} onChange={(event) => setFields({ ...fields, role: event.target.value })}><option>Merchant operations</option><option>Fraud & risk</option><option>Warehouse operations</option><option>Customer experience</option><option>Executive</option></select></label>
          <label>Company URL <span>(optional)</span><input type="url" value={fields.companyUrl} onChange={(event) => setFields({ ...fields, companyUrl: event.target.value })} placeholder="https://company.com" /></label>
          <label className="checkbox-label"><input type="checkbox" checked={fields.consent} required onChange={(event) => setFields({ ...fields, consent: event.target.checked })} /><span>I agree to be contacted about this research and understand this is a prototype.</span></label>
          <button className="button button--primary button--full" type="submit" disabled={waitlist.isPending}>{waitlist.isPending ? <LoaderCircle className="spin" aria-hidden="true" /> : null}{waitlist.isPending ? 'Joining…' : 'Join the research waitlist'} </button>
          {waitlist.data ? <div className={`form-message form-message--${waitlist.data.mode}`} role="status"><strong>{waitlist.data.mode === 'live' ? 'Received' : 'Not submitted'}</strong><span>{waitlist.data.message}</span></div> : null}
        </form>
      </section>
    </div>
  )
}
