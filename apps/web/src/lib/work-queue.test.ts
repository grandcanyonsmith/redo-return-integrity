import { newDemoState } from '../domain'
import { workQueue } from './work-queue'

describe('work queue', () => {
  it('opens shopper and operator work from a fresh demo session without priming merchant review', () => {
    const items = workQueue(newDemoState())
    expect(items.map((item) => item.id)).toEqual(['checkout', 'handoff', 'inspect'])
    expect(items.find((item) => item.id === 'checkout')?.href).toBe('/shopper?journey=checkout')
    expect(items.find((item) => item.id === 'handoff')?.href).toBe('/shopper?journey=return')
  })

  it('routes a confirmed finding to merchant and keeps an evidence-ready contest open', () => {
    const state = newDemoState()
    expect(workQueue({ ...state, physical: 'review-pending' }).map((item) => item.id)).toContain('review')
    const evidenceReady = workQueue({ ...state, checkout: 'cleared', reverseLogistics: 'cleared', physical: 'evidence-ready' })
    expect(evidenceReady).toHaveLength(1)
    expect(evidenceReady[0]).toMatchObject({ id: 'contest', href: '/shopper?journey=appeal', owner: 'Shopper' })
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
