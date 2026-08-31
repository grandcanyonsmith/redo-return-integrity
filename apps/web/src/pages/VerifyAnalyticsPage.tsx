import { useEffect } from 'react'
import { verifyAnalytics } from '../lib/verify-demo'

export function VerifyAnalyticsPage() {
  useEffect(() => {
    document.title = 'Fraud Analytics · Redo Verify'
  }, [])

  return (
    <div className="vc-main">
      <header className="vc-top">
        <div>
          <h1 className="vc-title">Fraud Analytics</h1>
          <p className="vc-lead">Last 90 days · All SKIMS stores</p>
        </div>
        <div className="vc-actions">
          <span className="vc-chip">Last 90 days</span>
          <span className="vc-chip">All stores</span>
          <span className="vc-chip">Export</span>
        </div>
      </header>

      <div className="vc-kpis" aria-label="Analytics metrics">
        <article><b>{verifyAnalytics.preventedLoss}</b><span>Prevented loss</span><small className="vc-good">{verifyAnalytics.preventedLossDelta}</small></article>
        <article><b>{verifyAnalytics.ordersPreserved}</b><span>Orders preserved</span><small className="vc-good">{verifyAnalytics.ordersPreservedDelta}</small></article>
        <article><b>{verifyAnalytics.falsePositiveRate}</b><span>False-positive rate</span><small className="vc-good">{verifyAnalytics.falsePositiveDelta}</small></article>
        <article><b>{verifyAnalytics.appealOverturnRate}</b><span>Appeal overturn rate</span><small className="vc-good">{verifyAnalytics.appealOverturnDelta}</small></article>
      </div>

      <div className="vc-grid-2">
        <section className="vc-card">
          <h2>Loss prevented by scheme</h2>
          <ul className="vc-vbars">
            {verifyAnalytics.schemes.map((item) => (
              <li key={item.label}>
                <span>{item.label}</span>
                <i style={{ height: `${Math.round(item.share * 180 + 24)}px` }} />
                <b>{item.amount}</b>
              </li>
            ))}
          </ul>
        </section>
        <section className="vc-card">
          <h2>Customer completion by intervention</h2>
          <ul className="vc-hbars">
            {verifyAnalytics.completions.map((item) => (
              <li key={item.label}>
                <span>{item.label}</span>
                <div><i style={{ width: `${Math.round(item.rate * 100)}%` }} /></div>
                <b>{(item.rate * 100).toFixed(1)}%</b>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="vc-grid-3">
        <section className="vc-card vc-card--wide">
          <h2>Rule performance</h2>
          <table className="vc-table">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Triggered</th>
                <th>Verified</th>
                <th>Escalated</th>
                <th>Loss prevented</th>
              </tr>
            </thead>
            <tbody>
              {verifyAnalytics.rules.map((row) => (
                <tr key={row.rule}>
                  <td>{row.rule}</td>
                  <td>{row.triggered}</td>
                  <td>{row.verified}</td>
                  <td>{row.escalated}</td>
                  <td>{row.loss}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="vc-card">
          <h2>Friction monitor</h2>
          <p className="vc-score">3.6% <small>overall</small></p>
          <p className="vc-good">↓ 0.5 pp</p>
          <ul className="vc-rows">
            {verifyAnalytics.friction.map((item) => (
              <li key={item.label}><span>{item.label}</span><b>{item.rate}</b></li>
            ))}
          </ul>
        </section>
        <section className="vc-card">
          <h2>Appeal outcomes</h2>
          <p className="vc-score">8.4% <small>overturned</small></p>
          <ul className="vc-rows">
            <li><span>Overturned</span><b>8.4%</b></li>
            <li><span>Upheld</span><b>88.6%</b></li>
            <li><span>Closed without change</span><b>3.0%</b></li>
            <li><span>Total appeals</span><b>2,184</b></li>
          </ul>
        </section>
      </div>
    </div>
  )
}
