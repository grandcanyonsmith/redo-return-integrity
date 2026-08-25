import { AlertTriangle, CheckCircle2, ChevronDown, Filter, Layers3, Network, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DecisionPipeline } from '../components/DecisionPipeline'
import { Badge, EmptyNotice, PageIntro } from '../components/ui'
import { checkpointScope, checkpoints, lifecyclePhases, type Checkpoint } from '../domain'

const tierDescriptions = [
  ['E0', 'Unverified assertion'], ['E1', 'Captured metadata'], ['E2', 'First-party system event'], ['E3', 'Independent partner'], ['E4', 'Controlled inspection'], ['E5', 'Adjudicated outcome'],
]

export function LifecyclePage() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('checkpoint')
  const [phase, setPhase] = useState<Checkpoint['phase'] | 'All'>('All')
  const [coverage, setCoverage] = useState<Checkpoint['coverage'] | 'All'>('All')
  const [expanded, setExpanded] = useState(requested ?? checkpoints[0].id)
  const filtered = useMemo(() => checkpoints.filter((point) => (phase === 'All' || point.phase === phase) && (coverage === 'All' || point.coverage === coverage)), [phase, coverage])

  const open = (id: string) => {
    const next = expanded === id ? '' : id
    setExpanded(next)
    setParams(next ? { checkpoint: next } : {}, { replace: true })
  }

  return (
    <div className="page">
      <PageIntro
        eyebrow="DECISION LIFECYCLE"
        title={<>Fifteen places to <em>make a better call.</em></>}
        description="Each checkpoint freezes only the evidence available at that moment, separates deterministic logic from model assessment, and preserves a reversible cure before any adverse outcome."
        actions={<Badge tone="orange" icon={Network}>15 auditable checkpoints</Badge>}
      />

      <section className="principle-grid" aria-label="Decision design principles">
        <article><ShieldCheck aria-hidden="true" /><div><strong>Human accountability</strong><span>OpenAI recommends; authorized people finalize adverse outcomes.</span></div></article>
        <article><Layers3 aria-hidden="true" /><div><strong>Point-in-time truth</strong><span>No future event can leak into an earlier assessment.</span></div></article>
        <article><CheckCircle2 aria-hidden="true" /><div><strong>Correctable by design</strong><span>Every hold or challenge exposes a proportionate shopper cure.</span></div></article>
        <article><AlertTriangle aria-hidden="true" /><div><strong>Unknown means unknown</strong><span>Abandonment, failure, and inconclusive evidence are not fraud labels.</span></div></article>
      </section>

      <div className="lifecycle-toolbar">
        <span><Filter size={16} aria-hidden="true" /> Filter decision surface</span>
        <div className="segmented" role="group" aria-label="Phase filter">
          {(['All', ...lifecyclePhases] as const).map((item) => <button key={item} type="button" aria-pressed={phase === item} className={phase === item ? 'active' : ''} onClick={() => setPhase(item)}>{item}</button>)}
        </div>
        <label>Coverage<select value={coverage} onChange={(event) => setCoverage(event.target.value as typeof coverage)}><option>All</option><option>All GMV</option><option>Managed network</option><option>Merchant integrated</option></select></label>
      </div>

      <div className="lifecycle-layout">
        <aside className="evidence-legend">
          <p className="eyebrow">PROVENANCE LADDER</p>
          <h2>Confidence comes from how evidence was captured.</h2>
          <div>{tierDescriptions.map(([tier, label]) => <p key={tier}><Badge tone={tier === 'E4' || tier === 'E5' ? 'orange' : 'blue'}>{tier}</Badge><span>{label}</span></p>)}</div>
          <small>Tier measures provenance strength, not guilt. Multiple independent sources may raise reliability; none grants automatic authority.</small>
        </aside>
        <section className="lifecycle-list" aria-label="Lifecycle checkpoints">
          {filtered.map((point) => (
            <div className={`checkpoint-accordion ${expanded === point.id ? 'checkpoint-accordion--open' : ''}`} key={point.id}>
              <button id={`checkpoint-trigger-${point.id}`} type="button" className="checkpoint-accordion__trigger" onClick={() => open(point.id)} aria-expanded={expanded === point.id} aria-controls={`checkpoint-panel-${point.id}`}>
                <span className="checkpoint-number">{String(point.number).padStart(2, '0')}</span>
                <span className="checkpoint-accordion__copy"><small>{point.phase} · {checkpointScope(point.number)} · {point.coverage}</small><strong>{point.label}</strong><span>{point.decision}</span></span>
                <Badge tone={point.evidenceTier === 'E4' || point.evidenceTier === 'E5' ? 'orange' : 'neutral'}>{point.evidenceTier}</Badge>
                <ChevronDown aria-hidden="true" />
              </button>
              {expanded === point.id ? <div id={`checkpoint-panel-${point.id}`} className="checkpoint-accordion__body" role="region" aria-labelledby={`checkpoint-trigger-${point.id}`}><DecisionPipeline checkpoint={point} /></div> : null}
            </div>
          ))}
          {!filtered.length ? (
            <EmptyNotice
              icon={Filter}
              title="No checkpoints in this view"
              actions={<button type="button" className="button button--secondary button--small" onClick={() => { setPhase('All'); setCoverage('All') }}>Reset filters</button>}
            >
              No lifecycle checkpoint matches {phase === 'All' ? 'all phases' : phase} and {coverage === 'All' ? 'all coverage' : coverage}. Broaden the filters to see the decision contract.
            </EmptyNotice>
          ) : null}
        </section>
      </div>
    </div>
  )
}
