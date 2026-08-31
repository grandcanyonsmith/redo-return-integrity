import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

const guardrails = [
  { id: 'two-signals', label: 'Require two independent signals', on: true },
  { id: 'never-deny', label: 'Never deny from score alone', on: true },
  { id: 'alt-route', label: 'Always offer an alternative route', on: true },
  { id: 'restore', label: 'Restore privileges after verified activity', on: true },
] as const

const interventions = [
  { id: 'checkout', label: 'Checkout', value: 'Identity or secure pickup' },
  { id: 'delivery', label: 'Delivery', value: 'Authenticated delivery' },
  { id: 'returns', label: 'Returns', value: 'Verified drop-off' },
  { id: 'refunds', label: 'Refunds', value: 'Inspect before cash refund' },
] as const

export function VerifyPolicyPage() {
  const [low, setLow] = useState(30)
  const [medium, setMedium] = useState(60)
  const [toggles, setToggles] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(guardrails.map((item) => [item.id, item.on])),
  )
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    document.title = 'Fraud Policy Settings · Redo Verify'
  }, [])

  return (
    <div className="vc-main">
      <header className="vc-top">
        <div>
          <h1 className="vc-title">Fraud Policy Settings</h1>
          <p className="vc-lead">Risk thresholds and guardrails for new SKIMS decisions.</p>
        </div>
        <div className="vc-actions">
          <Button type="button" variant="outline" size="sm" onClick={() => { setLow(30); setMedium(60); setSaved(false) }}>
            Discard changes
          </Button>
          <Button type="button" size="sm" onClick={() => setSaved(true)}>Save settings</Button>
        </div>
      </header>
      {saved ? <p className="vc-toast" role="status">Settings saved for this demo session. Existing cases are not affected.</p> : null}

      <div className="vc-grid-2">
        <section className="vc-card">
          <h2>Risk thresholds</h2>
          <label className="vc-slider">
            <span><b className="vc-pill vc-pill--good">LOW</b> Continue normally · {low}</span>
            <input type="range" min={0} max={100} value={low} aria-label="Low risk threshold" onChange={(event) => { setLow(Number(event.target.value)); setSaved(false) }} />
          </label>
          <label className="vc-slider">
            <span><b className="vc-pill vc-pill--warn">MEDIUM</b> Offer light verification · {medium}</span>
            <input type="range" min={0} max={100} value={medium} aria-label="Medium risk threshold" onChange={(event) => { setMedium(Number(event.target.value)); setSaved(false) }} />
          </label>
          <label className="vc-slider">
            <span><b className="vc-risk vc-risk--HIGH">HIGH</b> Require secure route · 100</span>
            <input type="range" min={100} max={100} value={100} disabled aria-label="High risk threshold" />
          </label>
        </section>
        <section className="vc-card">
          <h2>Appeal policy</h2>
          <p className="vc-rows-static"><span>Human review SLA</span><b>24 hours</b></p>
          <p className="vc-rows-static"><span>Evidence retention</span><b>30 days</b></p>
          <p className="vc-note">Notify customers when their case is under review or updated.</p>
        </section>
      </div>

      <section className="vc-card">
        <h2>Guardrails</h2>
        <ul className="vc-guard">
          {guardrails.map((item) => (
            <li key={item.id}>
              <span>{item.label}</span>
              <button
                type="button"
                className="vc-switch"
                role="switch"
                aria-checked={toggles[item.id] !== false}
                aria-label={item.label}
                onClick={() => setToggles((current) => ({ ...current, [item.id]: current[item.id] === false }))}
              >
                <i />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="vc-card">
        <h2>Default interventions</h2>
        <ul className="vc-rows">
          {interventions.map((item) => (
            <li key={item.id}><span>{item.label}</span><b>{item.value}</b></li>
          ))}
        </ul>
      </section>

      <p className="vc-info">Changes apply to new risk decisions only. Existing cases and decisions are not affected.</p>
    </div>
  )
}
