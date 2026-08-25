import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardList,
  Inbox,
  LayoutDashboard,
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
  { to: '/shopper', label: 'Shopper journeys', detail: 'Challenge, receipt, contest', icon: UserRound },
]

const healthSchemaOk = (body: unknown): body is { ok: boolean; model?: string; openAIConfigured?: boolean } =>
  typeof body === 'object' && body !== null && 'ok' in body

export function DashboardPage() {
  const { state } = useDemo()
  const [query, setQuery] = useState('')
  const items = workQueue(state)
  const visible = useMemo(
    () => items.filter((item) => `${item.title} ${item.detail} ${item.owner} ${item.status}`.toLowerCase().includes(query.trim().toLowerCase())),
    [items, query],
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

  return (
    <div className="page dashboard-page">
      <PageIntro
        compact
        eyebrow="OPERATIONS DASHBOARD"
        title={<>Work the queue. <em>See the proof.</em></>}
        description="Live demo state for Juniper Circuit: open shopper tasks, warehouse inspection, and merchant review — with model output kept separate from accountable decisions."
        actions={<Badge tone={health.data?.openAIConfigured ? 'green' : 'violet'} icon={health.data?.openAIConfigured ? Bot : Activity}>{health.data?.openAIConfigured ? `API ready · ${health.data.model ?? 'OpenAI'}` : health.isError ? 'API unreachable' : 'Checking API'}</Badge>}
      />

      <div className="metric-grid" aria-label="Illustrative outcome metrics">
        {outcomeMetrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </div>
      <p className="dashboard-note"><ShieldCheck size={15} aria-hidden="true" /> Metrics are illustrative fixtures. Abandoned verification is not counted as fraud. Live OpenAI recommends; people decide adverse outcomes.</p>

      <div className="dashboard-grid">
        <section className="dashboard-panel" aria-label="Work queue">
          <header>
            <div>
              <span className="eyebrow">WORK QUEUE</span>
              <h2>Needs attention <b>{items.length}</b></h2>
            </div>
            <Badge tone={items.length ? 'orange' : 'green'} icon={items.length ? ClipboardList : CheckCircle2}>{items.length ? 'Open work' : 'Clear'}</Badge>
          </header>
          <label className="searchbox"><Search size={16} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by case, owner, or status" aria-label="Filter work queue" /></label>
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
              actions={query ? <button type="button" className="button button--secondary button--small" onClick={() => setQuery('')}>Clear filter</button> : <Link className="button button--secondary button--small" to="/reset">Reset demo session</Link>}
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
