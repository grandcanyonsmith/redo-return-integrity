import { useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { verifyCustomer } from '../lib/verify-demo'

export function VerifyCustomersPage() {
  const { customerId } = useParams()
  const profile = !customerId || customerId === verifyCustomer.id ? verifyCustomer : null

  useEffect(() => {
    document.title = 'Customer Trust Profile · Redo Verify'
  }, [])

  if (!profile) return <Navigate to="/verify/customers" replace />

  return (
    <div className="vc-main">
      <header className="vc-top">
        <div>
          <h1 className="vc-title">Customer Trust Profile</h1>
          <p className="vc-lead">Privileges recover after verified activity. A claim is a signal, not a label.</p>
        </div>
        <div className="vc-actions">
          <span className="vc-chip">Add note</span>
          <span className="vc-chip">Review history</span>
        </div>
      </header>

      <div className="vc-grid-4">
        <section className="vc-card">
          <h2>{profile.name}</h2>
          <p className="vc-pill vc-pill--good">Verified customer</p>
          <p className="vc-lead">{profile.since}</p>
          <p className="vc-score">{profile.score} <small>/ 100</small> <span className="vc-risk vc-risk--MEDIUM">{profile.band}</span></p>
          <p className="vc-good">{profile.trend} · {profile.trendDetail}</p>
        </section>
        <section className="vc-card">
          <h2>Current purchase privileges</h2>
          <ul className="vc-rows">
            {profile.privileges.map((item) => (
              <li key={item.label}><span>{item.label}</span><b>{item.value}</b></li>
            ))}
          </ul>
          <p className="vc-note">Privileges update automatically as trust improves.</p>
        </section>
        <section className="vc-card">
          <h2>Trust history</h2>
          <ol className="vc-timeline">
            {profile.history.map((item) => (
              <li key={item.date} data-tone={item.tone}><b>{item.date}</b><span>{item.label}</span></li>
            ))}
          </ol>
        </section>
        <section className="vc-card">
          <h2>Linked signals</h2>
          <ul className="vc-rows">
            {profile.signals.map((item) => (
              <li key={item.label}><span>{item.label}</span><b>{item.value}</b></li>
            ))}
          </ul>
        </section>
      </div>

      <div className="vc-grid-2">
        <section className="vc-card">
          <h2>Orders & returns</h2>
          <table className="vc-table">
            <thead>
              <tr><th>Date</th><th>Type</th><th>ID</th><th>Status</th><th>Trust</th><th>Amount</th></tr>
            </thead>
            <tbody>
              {profile.orders.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{row.type}</td>
                  <td><Link to="/verify/cases/RV-10482">{row.id}</Link></td>
                  <td>{row.status}</td>
                  <td>{row.impact}</td>
                  <td>{row.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="vc-card">
          <h2>Risk decay</h2>
          <p className="vc-note">Trust recovers as Jordan completes successful, verified actions.</p>
          <svg className="vc-spark" viewBox="0 0 320 120" role="img" aria-label="Trust score recovering from 50 to 72">
            <path d="M8 36 C 70 44, 110 58, 150 78 C 180 92, 210 96, 240 70 C 270 48, 300 34, 312 28" fill="none" stroke="#c7c8cb" strokeWidth="3" />
            <path d="M210 96 C 240 70, 270 48, 312 28" fill="none" stroke="#16855b" strokeWidth="3" />
            <circle cx="210" cy="96" r="5" fill="#c13232" />
            <circle cx="270" cy="48" r="5" fill="#16855b" />
            <circle cx="312" cy="28" r="5" fill="#16855b" />
          </svg>
          <p className="vc-legend">Gray decay · red claim · green verified recovery</p>
        </section>
      </div>
    </div>
  )
}
