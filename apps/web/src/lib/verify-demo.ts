export const verifyCaseId = 'RV-10482'

export const verifyFeaturedCase = {
  id: verifyCaseId,
  customer: 'Jordan Hale',
  customerId: 'jordan-hale',
  emailMasked: 'j••••@example.com',
  orderId: 'SK-58421',
  placedAt: 'May 20, 2026 · 9:14 AM',
  total: '$428.00',
  itemCount: 2,
  itemLabel: 'Fits Everybody Cami Bodysuit · Onyx · 2',
  risk: 'HIGH' as const,
  status: 'Needs review',
}

export const verifyCases = [
  verifyFeaturedCase,
  { id: 'RV-10471', customer: 'Ava Morgan', customerId: 'ava-morgan', emailMasked: 'a••••@example.com', orderId: 'SK-1042', placedAt: 'May 19, 2026 · 4:02 PM', total: '$116.00', itemCount: 2, itemLabel: 'Fits Everybody Cami Bodysuit', risk: 'HIGH' as const, status: 'Secure route offered' },
  { id: 'RV-10460', customer: 'Noah Chen', customerId: 'noah-chen', emailMasked: 'n••••@example.com', orderId: 'SK-1099', placedAt: 'May 18, 2026 · 11:40 AM', total: '$58.00', itemCount: 1, itemLabel: 'Fits Everybody Cami Bodysuit', risk: 'MEDIUM' as const, status: 'Verified' },
] as const

export const verifyIntegrations = [
  { id: 'fedex', name: 'FedEx Authenticated', category: 'Delivery', status: 'connected', purpose: 'Secure QR delivery' },
  { id: 'ups', name: 'UPS Access Point', category: 'Delivery', status: 'connected', purpose: 'Staffed pickup' },
  { id: 'persona', name: 'Persona', category: 'Identity', status: 'connected', purpose: 'Identity verification' },
  { id: 'happy-returns', name: 'Happy Returns', category: 'Returns', status: 'available', purpose: 'Verified drop-off' },
  { id: 'shiphero', name: 'ShipHero', category: 'Warehouse', status: 'connected', purpose: 'Serial and packing proof' },
  { id: 'entrupy', name: 'Entrupy', category: 'Returns', status: 'available', purpose: 'Item authentication' },
  { id: 'stripe', name: 'Stripe', category: 'Payments', status: 'connected', purpose: 'Payment and refund controls' },
  { id: 'aftership', name: 'AfterShip', category: 'Delivery', status: 'connected', purpose: 'Tracking and proof of delivery' },
] as const

export const verifyIntegrationCategories = ['All', 'Identity', 'Delivery', 'Returns', 'Warehouse', 'Payments'] as const

export const verifyAnalytics = {
  preventedLoss: '$542,880',
  preventedLossDelta: '↑ 18.6%',
  ordersPreserved: '18,420',
  ordersPreservedDelta: '↑ 14.2%',
  falsePositiveRate: '1.7%',
  falsePositiveDelta: '↓ 0.4 pp',
  appealOverturnRate: '8.4%',
  appealOverturnDelta: '↓ 1.2 pp',
  schemes: [
    { label: 'Delivery claims', amount: '$206,340', share: 0.38 },
    { label: 'Serial abuse', amount: '$138,920', share: 0.26 },
    { label: 'Empty box', amount: '$92,480', share: 0.17 },
    { label: 'Item switching', amount: '$63,520', share: 0.12 },
    { label: 'Refund duplication', amount: '$41,620', share: 0.08 },
  ],
  completions: [
    { label: 'Secure pickup', rate: 0.963 },
    { label: 'Authenticated delivery', rate: 0.931 },
    { label: 'Verified drop-off', rate: 0.912 },
    { label: 'Identity verification', rate: 0.884 },
  ],
  rules: [
    { rule: 'Delivery claim risk', triggered: '28,642', verified: '90.1%', escalated: '6.4%', loss: '$206,340' },
    { rule: 'Serial abuse detector', triggered: '19,410', verified: '88.4%', escalated: '7.1%', loss: '$138,920' },
    { rule: 'Empty box protection', triggered: '11,208', verified: '91.2%', escalated: '5.0%', loss: '$92,480' },
    { rule: 'Item switching guard', triggered: '8,640', verified: '86.7%', escalated: '8.2%', loss: '$63,520' },
    { rule: 'Refund duplication check', triggered: '4,918', verified: '89.6%', escalated: '4.8%', loss: '$41,620' },
  ],
  friction: [
    { label: 'Secure pickup', rate: '1.2%' },
    { label: 'Authenticated delivery', rate: '1.4%' },
    { label: 'Verified drop-off', rate: '1.8%' },
    { label: 'Identity verification', rate: '2.1%' },
  ],
}

export const verifyOverview = {
  protectedOrders: '12,482',
  protectedDelta: '+18.6% vs prior 30 days',
  preventedLoss: '$184,320',
  preventedDelta: '+23.4% vs prior 30 days',
  completion: '96.8%',
  completionDelta: '+1.9 pp vs prior 30 days',
  interventions: '8',
  escalated: '2 escalated',
  triggers: [
    { label: 'Repeated delivery claims', count: '4,237' },
    { label: 'Serial return behavior', count: '3,821' },
    { label: 'Empty-box risk', count: '2,146' },
  ],
  routes: [
    { label: 'Secure pickup', rate: '97.1%', delta: '+2.3 pp' },
    { label: 'Authenticated delivery', rate: '96.8%', delta: '+1.8 pp' },
    { label: 'Verified drop-off', rate: '93.7%', delta: '+1.6 pp' },
  ],
  activity: [
    { ago: '2m ago', label: 'Delivery verified', order: 'SK-12345', tone: 'verified' },
    { ago: '5m ago', label: 'Challenge passed', order: 'SK-98765', tone: 'verified' },
    { ago: '12m ago', label: 'Escalated to review', order: 'SK-54321', tone: 'review' },
  ],
}

export const verifyCustomer = {
  id: 'jordan-hale',
  name: 'Jordan Hale',
  since: 'Customer since March 2024',
  score: 72,
  band: 'MEDIUM',
  trend: 'Recovering',
  trendDetail: '+18 points in 30 days',
  privileges: [
    { label: 'Home delivery', value: 'Authenticated' },
    { label: 'Instant refunds', value: 'Up to $100' },
    { label: 'Mail returns', value: 'Inspection required' },
    { label: 'Secure pickup', value: 'Available' },
  ],
  history: [
    { date: 'May 12', label: 'Identity verified', tone: 'good' },
    { date: 'May 15', label: 'Authenticated delivery completed', tone: 'good' },
    { date: 'May 20', label: 'Return inspected and approved', tone: 'good' },
    { date: 'May 22', label: 'Delivery claim filed', tone: 'warn' },
  ],
  signals: [
    { label: '2 email addresses', value: 'All verified' },
    { label: '1 shipping address', value: 'Verified' },
    { label: '2 payment methods', value: 'On file' },
  ],
  orders: [
    { date: 'May 20', type: 'RETURN', id: 'RMA-8821', status: 'Approved', impact: '+12', amount: '−$89.99' },
    { date: 'May 15', type: 'ORDER', id: 'SK-1099', status: 'Delivered', impact: '+8', amount: '$89.99' },
    { date: 'May 12', type: 'ORDER', id: 'SK-58421', status: 'In review', impact: '—', amount: '$428.00' },
  ],
}
