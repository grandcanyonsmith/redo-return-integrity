import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { verifyOverview } from '../lib/verify-demo'

const funnel = [
  { label: 'Risk detected', value: '1,284', pct: '100%' },
  { label: 'Challenge shown', value: '624', pct: '48.6%' },
  { label: 'Customer verified', value: '579', pct: '45.1%' },
  { label: 'Manual review', value: '45', pct: '3.5%' },
] as const

export function VerifyOverviewPage() {
  useEffect(() => {
    document.title = 'Fraud Protection Overview · Redo Verify'
  }, [])

  return (
    <div className="vc-main">
      <header className="vc-top">
        <div>
          <h1 className="vc-title">Fraud Protection Overview</h1>
          <p className="vc-lead">Last 30 days · SKIMS</p>
        </div>
        <div className="vc-actions">
          <span className="vc-chip">Last 30 days</span>
          <Link className="vc-btn vc-btn--ghost" to="/verify/analytics">Export report</Link>
        </div>
      </header>

      <div className="vc-kpis" aria-label="Overview metrics">
        <article><b>{verifyOverview.protectedOrders}</b><span>Protected orders</span><small>{verifyOverview.protectedDelta}</small></article>
        <article><b>{verifyOverview.preventedLoss}</b><span>Prevented loss</span><small>{verifyOverview.preventedDelta}</small></article>
        <article><b>{verifyOverview.completion}</b><span>Customer completion</span><small>{verifyOverview.completionDelta}</small></article>
        <article><b>{verifyOverview.interventions}</b><span>Active interventions</span><small className="vc-warn">{verifyOverview.escalated}</small></article>
      </div>

      <div className="vc-grid-2">
        <section className="vc-card">
          <h2>Risk-to-route outcomes</h2>
          <div className="vc-stack-chart" aria-hidden="true">
            {['May 6', 'May 13', 'May 20', 'May 27', 'Jun 2'].map((label, index) => (
              <div key={label} className="vc-stack">
                <i style={{ height: `${46 + index * 6}%` }} data-tone="normal" />
                <i style={{ height: `${22 + (index % 3) * 4}%` }} data-tone="verified" />
                <i style={{ height: `${6 + (index === 2 ? 6 : 2)}%` }} data-tone="review" />
                <span>{label}</span>
              </div>
            ))}
          </div>
          <p className="vc-legend"><i data-tone="normal" /> Normal route <i data-tone="verified" /> Verified route <i data-tone="review" /> Manual review</p>
        </section>
        <section className="vc-card">
          <h2>Intervention funnel</h2>
          <ol className="vc-funnel">
            {funnel.map((step) => (
              <li key={step.label}>
                <strong>{step.label}</strong>
                <div className="vc-funnel__bar" style={{ width: step.pct }} />
                <span>{step.value} · {step.pct}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="vc-grid-3">
        <section className="vc-card">
          <h2>Top triggers</h2>
          <ul className="vc-rows">
            {verifyOverview.triggers.map((item) => (
              <li key={item.label}><span>{item.label}</span><b>{item.count}</b></li>
            ))}
          </ul>
        </section>
        <section className="vc-card">
          <h2>Route performance</h2>
          <ul className="vc-rows">
            {verifyOverview.routes.map((item) => (
              <li key={item.label}><span>{item.label}</span><b>{item.rate} <small>{item.delta}</small></b></li>
            ))}
          </ul>
        </section>
        <section className="vc-card">
          <h2>Live activity</h2>
          <ul className="vc-activity">
            {verifyOverview.activity.map((item) => (
              <li key={item.order}>
                <small>{item.ago}</small>
                <span>{item.label} · {item.order}</span>
                <em data-tone={item.tone}>{item.tone === 'review' ? 'Review' : 'Verified'}</em>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
