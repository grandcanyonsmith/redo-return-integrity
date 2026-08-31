import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { verifyCases, verifyFeaturedCase } from '../lib/verify-demo'
import { Button } from '@/components/ui/button'

const routes = [
  { id: 'authenticated', label: 'Authenticated delivery', detail: 'Require a secure QR code at the door.' },
  { id: 'pickup', label: 'UPS Access Point pickup', detail: 'Collect at a staffed location with photo ID.' },
] as const

export function VerifyCasePage() {
  const { caseId } = useParams()
  const item = verifyCases.find((row) => row.id === caseId)
  const [route, setRoute] = useState<(typeof routes)[number]['id']>('authenticated')
  const [decision, setDecision] = useState<'secure' | 'normal' | 'escalated' | null>(null)

  useEffect(() => {
    document.title = item ? `Case ${item.id} · Redo Verify` : 'Cases · Redo Verify'
  }, [item])

  if (!item) return <Navigate to="/verify/cases" replace />

  return (
    <div className="vc-main">
      <header className="vc-top">
        <div>
          <Link className="vc-back" to="/verify/cases">Cases</Link>
          <h1 className="vc-title">
            Case #{item.id}
            <span className={`vc-risk vc-risk--${item.risk}`}>{item.risk} RISK</span>
            <span className="vc-pill">{item.status}</span>
          </h1>
        </div>
        <div className="vc-actions">
          <Button type="button" variant="outline" size="sm" onClick={() => setDecision('escalated')}>Escalate</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setDecision('secure')}>Require secure route</Button>
          <Button type="button" size="sm" onClick={() => setDecision('normal')}>Approve normal route</Button>
        </div>
      </header>
      {decision ? (
        <p className="vc-toast" role="status">
          {decision === 'normal'
            ? 'Normal route approved for this demo. Privileges stay intact.'
            : decision === 'secure'
              ? 'Secure route required. The customer will see two ways forward.'
              : 'Escalated to an independent reviewer. Nothing was denied.'}
        </p>
      ) : null}

      <dl className="vc-meta">
        <div><dt>Customer</dt><dd><Link to={`/verify/customers/${item.customerId}`}>{item.customer}</Link> · {item.emailMasked}</dd></div>
        <div><dt>Order</dt><dd>{item.orderId} · {item.placedAt}</dd></div>
        <div><dt>Total</dt><dd>{item.total}</dd></div>
        <div><dt>Items</dt><dd>{item.itemCount} · {item.itemLabel}</dd></div>
      </dl>

      <div className="vc-grid-3">
        <section className="vc-card">
          <h2>Risk signals</h2>
          <ul className="vc-signals">
            <li data-tone="high"><b>Repeat delivery claims</b><span>2 claims in the last 90 days</span></li>
            <li data-tone="medium"><b>Address changed after checkout</b><span>Updated 2 minutes after the order</span></li>
            <li data-tone="pass"><b>Trusted payment authentication</b><span>3DS authenticated · AVS match</span></li>
          </ul>
        </section>
        <section className="vc-card">
          <h2>Event timeline</h2>
          <ol className="vc-timeline">
            <li><b>9:14 AM</b><span>Order placed · {item.total} · {item.itemCount} items</span></li>
            <li><b>9:16 AM</b><span>Address changed</span></li>
            <li><b>9:16 AM</b><span>Risk rescored to high</span></li>
            <li><b>9:16 AM</b><span>Secure route recommended · awaiting review</span></li>
          </ol>
        </section>
        <section className="vc-card">
          <h2>Recommended action</h2>
          <div className="vc-options">
            {routes.map((option) => (
              <button
                key={option.id}
                type="button"
                className="vc-option"
                aria-pressed={route === option.id}
                onClick={() => setRoute(option.id)}
              >
                <span className="vc-option__icon"><Shield size={16} aria-hidden="true" /></span>
                <span><b>{option.label}</b><small>{option.detail}</small></span>
              </button>
            ))}
          </div>
          <p className="vc-note">This action balances security with a smooth customer experience.</p>
        </section>
      </div>

      <div className="vc-grid-2">
        <section className="vc-card">
          <h2>Evidence</h2>
          <dl className="vc-facts">
            <div><dt>Payment</dt><dd>Visa · 4242 · 3DS Authenticated · AVS Match</dd></div>
            <div><dt>Address history</dt><dd>123 Melrose Ave → 456 Oak Ave, 2 minutes later</dd></div>
            <div><dt>Delivery history</dt><dd>8 orders · 2 claims · 25% claim rate</dd></div>
            <div><dt>Customer message</dt><dd>“Please deliver to the back door. Ring doorbell.”</dd></div>
          </dl>
        </section>
        <section className="vc-card">
          <h2>Customer experience</h2>
          <p>Let’s verify your delivery. Choose a secure option to complete your order.</p>
          <Link className="vc-btn" to="/verify/experience">Preview experience</Link>
        </section>
      </div>

      {item.id !== verifyFeaturedCase.id ? <p className="vc-note">This row uses the same review pattern as {verifyFeaturedCase.id}.</p> : null}
    </div>
  )
}
