import { ArrowLeft, ArrowRight, Filter, Network, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DecisionPipeline } from '../components/DecisionPipeline'
import { Badge, EmptyNotice, PageIntro } from '../components/ui'
import { checkpointScope, checkpoints, lifecyclePhases, type Checkpoint } from '../domain'

const tierDescriptions = [
  ['E0', 'Shopper assertion'],
  ['E1', 'Captured metadata'],
  ['E2', 'First-party system event'],
  ['E3', 'Independent partner event'],
  ['E4', 'Controlled inspection'],
  ['E5', 'Adjudicated outcome'],
] as const

const coverageOptions = ['All', 'All GMV', 'Managed network', 'Merchant integrated'] as const

const shortLabels: Record<string, string> = {
  VISIT_SESSION: 'Visit',
  IDENTITY_LINK: 'Identity',
  CHECKOUT_PAYMENT: 'Payment',
  ORDER_RELEASE: 'Release',
  OUTBOUND_PACK: 'Pack',
  OUTBOUND_CUSTODY: 'Carrier handoff',
  DELIVERY_POSSESSION: 'Delivery',
  RETURN_REQUEST: 'Request',
  RETURN_AUTHORIZATION: 'Authorization',
  REVERSE_HANDOFF: 'Drop-off',
  REVERSE_TRANSIT: 'Return transit',
  WAREHOUSE_RECEIPT: 'Receive',
  ITEM_INSPECTION: 'Inspect',
  REFUND_SETTLEMENT: 'Refund',
  CONTEST_APPEAL_RECOVERY: 'Appeal',
}

function evidenceLabel(tier: Checkpoint['evidenceTier']) {
  return tierDescriptions.find(([key]) => key === tier)?.[1] ?? 'Evidence'
}

function lifecycleParams(point: Checkpoint | undefined, phase: Checkpoint['phase'], coverage: Checkpoint['coverage'] | 'All') {
  const next = new URLSearchParams({ phase })
  if (point) next.set('checkpoint', point.id)
  if (coverage !== 'All') next.set('coverage', coverage)
  return next
}

