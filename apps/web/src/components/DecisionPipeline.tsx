import { useQuery } from '@tanstack/react-query'
import { Bot, Database, Gavel, LoaderCircle, RefreshCw, Route, ShieldCheck, UserCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { checkpointScope, type Checkpoint, type DecisionStep } from '../domain'
import { useDemo } from '../lib/demo-context'
import { evaluateCheckpoint } from '../lib/api'
import { Badge } from './ui'
import { LiveDecisionOutput } from './LiveDecisionOutput'

type DecisionZoneProps = {
  icon: LucideIcon
  title: string
  subtitle: string
  steps: DecisionStep[]
  emphasized?: boolean
}

function DecisionZone({ icon: Icon, title, subtitle, steps, emphasized = false }: DecisionZoneProps) {
  return (
    <section className={`decision-zone ${emphasized ? 'decision-zone--emphasized' : ''}`}>
      <header>
        <span><Icon aria-hidden="true" size={17} /></span>
        <div><small>{title}</small><strong>{subtitle}</strong></div>
      </header>
      <div className="decision-zone__steps">
        {steps.map((step) => (
          <div key={step.title} className={`decision-zone__step decision-zone__step--${step.tone ?? 'neutral'}`}>
            <small>{step.title}</small>
            <p>{step.detail}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function DecisionPipeline({
  checkpoint,
  compact = false,
  showIdentity = true,
}: {
  checkpoint: Checkpoint
  compact?: boolean
  showIdentity?: boolean
}) {
  const { state } = useDemo()
  const evaluation = useQuery({
    queryKey: ['evaluate-checkpoint', checkpoint.id, state.physicalFinding],
    queryFn: () => evaluateCheckpoint(checkpoint, state),
  })
  const recommendation = evaluation.data?.recommendation.replaceAll('_', ' ')
  const observedRiskSignals = evaluation.data?.signals.filter((signal) => signal.riskBearing && signal.status === 'OBSERVED') ?? []
  const signalSummary = observedRiskSignals.length
    ? observedRiskSignals.slice(0, 2).map((signal) => signal.label ?? signal.code).join(' · ')
    : 'No risk-bearing signal fired'
  const policySummary = evaluation.data?.policy?.action?.replaceAll('_', ' ') ?? evaluation.data?.policy?.explanation ?? 'No policy result returned'
  const actionSummary = evaluation.data?.accountableAction
    ? `${evaluation.data.accountableAction.action.replaceAll('_', ' ')} · ${evaluation.data.accountableAction.actor?.replaceAll('_', ' ') ?? 'policy owner'}`
    : 'No executable action returned'
  const shopperSummary = evaluation.data?.shopperCure[0]?.label ?? (evaluation.data?.nextState ? evaluation.data.nextState.replaceAll('_', ' ') : 'No additional action required')
  const statusText = evaluation.isFetching
    ? `Assessing ${checkpoint.label}`
    : evaluation.data
      ? `${evaluation.data.mode === 'live' ? 'Live OpenAI' : evaluation.data.mode === 'fallback' ? 'Simulated fallback' : 'Model unavailable'} recommendation: ${recommendation}`
      : `Assessment unavailable for ${checkpoint.label}`

  return (
    <article className={`decision-card ${compact ? 'decision-card--compact' : ''}`} data-testid={`checkpoint-${checkpoint.id}`}>
      {showIdentity ? (
        <header className="decision-card__header">
          <div className="decision-card__identity">
            <span className="checkpoint-number">{String(checkpoint.number).padStart(2, '0')}</span>
            <div>
              <div className="decision-card__badges">
                <Badge tone="neutral">{checkpoint.phase}</Badge>
                <Badge tone="neutral">{checkpointScope(checkpoint.number)}</Badge>
                <Badge tone={checkpoint.evidenceTier === 'E4' || checkpoint.evidenceTier === 'E5' ? 'orange' : 'blue'}>{checkpoint.evidenceTier} evidence</Badge>
                <Badge tone="violet">{checkpoint.coverage}</Badge>
              </div>
              <h2>{checkpoint.label}</h2>
              <p>{checkpoint.decision}</p>
            </div>
          </div>
        </header>
      ) : null}

      <div className="decision-contract-label">
        <small>CHECKPOINT CONTRACT</small>
        <span>Stable requirements for this stage. The sample result appears below.</span>
      </div>
      <div className="decision-zones" aria-label={`Decision contract for ${checkpoint.label}`}>
        <DecisionZone icon={Database} title="Evidence" subtitle="Expected inputs at this stage" steps={[checkpoint.facts]} />
        <DecisionZone icon={Route} title="Assessment" subtitle="Required rules and model task" steps={[checkpoint.signals, checkpoint.assessment]} />
        <DecisionZone icon={Gavel} title="Decision" subtitle="Policy and human ownership" steps={[checkpoint.policy, checkpoint.action]} emphasized />
        <DecisionZone icon={UserCheck} title="Shopper path" subtitle="How the shopper can proceed" steps={[checkpoint.cure, checkpoint.next]} />
      </div>

      <section className="decision-sample" aria-label="Sample evaluation">
        <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{statusText}</span>
        <header>
          <div>
            <small>SAMPLE EVALUATION</small>
            <strong>{evaluation.isFetching && !evaluation.data ? 'Running the decision contract…' : recommendation ?? 'Assessment unavailable'}</strong>
          </div>
          <div className="decision-sample__meta">
            {evaluation.data ? <Badge tone={evaluation.data.mode === 'live' ? 'green' : evaluation.data.mode === 'unavailable' ? 'orange' : 'violet'}>{evaluation.data.mode === 'live' ? 'LIVE OPENAI' : evaluation.data.mode === 'unavailable' ? 'MODEL UNAVAILABLE' : 'SIMULATED FALLBACK'}</Badge> : null}
            {evaluation.data?.confidence != null ? <Badge tone="neutral">{Math.round(evaluation.data.confidence * 100)}% confidence</Badge> : null}
          </div>
        </header>
        {evaluation.isFetching && !evaluation.data ? (
          <p className="decision-sample__loading"><LoaderCircle className="spin" aria-hidden="true" size={17} /> Assessing only the evidence available at this checkpoint.</p>
        ) : (
          <p>{evaluation.data?.summary ?? 'The model did not return a usable assessment. Route this checkpoint to review.'}</p>
        )}
        {evaluation.data?.missingEvidence.length ? <p className="decision-sample__missing"><strong>Still needed:</strong> {evaluation.data.missingEvidence.join(' · ')}</p> : null}
        {evaluation.data ? (
          <div className="decision-sample__chain" aria-label="Returned decision chain">
            <div><small>Evidence used</small><strong>{evaluation.data.evidenceIds.length} cited · {Object.keys(evaluation.data.nativeFacts).length} facts</strong></div>
            <div><small>Observed signals</small><strong>{signalSummary}</strong></div>
            <div><small>Policy result</small><strong>{policySummary}</strong></div>
            <div><small>Accountable action</small><strong>{actionSummary}</strong></div>
            <div><small>Shopper path</small><strong>{shopperSummary}</strong></div>
          </div>
        ) : null}
        <div className="decision-sample__footer">
          <span><ShieldCheck size={15} aria-hidden="true" /> Recommendation only. No adverse action was executed.</span>
          <button className="button button--secondary button--small" type="button" onClick={() => evaluation.refetch()} disabled={evaluation.isFetching}>
            {evaluation.isFetching ? <LoaderCircle className="spin" aria-hidden="true" size={16} /> : evaluation.data ? <RefreshCw aria-hidden="true" size={16} /> : <Bot aria-hidden="true" size={16} />}
            {evaluation.isFetching ? 'Assessing…' : evaluation.data ? 'Run again' : 'Run assessment'}
          </button>
        </div>
      </section>

      <details className="decision-audit">
        <summary>View model rationale, sources, and audit details</summary>
        <div className="decision-audit__content">
          <LiveDecisionOutput assessment={evaluation.data} pending={evaluation.isFetching} compact />
        </div>
      </details>
    </article>
  )
}
