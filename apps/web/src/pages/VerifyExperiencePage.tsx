import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronRight, CreditCard, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import '../verify-console.css'

const options = [
  {
    id: 'identity',
    label: 'Verify my identity',
    detail: 'Use a secure, private verification.',
    icon: CreditCard,
    points: ['Secure and encrypted', 'Takes under 60 seconds', 'We only store the result'],
  },
  {
    id: 'pickup',
    label: 'Pick up securely',
    detail: 'Collect your order at a staffed location.',
    icon: Store,
    points: ['Bring a valid photo ID', 'Staffed pickup location', 'We’ll hold your order'],
  },
] as const

export function VerifyExperiencePage() {
  const [selected, setSelected] = useState<string>('identity')
  const [done, setDone] = useState(false)

  useEffect(() => {
    document.title = 'Checkout verification · Redo Verify'
  }, [])

  return (
    <div className="vx">
      <header className="vx-top">
        <Link to="/verify" className="vc-wordmark" aria-label="Redo Verify">redo<span className="vc-wordmark__verify">verify</span></Link>
        <p>Checkout · Step 2 of 3</p>
        <p className="vx-trust">Secure · Private · Trusted</p>
      </header>
      <ol className="vx-steps" aria-label="Checkout progress">
        <li data-done="true">Order</li>
        <li aria-current="step">Verify</li>
        <li>Complete</li>
      </ol>
      <main className="vx-layout">
        <section className="vx-card">
          {done ? (
            <>
              <h1>You’re all set.</h1>
              <p>Your order continues. Privileges stay restored, and no adverse label was added.</p>
              <Link className="vc-btn" to="/verify/cases/RV-10482">Back to the case</Link>
            </>
          ) : (
            <>
              <h1>One quick verification</h1>
              <p>Choose a secure option to complete your purchase.</p>
              <div className="vx-choices">
                {options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="vx-choice"
                    aria-pressed={selected === option.id}
                    onClick={() => setSelected(option.id)}
                  >
                    <option.icon aria-hidden="true" />
                    <b>{option.label}</b>
                    <small>{option.detail}</small>
                    <ul>
                      {option.points.map((point) => <li key={point}>{point}</li>)}
                    </ul>
                  </button>
                ))}
              </div>
              <Button type="button" className="vx-continue" disabled={!selected} onClick={() => setDone(true)}>
                Continue <ChevronRight aria-hidden="true" />
              </Button>
              <p className="vx-why">Why am I seeing this?</p>
            </>
          )}
        </section>
        <aside>
          <article className="vx-side">
            <small>Order #SK-58421</small>
            <p>2 items</p>
            <b>Total $428.00</b>
          </article>
          <p className="vc-safe"><Check size={16} aria-hidden="true" /> Your information is secure. We only store the verification result.</p>
        </aside>
      </main>
      <footer className="vx-foot">
        <p><Check size={16} aria-hidden="true" /> Your order is reserved. We only store the verification result.</p>
        <p>Most verifications take under 60 seconds.</p>
      </footer>
    </div>
  )
}
