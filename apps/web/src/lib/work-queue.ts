import type { DemoState } from '../domain'

export type WorkItem = {
  id: string
  title: string
  detail: string
  href: string
  owner: 'Shopper' | 'Operator' | 'Merchant'
  tone: 'orange' | 'blue' | 'violet' | 'green'
  status: string
}

export const workQueue = (state: DemoState): WorkItem[] => {
  const items: WorkItem[] = []
  if (state.checkout === 'challenged') {
    items.push({
      id: 'checkout',
      title: 'Checkout challenge · JC-1042',
      detail: 'High-value order to a new address. Shopper has a one-minute verification — not a fraud label.',
      href: '/shopper?journey=checkout',
      owner: 'Shopper',
      tone: 'orange',
      status: 'Action available',
    })
  }
  if (state.reverseLogistics !== 'cleared') {
    items.push({
      id: 'handoff',
      title: 'Impossible logistics · RMA-8821',
      detail: state.reverseLogistics === 'receipt-reviewed'
        ? 'Staffed receipt selected. Match it to restore the return without an adverse label.'
        : 'Carrier ingest conflicts with the authorized drop-off. Ask for a staffed receipt or open a trace.',
      href: '/shopper?journey=return',
      owner: 'Shopper',
      tone: 'blue',
      status: state.reverseLogistics === 'receipt-reviewed' ? 'Evidence attached' : 'Return paused',
    })
  }
  if (state.physical === 'inspection-hold') {
    items.push({
      id: 'inspect',
      title: 'Managed Verify · capture review',
      detail: 'The six-step synthetic capture is complete. Review native measurements and record a neutral operator observation before any model assessment.',
      href: '/operator',
      owner: 'Operator',
      tone: 'violet',
      status: 'Station DEN-04',
    })
  }
  if (state.physical === 'review-pending') {
    items.push({
      id: 'review',
      title: 'Merchant review · RMA-8821',
      detail: 'Model may recommend HUMAN REVIEW. An authorized reviewer still owns approve, partial, request, or deny.',
      href: '/merchant',
      owner: 'Merchant',
      tone: 'orange',
      status: 'Finding routed',
    })
  }
  if (state.physical === 'denied' || state.physical === 'evidence-ready') {
    items.push({
      id: 'contest',
      title: 'Contest window open',
      detail: 'Shopper can add context before the decision is final. Payment evidence is ready, not submitted.',
      href: '/shopper?journey=appeal',
      owner: 'Shopper',
      tone: 'orange',
      status: state.physical === 'evidence-ready' ? 'Evidence ready · cure open' : '48-hour cure',
    })
  }
  if (state.physical === 'appealed') {
    items.push({
      id: 'appeal',
      title: 'Second human review',
      detail: 'A different reviewer must compare the original evidence with the shopper’s new explanation.',
      href: '/merchant',
      owner: 'Merchant',
      tone: 'blue',
      status: 'Appeal received',
    })
  }
  return items
}
