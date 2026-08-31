import { defaultHandlingSavingsAssumptions, estimateHandlingSavings } from './handling-savings'

describe('estimateHandlingSavings', () => {
  it('counts only the inspection step before the shopper reach-out is drafted', () => {
    const result = estimateHandlingSavings({ inspectionLatencyMs: 0 })
    expect(result.draftGenerated).toBe(false)
    expect(result.steps.map((step) => step.step)).toEqual([
      'Inspect & compare contents',
      'Human review & approve',
    ])
    expect(result.baselineMinutes).toBe(defaultHandlingSavingsAssumptions.manualInspectionMinutes)
    // assisted = 0 min measured AI + 1.5 min declared human review
    expect(result.assistedMinutes).toBeCloseTo(defaultHandlingSavingsAssumptions.humanReviewMinutes, 6)
    expect(result.minutesSaved).toBeCloseTo(9 - 1.5, 6)
  })

  it('adds the reach-out step and measures this run\'s AI latency once the draft exists', () => {
    const result = estimateHandlingSavings({ inspectionLatencyMs: 2_000, draftLatencyMs: 3_000 })
    expect(result.draftGenerated).toBe(true)
    expect(result.measuredAiSeconds).toBeCloseTo(5, 6)
    expect(result.baselineMinutes).toBe(15) // 9 + 6
    expect(result.assistedMinutes).toBeCloseTo(5_000 / 60_000 + 1.5, 6)
    expect(result.minutesSaved).toBeCloseTo(15 - (5_000 / 60_000 + 1.5), 6)
    expect(result.percentReduction).toBeGreaterThan(0.8)
    expect(result.laborDollarsSaved).toBeCloseTo((result.minutesSaved / 60) * 32, 6)
    expect(result.steps.map((step) => step.basis)).toEqual(['MEASURED_AI', 'MEASURED_AI', 'DECLARED_HUMAN'])
  })

  it('never reports negative savings and honors overridden assumptions', () => {
    const result = estimateHandlingSavings({
      inspectionLatencyMs: 60_000 * 20, // pathological 20-minute AI call
      assumptions: { manualInspectionMinutes: 4, humanReviewMinutes: 2, loadedLaborRateDollarsPerHour: 60 },
    })
    expect(result.minutesSaved).toBe(0)
    expect(result.percentReduction).toBe(0)
    expect(result.laborDollarsSaved).toBe(0)
  })

  it('treats invalid latency as zero measured time', () => {
    const result = estimateHandlingSavings({ inspectionLatencyMs: -5, draftLatencyMs: Number.NaN })
    expect(result.measuredAiSeconds).toBe(0)
    expect(result.draftGenerated).toBe(true)
  })
})
