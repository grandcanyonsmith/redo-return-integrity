import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Bot, Database, Gavel, LoaderCircle, RefreshCw, Route, Shield, UserCheck } from 'lucide-react'
import { checkpointScope, type Checkpoint, type DecisionStep } from '../domain'
import { useDemo } from '../lib/demo-context'
import { evaluateCheckpoint, type Assessment } from '../lib/api'
import { Badge } from './ui'
import { LiveDecisionOutput } from './LiveDecisionOutput'

const stepIcons = [Database, Route, Bot, Shield, Gavel, UserCheck, ArrowRight]

function overlaySteps(checkpoint: Checkpoint, live?: Assessment): DecisionStep[] {
  const base = [checkpoint.facts, checkpoint.signals, checkpoint.assessment, checkpoint.policy, checkpoint.action, checkpoint.cure, checkpoint.next]
  if (!live) return base
  const risk = live.signals.filter((signal) => signal.riskBearing && signal.status === 'OBSERVED')
  return [
    { ...base[0], detail: Object.keys(live.nativeFacts).length ? Object.entries(live.nativeFacts).slice(0, 4).map(([key, value]) => `${key}: ${typeof value === 'object' ? '…' : String(value)}`).join(' · ') : base[0].detail },
    { ...base[1], detail: risk.length ? risk.map((signal) => signal.label ?? signal.code).join(' · ') : (live.signals.length ? 'No risk-bearing signal fired.' : base[1].detail), tone: risk.length ? 'warn' : 'good' },
    { ...base[2], detail: live.summary, tone: 'ai' },
    { ...base[3], detail: live.policy?.explanation ?? base[3].detail },
    { ...base[4], detail: live.accountableAction ? `${live.accountableAction.action.replaceAll('_', ' ')} · ${live.accountableAction.actor?.replaceAll('_', ' ') ?? 'policy'}` : base[4].detail, tone: 'warn' },
    { ...base[5], detail: live.shopperCure[0]?.label ?? base[5].detail, tone: 'good' },
    { ...base[6], detail: live.nextState?.replaceAll('_', ' ') ?? base[6].detail },
  ]
}

function PipelineStep({ step, index }: { step: DecisionStep; index: number }) {
  const Icon = stepIcons[index]
  return (
    <li className={`pipeline-step pipeline-step--${step.tone ?? 'neutral'}`}>
      <div className="pipeline-step__header">
        <span className="pipeline-step__number"><Icon aria-hidden="true" size={15} /></span>
        <span>{step.title}</span>
      </div>
      <p>{step.detail}</p>
    </li>
  )
}

export function DecisionPipeline({ checkpoint, compact = false }: { checkpoint: Checkpoint; compact?: boolean }) {
  const { state } = useDemo()
  const evaluation = useQuery({
    queryKey: ['evaluate-checkpoint', checkpoint.id, state.physicalFinding],
    queryFn: () => evaluateCheckpoint(checkpoint, state),
  })
  const steps = overlaySteps(checkpoint, evaluation.data)
  return (
    <article className={`decision-card ${compact ? 'decision-card--compact' : ''}`} data-testid={`checkpoint-${checkpoint.id}`}>
      <header className="decision-card__header">
        <div className="decision-card__identity">
          <span className="checkpoint-number">{String(checkpoint.number).padStart(2, '0')}</span>
          <div>
            <div className="decision-card__badges">
              <Badge tone="neutral">{checkpoint.phase}</Badge>
              <Badge tone="neutral">{checkpointScope(checkpoint.number)}</Badge>
              <Badge tone={checkpoint.evidenceTier === 'E4' || checkpoint.evidenceTier === 'E5' ? 'orange' : 'blue'}>{checkpoint.evidenceTier} evidence</Badge>
              <Badge tone="violet">{checkpoint.coverage}</Badge>
              {evaluation.data ? <Badge tone={evaluation.data.mode === 'live' ? 'green' : evaluation.data.mode === 'unavailable' ? 'orange' : 'violet'}>{evaluation.data.mode === 'live' ? 'LIVE OPENAI' : evaluation.data.mode === 'unavailable' ? 'MODEL UNAVAILABLE' : 'SIMULATED FALLBACK'}</Badge> : null}
            </div>
            <h2>{checkpoint.label}</h2>
            <p>{checkpoint.decision}</p>
          </div>
        </div>
        <button className="button button--secondary button--small" onClick={() => evaluation.refetch()} disabled={evaluation.isFetching}>
          {evaluation.isFetching ? <LoaderCircle className="spin" aria-hidden="true" size={16} /> : evaluation.data?.mode === 'live' ? <RefreshCw aria-hidden="true" size={16} /> : <Bot aria-hidden="true" size={16} />}
          {evaluation.isFetching ? 'Assessing…' : 'Refresh live output'}
        </button>
      </header>
      <ol className="decision-pipeline" aria-label={`Decision contract for ${checkpoint.label}`}>
        {steps.map((step, index) => <PipelineStep key={step.title} step={step} index={index} />)}
      </ol>
      <LiveDecisionOutput assessment={evaluation.data} pending={evaluation.isFetching} compact={compact} />
    </article>
  )
}
