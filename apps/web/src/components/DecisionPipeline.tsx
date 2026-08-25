import { useMutation } from '@tanstack/react-query'
import { ArrowRight, Bot, Check, Database, FileCheck2, Gavel, LoaderCircle, RefreshCw, Route, Shield, UserCheck } from 'lucide-react'
import { checkpointScope, type Checkpoint, type DecisionStep } from '../domain'
import { useDemo } from '../lib/demo-context'
import { evaluateCheckpoint } from '../lib/api'
import { Badge } from './ui'

const stepIcons = [Database, Route, Bot, Shield, Gavel, UserCheck, ArrowRight]

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
  const evaluation = useMutation({ mutationFn: () => evaluateCheckpoint(checkpoint, state) })
  const steps = [checkpoint.facts, checkpoint.signals, checkpoint.assessment, checkpoint.policy, checkpoint.action, checkpoint.cure, checkpoint.next]
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
            </div>
            <h2>{checkpoint.label}</h2>
            <p>{checkpoint.decision}</p>
          </div>
        </div>
        {!compact ? (
          <button className="button button--secondary button--small" onClick={() => evaluation.mutate()} disabled={evaluation.isPending}>
            {evaluation.isPending ? <LoaderCircle className="spin" aria-hidden="true" size={16} /> : <Bot aria-hidden="true" size={16} />}
            {evaluation.isPending ? 'Assessing…' : 'Run assessment'}
          </button>
        ) : null}
      </header>
      <ol className="decision-pipeline" aria-label={`Decision contract for ${checkpoint.label}`}>
        {steps.map((step, index) => <PipelineStep key={step.title} step={step} index={index} />)}
      </ol>
      {evaluation.data ? (
        <div className={`assessment-result assessment-result--${evaluation.data.mode}`} role="status">
          <span className="assessment-result__icon">
            {evaluation.data.mode === 'live' ? <Check aria-hidden="true" size={18} /> : <RefreshCw aria-hidden="true" size={18} />}
          </span>
          <div>
            <div className="assessment-result__title">
              <strong>{evaluation.data.recommendation.replaceAll('_', ' ')}</strong>
              <Badge tone={evaluation.data.mode === 'live' ? 'green' : evaluation.data.mode === 'unavailable' ? 'orange' : 'violet'}>{evaluation.data.mode === 'live' ? 'LIVE OPENAI' : evaluation.data.mode === 'unavailable' ? 'MODEL UNAVAILABLE' : 'SIMULATED FALLBACK'}</Badge>
            </div>
            <p>{evaluation.data.summary}</p>
            <small><FileCheck2 size={13} aria-hidden="true" /> Evidence: {evaluation.data.evidenceIds.join(', ') || 'none cited'} · Recommendation only — no action executed.</small>
          </div>
        </div>
      ) : null}
    </article>
  )
}