export function LifecyclePage() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('checkpoint')
  const requestedCheckpoint = checkpoints.find((point) => point.id === requested)
  const requestedPhase = lifecyclePhases.find((item) => item === params.get('phase'))
  const requestedCoverage = coverageOptions.find((item) => item === params.get('coverage')) ?? 'All'
  const coverageMismatch = Boolean(requestedCheckpoint && requestedCoverage !== 'All' && requestedCheckpoint.coverage !== requestedCoverage)
  const phase = requestedCheckpoint?.phase ?? requestedPhase ?? 'Purchase'
  const coverage = coverageMismatch ? 'All' : requestedCoverage
  const filtered = useMemo(
    () => checkpoints.filter((point) => point.phase === phase && (coverage === 'All' || point.coverage === coverage)),
    [phase, coverage],
  )
  const selected = requestedCheckpoint ?? filtered[0]

  useEffect(() => {
    if (coverageMismatch && requestedCheckpoint) {
      setParams(lifecycleParams(requestedCheckpoint, requestedCheckpoint.phase, 'All'), { replace: true })
    } else if (!requestedCheckpoint && selected && requested !== selected.id) {
      setParams(lifecycleParams(selected, selected.phase, coverage), { replace: true })
    }
  }, [coverage, coverageMismatch, requested, requestedCheckpoint, selected, setParams])

  const chooseCheckpoint = (point: Checkpoint) => {
    const nextCoverage = coverage !== 'All' && coverage !== point.coverage ? 'All' : coverage
    setParams(lifecycleParams(point, point.phase, nextCoverage))
  }

  const choosePhase = (nextPhase: Checkpoint['phase']) => {
    const first = checkpoints.find((point) => point.phase === nextPhase && (coverage === 'All' || point.coverage === coverage))
    setParams(lifecycleParams(first, nextPhase, coverage))
  }

  const chooseCoverage = (nextCoverage: Checkpoint['coverage'] | 'All') => {
    const first = checkpoints.find((point) => point.phase === phase && (nextCoverage === 'All' || point.coverage === nextCoverage))
    setParams(lifecycleParams(first, phase, nextCoverage))
  }

  const navigationPoints = coverage === 'All' ? checkpoints : checkpoints.filter((point) => point.coverage === coverage)
  const selectedIndex = selected ? navigationPoints.findIndex((point) => point.id === selected.id) : -1
  const previous = selectedIndex > 0 ? navigationPoints[selectedIndex - 1] : undefined
  const next = selectedIndex >= 0 && selectedIndex < navigationPoints.length - 1 ? navigationPoints[selectedIndex + 1] : undefined

  return (
    <div className="page page--lifecycle">
      <PageIntro
        compact
        eyebrow="DECISION LIFECYCLE"
        title={<>How every decision <em>gets made.</em></>}
        description="Choose a checkpoint to see what evidence exists, what OpenAI recommends, who owns the decision, and how the shopper can respond."
        actions={<Badge tone="orange" icon={Network}>15 checkpoints</Badge>}
      />

      <div className="lifecycle-guardrail" role="note">
        <ShieldCheck aria-hidden="true" size={18} />
        <span><strong>Evidence is frozen at each checkpoint.</strong> OpenAI recommends, policy constrains, a person owns adverse outcomes, and every hold has a path forward.</span>
      </div>

      <div className="lifecycle-toolbar">
        <span className="lifecycle-toolbar__label">View checkpoints</span>
        <div className="segmented" role="group" aria-label="Phase filter">
          {lifecyclePhases.map((item) => (
            <button key={item} type="button" aria-pressed={phase === item} className={phase === item ? 'active' : ''} onClick={() => choosePhase(item)}>
              {item}<small aria-hidden="true">{checkpoints.filter((point) => point.phase === item).length}</small>
            </button>
          ))}
        </div>
        <label className="lifecycle-coverage">
          <Filter size={15} aria-hidden="true" /> Coverage
          <select value={coverage} onChange={(event) => chooseCoverage(event.target.value as typeof coverage)}>
            <option>All</option>
            <option>All GMV</option>
            <option>Managed network</option>
            <option>Merchant integrated</option>
          </select>
        </label>
      </div>

      {selected ? (
        <div className="lifecycle-workspace">
          <aside className="lifecycle-index" aria-label={`${phase} checkpoints`}>
            <header><span>{phase}</span><strong>{filtered.length} checkpoints</strong></header>
            <div className="lifecycle-index__items">
              {filtered.map((point) => (
                <button
                  key={point.id}
                  type="button"
                  className={selected.id === point.id ? 'lifecycle-index__item lifecycle-index__item--active' : 'lifecycle-index__item'}
                  aria-current={selected.id === point.id ? 'step' : undefined}
                  onClick={() => chooseCheckpoint(point)}
                >
                  <span>{String(point.number).padStart(2, '0')}</span>
                  <strong>{shortLabels[point.id] ?? point.label}</strong>
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              ))}
            </div>
            <details className="lifecycle-evidence-guide">
              <summary>Evidence strength guide</summary>
              <div>{tierDescriptions.map(([tier, label]) => <p key={tier}><Badge tone={tier === 'E4' || tier === 'E5' ? 'orange' : 'blue'}>{tier}</Badge><span>{label}</span></p>)}</div>
              <small>Strength reflects how evidence was captured—not whether a shopper committed fraud.</small>
            </details>
          </aside>

          <section className="lifecycle-detail" aria-labelledby={`checkpoint-title-${selected.id}`}>
            <header className="lifecycle-detail__header">
              <div>
                <span className="eyebrow">CHECKPOINT {String(selected.number).padStart(2, '0')} OF 15</span>
                <h2 id={`checkpoint-title-${selected.id}`}>{selected.label}</h2>
                <p>{selected.decision}</p>
              </div>
              <div className="lifecycle-detail__badges">
                <Badge tone="neutral">{checkpointScope(selected.number)}</Badge>
                <Badge tone="violet">{selected.coverage}</Badge>
                <Badge tone={selected.evidenceTier === 'E4' || selected.evidenceTier === 'E5' ? 'orange' : 'blue'}>{evidenceLabel(selected.evidenceTier)} · {selected.evidenceTier}</Badge>
              </div>
            </header>

            <DecisionPipeline checkpoint={selected} showIdentity={false} />

            <nav className="lifecycle-step-nav" aria-label="Previous and next lifecycle checkpoints">
              {previous ? <button type="button" className="lifecycle-step-nav__button" onClick={() => chooseCheckpoint(previous)}><ArrowLeft size={16} aria-hidden="true" /><span><small>Previous</small>{shortLabels[previous.id] ?? previous.label}</span></button> : <span />}
              {next ? <button type="button" className="lifecycle-step-nav__button lifecycle-step-nav__button--next" onClick={() => chooseCheckpoint(next)}><span><small>Next</small>{shortLabels[next.id] ?? next.label}</span><ArrowRight size={16} aria-hidden="true" /></button> : null}
            </nav>
          </section>
        </div>
      ) : (
        <EmptyNotice
          icon={Filter}
          title="No checkpoints in this view"
          actions={<button type="button" className="button button--secondary button--small" onClick={() => chooseCoverage('All')}>Reset filters</button>}
        >
          No {phase.toLowerCase()} checkpoint uses {coverage}. Choose another coverage or reset the filter.
        </EmptyNotice>
      )}
    </div>
  )
}
