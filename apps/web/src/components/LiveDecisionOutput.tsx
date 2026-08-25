import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Database,
  FileCheck2,
  Gavel,
  LoaderCircle,
  Route,
  Shield,
  Sparkles,
  UserCheck,
} from 'lucide-react'
import type { Assessment } from '../lib/api'
import { Badge, EmptyNotice } from './ui'
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from './ai-elements/chain-of-thought'
import { Reasoning, ReasoningContent, ReasoningTrigger } from './ai-elements/reasoning'
import { Response } from './ai-elements/response'
import { Source, Sources, SourcesContent, SourcesTrigger } from './ai-elements/sources'
import { Tool, ToolContent, ToolHeader, ToolOutput } from './ai-elements/tool'

const pretty = (value: unknown): string => {
  if (value == null || value === '') return '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  try { return JSON.stringify(value) } catch { return String(value) }
}

const numberish = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined

export const visibleQuantity = (assessment: Assessment): string => {
  const expected = numberish(assessment.nativeFacts.expectedQuantity) ?? 2
  const observed = numberish(assessment.nativeFacts.observedQuantity)
  if (observed != null) return `${observed} of ${expected}`
  const empty = assessment.imageFindings.some((finding) => finding.contentsAssessment === 'EMPTY')
  return empty ? `0 of ${expected}` : `— of ${expected}`
}

export const serialsLegible = (assessment: Assessment): string => {
  if (assessment.imageFindings.some((finding) => finding.serialReadable)) return 'Yes'
  if (assessment.imageFindings.length > 0) return 'No'
  return 'Not assessed'
}

export const imageSufficiency = (assessment: Assessment): string => {
  if (assessment.imageFindings.length > 0) return 'Complete'
  if (assessment.mode === 'unavailable') return 'Model unavailable'
  return 'Protocol complete'
}

const modeBadge = (mode: Assessment['mode']) => (
  <Badge tone={mode === 'live' ? 'green' : mode === 'unavailable' ? 'orange' : 'violet'}>
    {mode === 'live' ? 'LIVE OPENAI' : mode === 'unavailable' ? 'MODEL UNAVAILABLE' : 'SIMULATED FALLBACK'}
  </Badge>
)

const factEntries = (facts: Record<string, unknown>) =>
  Object.entries(facts).filter(([, value]) => value != null && value !== '').slice(0, 10)

