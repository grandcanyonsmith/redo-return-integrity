import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Inbox,
  LayoutDashboard,
  PackageSearch,
  Route,
  RotateCcw,
  ScanBarcode,
  Search,
  ShieldCheck,
  Store,
  UserRound,
  Warehouse,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, EmptyNotice, MetricCard, PageIntro } from '../components/ui'
import { formatStatus, outcomeMetrics } from '../domain'
import { useDemo } from '../lib/demo-context'
import { workQueue } from '../lib/work-queue'

const stations = [
  { to: '/merchant', label: 'Merchant console', detail: 'Review, policy, human decision', icon: Store },
  { to: '/operator', label: 'Operator station', detail: 'Capture protocol and live vision', icon: Warehouse },
  { to: '/intake', label: 'Return intake', detail: 'Label lookup and inspection', icon: ScanBarcode },
  { to: '/shopper?journey=checkout', label: 'Shopper journeys', detail: 'Challenge, receipt, contest', icon: UserRound },
]

type OwnerFilter = 'All' | 'Shopper' | 'Operator' | 'Merchant'
const ownerFilters: OwnerFilter[] = ['All', 'Shopper', 'Operator', 'Merchant']

const healthSchemaOk = (body: unknown): body is { ok: boolean; model?: string; openAIConfigured?: boolean } =>
  typeof body === 'object' && body !== null && 'ok' in body

