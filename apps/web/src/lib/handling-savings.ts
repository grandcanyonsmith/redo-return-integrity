// Time-saved statistics for the post-capture intake flow: after the operator
// photographs the label and package, AI runs the contents inspection and drafts
// the shopper reach-out, and a human only reviews and approves. "Assisted" times
// for the AI steps are MEASURED from this run's model latency; the manual
// baselines, human-review time, and loaded labor rate are DECLARED, illustrative
// planning assumptions — not measured Redo data. This is throughput saved, never
// fraud prevention or recovery.

export type HandlingStepBasis = 'MEASURED_AI' | 'DECLARED_HUMAN'

export interface HandlingSavingsAssumptions {
  manualInspectionMinutes: number
  manualCommunicationMinutes: number
  humanReviewMinutes: number
  loadedLaborRateDollarsPerHour: number
}

// The loaded labor rate matches the domain metrics fixtures ($32/hr).
export const defaultHandlingSavingsAssumptions: HandlingSavingsAssumptions = {
  manualInspectionMinutes: 9,
  manualCommunicationMinutes: 6,
  humanReviewMinutes: 1.5,
  loadedLaborRateDollarsPerHour: 32,
}

export interface HandlingSavingsInput {
  inspectionLatencyMs: number
  draftLatencyMs?: number | null
  assumptions?: Partial<HandlingSavingsAssumptions>
}

export interface HandlingSavingsStep {
  step: string
  basis: HandlingStepBasis
  baselineMinutes: number
  assistedMinutes: number
  savedMinutes: number
}

export interface HandlingSavings {
  draftGenerated: boolean
  measuredAiSeconds: number
  baselineMinutes: number
  assistedMinutes: number
  minutesSaved: number
  percentReduction: number
  laborDollarsSaved: number
  steps: HandlingSavingsStep[]
  assumptions: HandlingSavingsAssumptions
}

const nonNegativeMs = (value: number | null | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0

export function estimateHandlingSavings(input: HandlingSavingsInput): HandlingSavings {
  const assumptions = { ...defaultHandlingSavingsAssumptions, ...input.assumptions }
  const inspectionMs = nonNegativeMs(input.inspectionLatencyMs)
  const draftGenerated = input.draftLatencyMs !== undefined && input.draftLatencyMs !== null
  const draftMs = draftGenerated ? nonNegativeMs(input.draftLatencyMs) : 0
  const inspectionAssistedMinutes = inspectionMs / 60_000
  const draftAssistedMinutes = draftMs / 60_000

  const steps: HandlingSavingsStep[] = [
    {
      step: 'Inspect & compare contents',
      basis: 'MEASURED_AI',
      baselineMinutes: assumptions.manualInspectionMinutes,
      assistedMinutes: inspectionAssistedMinutes,
      savedMinutes: assumptions.manualInspectionMinutes - inspectionAssistedMinutes,
    },
  ]
  if (draftGenerated) {
    steps.push({
      step: 'Draft shopper reach-out',
      basis: 'MEASURED_AI',
      baselineMinutes: assumptions.manualCommunicationMinutes,
      assistedMinutes: draftAssistedMinutes,
      savedMinutes: assumptions.manualCommunicationMinutes - draftAssistedMinutes,
    })
  }
  steps.push({
    step: 'Human review & approve',
    basis: 'DECLARED_HUMAN',
    baselineMinutes: 0,
    assistedMinutes: assumptions.humanReviewMinutes,
    savedMinutes: -assumptions.humanReviewMinutes,
  })

  const baselineMinutes = assumptions.manualInspectionMinutes
    + (draftGenerated ? assumptions.manualCommunicationMinutes : 0)
  const assistedMinutes = inspectionAssistedMinutes + draftAssistedMinutes + assumptions.humanReviewMinutes
  const minutesSaved = Math.max(0, baselineMinutes - assistedMinutes)
  const percentReduction = baselineMinutes > 0 ? minutesSaved / baselineMinutes : 0
  const laborDollarsSaved = (minutesSaved / 60) * assumptions.loadedLaborRateDollarsPerHour

  return {
    draftGenerated,
    measuredAiSeconds: (inspectionMs + draftMs) / 1_000,
    baselineMinutes,
    assistedMinutes,
    minutesSaved,
    percentReduction,
    laborDollarsSaved,
    steps,
    assumptions,
  }
}
