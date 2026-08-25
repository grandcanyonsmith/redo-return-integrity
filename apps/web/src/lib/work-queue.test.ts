import { newDemoState } from '../domain'
import { workQueue } from './work-queue'

describe('work queue', () => {
  it('opens shopper, operator, and merchant work from a fresh demo session', () => {
    expect(workQueue(newDemoState()).map((item) => item.id)).toEqual(['checkout', 'handoff', 'inspect', 'review'])
  })

  it('is empty when the session journeys are resolved', () => {
    const cleared = {
      ...newDemoState(),
      checkout: 'cleared' as const,
      reverseLogistics: 'cleared' as const,
      physical: 'approved' as const,
    }
    expect(workQueue(cleared)).toEqual([])
  })
})