export function DashboardPage() {
  const { state } = useDemo()
  const [query, setQuery] = useState('')
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('All')
  const items = workQueue(state)
  const visible = useMemo(
    () => items.filter((item) => (ownerFilter === 'All' || item.owner === ownerFilter) && `${item.title} ${item.detail} ${item.owner} ${item.status}`.toLowerCase().includes(query.trim().toLowerCase())),
    [items, ownerFilter, query],
  )
  const health = useQuery({
    queryKey: ['api-health'],
    queryFn: async () => {
      const response = await fetch('/api/health', { credentials: 'same-origin' })
      if (!response.ok) throw new Error(`Health ${response.status}`)
      const body: unknown = await response.json()
      if (!healthSchemaOk(body)) throw new Error('Unexpected health payload')
      return body
    },
    retry: false,
  })

  const journeys = [
    { label: 'Checkout', value: formatStatus(state.checkout), tone: state.checkout === 'cleared' ? 'green' as const : 'orange' as const },
    { label: 'Return handoff', value: formatStatus(state.reverseLogistics), tone: state.reverseLogistics === 'cleared' ? 'green' as const : 'blue' as const },
    { label: 'Physical return', value: formatStatus(state.physical), tone: state.physical === 'approved' || state.physical === 'overturned' ? 'green' as const : 'orange' as const },
  ]
  const checkoutDone = state.checkout === 'cleared'
  const handoffDone = state.reverseLogistics === 'cleared'
  const physicalDone = state.physical === 'approved' || state.physical === 'partial' || state.physical === 'overturned'
  const completedJourneys = [checkoutDone, handoffDone, physicalDone].filter(Boolean).length
  const walkthroughComplete = completedJourneys === 3
  const nextItem = items[0]
  const physicalHref = state.physical === 'inspection-hold'
    ? '/operator'
    : state.physical === 'denied' || state.physical === 'evidence-ready'
      ? '/shopper?journey=appeal'
      : '/merchant'
  const guidedSteps = [
    { label: 'Verify checkout', detail: 'Clear a high-value order without assigning a fraud label.', href: '/legacy/shopper?journey=checkout', done: checkoutDone, current: !checkoutDone, icon: CreditCard },
    { label: 'Resolve handoff', detail: 'Use a staffed receipt to explain impossible carrier timing.', href: '/legacy/shopper?journey=return', done: handoffDone, current: checkoutDone && !handoffDone, icon: Route },
    { label: 'Review the return', detail: 'Capture evidence, route a finding, and preserve appeal.', href: physicalHref, done: physicalDone, current: checkoutDone && handoffDone && !physicalDone, icon: PackageSearch },
  ]
  const apiStatus = health.isPending
    ? { label: 'Checking API', tone: 'neutral' as const, icon: Activity }
    : health.isError
      ? { label: 'API offline · local demo ready', tone: 'orange' as const, icon: Activity }
      : health.data.openAIConfigured
        ? { label: `OpenAI ready · ${health.data.model ?? 'configured model'}`, tone: 'green' as const, icon: Bot }
        : { label: 'Safe demo fallback ready', tone: 'violet' as const, icon: ShieldCheck }

  return (
    <div className="page dashboard-page">
      <PageIntro
        compact
        eyebrow="OPERATIONS DASHBOARD"
        title={<>Work the queue. <em>See the proof.</em></>}
        description="Live demo state for SKIMS: open shopper tasks, warehouse inspection, and merchant review — with model output kept separate from accountable decisions."
        actions={<span className="health-status" role="status" aria-live="polite"><Badge tone={apiStatus.tone} icon={apiStatus.icon}>{apiStatus.label}</Badge>{health.isError ? <button type="button" onClick={() => health.refetch()}>Retry</button> : null}</span>}
      />

      <section className="dashboard-command" aria-labelledby="guided-demo-title">
        <div className="dashboard-command__copy">
          <Badge tone={walkthroughComplete ? 'green' : 'orange'} icon={walkthroughComplete ? CheckCircle2 : ClipboardList}>{walkthroughComplete ? 'Walkthrough complete' : 'Recommended next step'}</Badge>
          <h2 id="guided-demo-title">{nextItem ? nextItem.title : walkthroughComplete ? 'Every demo journey is resolved.' : 'An unresolved journey still needs attention.'}</h2>
          <p>{nextItem ? nextItem.detail : walkthroughComplete ? 'The checkout, carrier handoff, and physical-return decision now have a reviewable outcome. Reset the isolated session to run the story again.' : 'Open the current journey step below to continue. The walkthrough is complete only after all three journeys have reviewable outcomes.'}</p>
          <div className="dashboard-progress" aria-label={`${completedJourneys} of 3 demo journeys complete`}>
            <span><strong>{completedJourneys} of 3</strong> journeys complete</span>
            <div aria-hidden="true"><i style={{ width: `${(completedJourneys / 3) * 100}%` }} /></div>
          </div>
          <div className="dashboard-command__actions">
            {nextItem
              ? <Link className="button button--primary" to={nextItem.href}>Continue as {nextItem.owner} <ArrowRight size={16} aria-hidden="true" /></Link>
              : walkthroughComplete
                ? <Link className="button button--primary" to="/legacy/reset"><RotateCcw size={16} aria-hidden="true" /> Reset walkthrough</Link>
                : <Link className="button button--primary" to={physicalHref}>Continue unresolved journey <ArrowRight size={16} aria-hidden="true" /></Link>}
            <Link className="button button--secondary" to="/legacy/lifecycle">Explore the decision lifecycle</Link>
          </div>
        </div>
        <ol className="guided-journey" aria-label="Guided demo journey">
          {guidedSteps.map(({ label, detail, href, done, current, icon: Icon }, index) => (
            <li key={label}>
              <Link to={href} className={`guided-step${done ? ' guided-step--done' : ''}${current ? ' guided-step--current' : ''}`} aria-current={current ? 'step' : undefined}>
                <span className="guided-step__icon">{done ? <CheckCircle2 aria-hidden="true" /> : <Icon aria-hidden="true" />}</span>
                <span className="guided-step__copy"><small>STEP {index + 1}</small><strong>{label}</strong><span>{detail}</span></span>
                <Badge tone={done ? 'green' : current ? 'orange' : 'neutral'}>{done ? 'Complete' : current ? 'Next' : 'Up next'}</Badge>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <div className="dashboard-section-heading">
        <div><span className="eyebrow">ILLUSTRATIVE SCORECARD</span><h2>Outcome model</h2></div>
        <p>Fixture values demonstrate the accounting boundaries; they are not production results.</p>
      </div>
      <div className="metric-grid" aria-label="Illustrative outcome metrics">
        {outcomeMetrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </div>
      <p className="dashboard-note"><ShieldCheck size={15} aria-hidden="true" /> Metrics are illustrative fixtures. Abandoned verification is not counted as fraud. Model output remains a recommendation; people decide adverse outcomes.</p>

      <div className="dashboard-grid">
        <section className="dashboard-panel" aria-label="Work queue">
          <header>
            <div>
              <span className="eyebrow">WORK QUEUE</span>
              <h2>Needs attention <b>{items.length}</b></h2>
            </div>
            <Badge tone={items.length ? 'orange' : 'green'} icon={items.length ? ClipboardList : CheckCircle2}>{items.length ? 'Open work' : 'Clear'}</Badge>
          </header>
          <div className="queue-controls">
            <label className="searchbox"><Search size={16} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by case, owner, or status" aria-label="Filter work queue" /></label>
            <div className="queue-owner-filters" role="group" aria-label="Filter work by owner">
              {ownerFilters.map((owner) => <button key={owner} type="button" aria-pressed={ownerFilter === owner} className={ownerFilter === owner ? 'active' : ''} onClick={() => setOwnerFilter(owner)}>{owner}</button>)}
            </div>
          </div>
          {visible.length ? (
            <ul className="work-list">
              {visible.map((item) => (
                <li key={item.id}>
                  <Link to={item.href} className="work-row">
                    <span className={`work-row__owner work-row__owner--${item.tone}`}>{item.owner}</span>
                    <span className="work-row__copy">
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </span>
                    <Badge tone={item.tone}>{item.status}</Badge>
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNotice
              icon={Inbox}
              title={items.length ? 'No matching work' : 'Queue is clear'}
              actions={query || ownerFilter !== 'All' ? <button type="button" className="button button--secondary button--small" onClick={() => { setQuery(''); setOwnerFilter('All') }}>Clear filters</button> : <Link className="button button--secondary button--small" to="/legacy/reset">Reset demo session</Link>}
            >
              {items.length
                ? 'Nothing in this session matches that filter. Clear it to see open shopper, operator, and merchant tasks.'
                : 'Checkout, logistics, and the physical return have no remaining demo actions. Reset the session to walk the journeys again, or open a station below.'}
            </EmptyNotice>
          )}
        </section>

        <aside className="dashboard-side">
          <section className="dashboard-panel">
            <header>
              <div>
                <span className="eyebrow">SESSION JOURNEYS</span>
                <h2>Where this demo stands</h2>
              </div>
              <LayoutDashboard size={18} aria-hidden="true" />
            </header>
            <dl className="journey-status">
              {journeys.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd><Badge tone={row.tone}>{row.value}</Badge></dd>
                </div>
              ))}
            </dl>
            <p className="dashboard-session">Session <code>{state.sessionId}</code></p>
          </section>
          <section className="dashboard-panel">
            <header>
              <div>
                <span className="eyebrow">STATIONS</span>
                <h2>Jump into a surface</h2>
              </div>
            </header>
            <div className="station-grid">
              {stations.map(({ to, label, detail, icon: Icon }) => (
                <Link key={to} to={to} className="station-card">
                  <Icon aria-hidden="true" />
                  <strong>{label}</strong>
                  <span>{detail}</span>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
