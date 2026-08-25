import { checkpoints, newDemoState } from './domain'

describe('decision lifecycle', () => {
  it('contains the full ordered 15-checkpoint lifecycle', () => {
    expect(checkpoints).toHaveLength(15)
    expect(checkpoints.map((point) => point.number)).toEqual(Array.from({ length: 15 }, (_, index) => index + 1))
    expect(checkpoints[0].id).toBe('VISIT_SESSION')
    expect(checkpoints[14].id).toBe('CONTEST_APPEAL_RECOVERY')
  })

  it('gives every checkpoint the complete visible decision contract', () => {
    for (const point of checkpoints) {
      expect(point.facts.detail).toBeTruthy()
      expect(point.signals.detail).toBeTruthy()
      expect(point.assessment.detail).toBeTruthy()
      expect(point.policy.detail).toBeTruthy()
      expect(point.action.detail).toBeTruthy()
      expect(point.cure.detail).toBeTruthy()
      expect(point.next.detail).toBeTruthy()
    }
  })

  it('keeps a fresh case on reversible holds rather than an adverse final state', () => {
    const state = newDemoState()
    expect(state.checkout).toBe('challenged')
    expect(state.reverseLogistics).toBe('inconsistent')
    expect(state.physical).toBe('inspection-hold')
  })

  it('states that identity challenge noncompletion is not a fraud outcome', () => {
    const identityPoints = checkpoints.filter((point) => point.number <= 4)
    expect(identityPoints.some((point) => `${point.facts.detail} ${point.signals.detail} ${point.assessment.detail} ${point.cure.detail}`.includes('not fraudulent'))).toBe(true)
    expect(identityPoints.some((point) => point.policy.detail.includes('cannot itself deny') || point.policy.detail.includes('No model can auto-deny'))).toBe(true)
  })
})