export function LiveDecisionOutput({
  assessment,
  pending = false,
  compact = false,
}: {
  assessment?: Assessment
  pending?: boolean
  compact?: boolean
}) {
  if (pending && !assessment) {
    return (
      <div className="ai-live ai-live--pending" role="status">
        <div className="ai-live__scan"><LoaderCircle className="spin" aria-hidden="true" /></div>
        <div>
          <small>ASSESSMENT REQUEST</small>
          <strong>Running the decision contract…</strong>
          <p>Native facts → deterministic signals → OpenAI assessment → merchant policy → accountable action.</p>
        </div>
      </div>
    )
  }
  if (!assessment) {
    return (
      <div className="ai-live-empty">
        <EmptyNotice icon={Sparkles} title="No live output yet">
          Run an evidence assessment to see native facts, deterministic signals, assessment rationale, merchant policy, and the accountable next step.
        </EmptyNotice>
      </div>
    )
  }

  const recommendation = assessment.recommendation.replaceAll('_', ' ')
  const observedSignals = assessment.signals.filter((signal) => signal.status === 'OBSERVED' || signal.riskBearing)
  const displaySignals = observedSignals.length > 0 ? observedSignals : assessment.signals.slice(0, 6)

  return (
    <section className={`ai-live ${compact ? 'ai-live--compact' : ''} ai-live--${assessment.mode}`} aria-label="Live decision output">
      <header className="ai-live__top">
        <span><Sparkles aria-hidden="true" /><strong>{assessment.mode === 'live' ? 'OpenAI assessment' : assessment.mode === 'unavailable' ? 'Assessment unavailable' : 'Synthetic assessment fallback'}</strong></span>
        <div className="ai-live__meta">
          {modeBadge(assessment.mode)}
          {assessment.modelVersion ? <Badge tone="neutral">{assessment.modelVersion}</Badge> : null}
          {assessment.latencyMs ? <Badge tone="neutral">{(assessment.latencyMs / 1000).toFixed(1)}s</Badge> : null}
        </div>
      </header>

      <Response>
        <div className="ai-response__kicker">
          <AlertTriangle aria-hidden="true" />
          <div>
            <small>RECOMMENDATION ONLY</small>
            <h3>{recommendation}</h3>
          </div>
          {assessment.confidence != null ? <em>{assessment.confidence.toFixed(2)}</em> : null}
        </div>
        <p>{assessment.summary}</p>
        {assessment.imageFindings.length > 0 ? <div className="vision-result__facts">
          <span><strong>Quantity visible</strong>{visibleQuantity(assessment)}</span>
          <span><strong>Serials legible</strong>{serialsLegible(assessment)}</span>
          <span><strong>Image sufficiency</strong>{imageSufficiency(assessment)}</span>
        </div> : null}
      </Response>

      <Reasoning defaultOpen={false} duration={assessment.latencyMs} isStreaming={pending}>
        <ReasoningTrigger />
        <ReasoningContent>
          {assessment.status ? <p><strong>Status.</strong> {assessment.status} · disposition {recommendation}.</p> : null}
          {assessment.riskIndicators.length > 0 ? (
            <ul className="ai-indicator-list">
              {assessment.riskIndicators.map((indicator) => (
                <li key={`${indicator.code}-${indicator.explanation}`}>
                  <strong>{indicator.code ?? 'RISK'}</strong>
                  <span>{indicator.explanation}</span>
                </li>
              ))}
            </ul>
          ) : <p>No additional risk narrative beyond the deterministic signals.</p>}
          {assessment.exculpatoryIndicators.length > 0 ? (
            <ul className="ai-indicator-list ai-indicator-list--good">
              {assessment.exculpatoryIndicators.map((indicator) => (
                <li key={`${indicator.code}-${indicator.explanation}`}>
                  <strong>{indicator.code ?? 'EXCULPATORY'}</strong>
                  <span>{indicator.explanation}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {assessment.missingEvidence.length > 0 ? <p><strong>Missing.</strong> {assessment.missingEvidence.join(' · ')}</p> : null}
        </ReasoningContent>
      </Reasoning>

      <ChainOfThought defaultOpen={false}>
        <ChainOfThoughtHeader>Decision chain & logic</ChainOfThoughtHeader>
        <ChainOfThoughtContent>
          <ChainOfThoughtStep icon={Database} label="Native facts" status="complete" description="Point-in-time fields only. Future events cannot leak backward.">
            <ChainOfThoughtSearchResults>
              {factEntries(assessment.nativeFacts).map(([key, value]) => (
                <ChainOfThoughtSearchResult key={key}>{key}: {pretty(value)}</ChainOfThoughtSearchResult>
              ))}
              {factEntries(assessment.nativeFacts).length === 0 ? <ChainOfThoughtSearchResult>Fixture facts from this checkpoint</ChainOfThoughtSearchResult> : null}
            </ChainOfThoughtSearchResults>
          </ChainOfThoughtStep>

          <ChainOfThoughtStep icon={Route} label="Deterministic signals" status={displaySignals.some((signal) => signal.riskBearing) ? 'active' : 'complete'} description="Rule evaluation before the model. These codes are inspectable and reproducible.">
            {displaySignals.length === 0 ? <p>No risk-bearing signal fired.</p> : (
              <ul className="ai-signal-list">
                {displaySignals.map((signal) => (
                  <li key={signal.code}>
                    <strong>{signal.label ?? signal.code}</strong>
                    <span>{signal.explanation ?? signal.status}</span>
                    {signal.value != null ? <small>{signal.value}{signal.unit ? ` ${signal.unit}` : ''}{signal.threshold != null ? ` / ${signal.threshold}` : ''}</small> : null}
                  </li>
                ))}
              </ul>
            )}
          </ChainOfThoughtStep>

          <ChainOfThoughtStep icon={Bot} label="OpenAI assessment" status={assessment.mode === 'live' ? 'complete' : 'active'} description={assessment.promptVersion ? `Prompt ${assessment.promptVersion}` : 'Structured recommendation. Not a fraud finding and not an executable refund.'}>
            {assessment.imageFindings.length > 0 ? (
              <ul className="ai-finding-list">
                {assessment.imageFindings.map((finding) => (
                  <li key={finding.evidenceId}>
                    <strong>{finding.contentsAssessment?.replaceAll('_', ' ') ?? 'Image finding'}</strong>
                    <span>{finding.notes || `${finding.packageState ?? 'UNKNOWN'} · serials ${finding.serialReadable ? 'legible' : 'not legible'}`}</span>
                    <small>{finding.evidenceId}</small>
                  </li>
                ))}
              </ul>
            ) : <p>{assessment.summary}</p>}
          </ChainOfThoughtStep>

          <ChainOfThoughtStep icon={Shield} label="Merchant policy" status="complete" description={assessment.policy?.explanation ?? 'Policy constrains the model. It cannot deny.'}>
            <ChainOfThoughtSearchResults>
              {assessment.policy?.policyId ? <ChainOfThoughtSearchResult>{assessment.policy.policyId}</ChainOfThoughtSearchResult> : null}
              {assessment.policy?.action ? <ChainOfThoughtSearchResult>{assessment.policy.action.replaceAll('_', ' ')}</ChainOfThoughtSearchResult> : null}
              {(assessment.policy?.reasonCodes ?? []).map((code) => <ChainOfThoughtSearchResult key={code}>{code}</ChainOfThoughtSearchResult>)}
            </ChainOfThoughtSearchResults>
          </ChainOfThoughtStep>

          <ChainOfThoughtStep icon={Gavel} label="Accountable action" status="complete" description={assessment.accountableAction?.rationale ?? 'A person owns adverse outcomes. The model does not execute them.'}>
            <ChainOfThoughtSearchResults>
              <ChainOfThoughtSearchResult>{(assessment.accountableAction?.action ?? assessment.recommendation).replaceAll('_', ' ')}</ChainOfThoughtSearchResult>
              {assessment.accountableAction?.actor ? <ChainOfThoughtSearchResult>{assessment.accountableAction.actor.replaceAll('_', ' ')}</ChainOfThoughtSearchResult> : <ChainOfThoughtSearchResult>SYSTEM POLICY</ChainOfThoughtSearchResult>}
              {assessment.accountableAction?.reversible === false ? <ChainOfThoughtSearchResult>Not reversible</ChainOfThoughtSearchResult> : <ChainOfThoughtSearchResult>Reversible</ChainOfThoughtSearchResult>}
            </ChainOfThoughtSearchResults>
          </ChainOfThoughtStep>

          <ChainOfThoughtStep icon={UserCheck} label="Shopper cure" status="complete" description="Every hold or challenge exposes a proportionate next step.">
            {assessment.shopperCure.length > 0 ? (
              <ul className="ai-signal-list">
                {assessment.shopperCure.map((cure) => (
                  <li key={cure.label}><strong>{cure.label}</strong><span>{cure.description ?? cure.owner}</span></li>
                ))}
              </ul>
            ) : <p>No additional shopper action required at this checkpoint.</p>}
          </ChainOfThoughtStep>

          <ChainOfThoughtStep icon={ArrowRight} label="Next state" status="complete" description={assessment.nextState?.replaceAll('_', ' ') ?? 'Awaiting merchant'}>
            <p>Contract flow: {assessment.contractFlow.join(' → ')}</p>
          </ChainOfThoughtStep>
        </ChainOfThoughtContent>
      </ChainOfThought>

      {displaySignals.length > 0 ? (
        <Tool defaultOpen={false}>
          <ToolHeader title="deriveDeterministicSignals" state="output-available" />
          <ToolContent>
            <ToolOutput
              output={(
                <pre>{JSON.stringify(displaySignals.map((signal) => ({
                  code: signal.code,
                  status: signal.status,
                  severity: signal.severity,
                  riskBearing: signal.riskBearing,
                  value: signal.value,
                  threshold: signal.threshold,
                })), null, 2)}</pre>
              )}
            />
          </ToolContent>
        </Tool>
      ) : null}

      <Sources defaultOpen={false}>
        <SourcesTrigger count={assessment.evidenceIds.length}>{assessment.evidenceIds.length ? undefined : 'No evidence sources cited'}</SourcesTrigger>
        <SourcesContent>
          {(assessment.evidenceIds.length ? assessment.evidenceIds : ['No evidence IDs cited']).map((id) => (
            <Source key={id} title={id} />
          ))}
        </SourcesContent>
      </Sources>

      <small className="ai-live__footnote">
        <FileCheck2 size={14} aria-hidden="true" />
        {assessment.mode === 'live' ? 'Live OpenAI structured output' : assessment.mode === 'unavailable' ? 'Model error routed to review' : 'Synthetic fallback'}
        {' · '}No refund executed · Human-final adverse decisions
      </small>
    </section>
  )
}
