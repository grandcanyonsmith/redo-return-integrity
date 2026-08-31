import { useEffect, useMemo, useState } from 'react'
import { verifyIntegrationCategories, verifyIntegrations } from '../lib/verify-demo'

const flows = [
  { title: 'Risk score', detail: 'Order risk is evaluated by Redo Verify rules.' },
  { title: 'Partner action', detail: 'The selected partner performs the required action.' },
  { title: 'Verification result', detail: 'The partner returns the outcome and proof.' },
  { title: 'Redo decision', detail: 'Redo Verify completes the order or holds it for review.' },
] as const

export function VerifyIntegrationsPage() {
  const [filter, setFilter] = useState<(typeof verifyIntegrationCategories)[number]>('All')
  const [connected, setConnected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(verifyIntegrations.map((item) => [item.id, item.status === 'connected'])),
  )

  useEffect(() => {
    document.title = 'Integrations · Redo Verify'
  }, [])

  const rows = useMemo(
    () => verifyIntegrations.filter((item) => filter === 'All' || item.category === filter),
    [filter],
  )

  return (
    <div className="vc-workspace">
      <div className="vc-main">
        <header className="vc-top">
          <div>
            <h1 className="vc-title">Integrations</h1>
            <p className="vc-lead">Connect verification, carrier, return and warehouse partners.</p>
          </div>
          <div className="vc-actions">
            <span className="vc-chip">View API keys</span>
            <span className="vc-chip vc-chip--primary">Add integration</span>
          </div>
        </header>

        <div className="vc-tabs" role="tablist" aria-label="Integration category">
          {verifyIntegrationCategories.map((item) => (
            <button key={item} type="button" role="tab" aria-selected={item === filter} onClick={() => setFilter(item)}>
              {item}
            </button>
          ))}
        </div>

        <div className="vc-int-grid">
          {rows.map((item) => (
            <article key={item.id} className="vc-card">
              <p className="vc-kicker">{item.category}</p>
              <h2>{item.name}</h2>
              <p>{item.purpose}</p>
              <p className={connected[item.id] ? 'vc-pill vc-pill--good' : 'vc-pill'}>
                {connected[item.id] ? 'Connected' : 'Available'}
              </p>
              <button
                type="button"
                className="vc-btn vc-btn--ghost"
                onClick={() => setConnected((current) => ({ ...current, [item.id]: true }))}
              >
                {connected[item.id] ? 'Configure' : 'Connect'}
              </button>
            </article>
          ))}
        </div>

        <aside className="vc-banner">
          <div>
            <strong>More integrations. More trust.</strong>
            <p>Request a partner that is not in this SKIMS demo catalog.</p>
          </div>
          <span className="vc-chip">Request an integration</span>
        </aside>
      </div>

      <aside className="vc-phone-col">
        <p className="vc-phone-kicker">Active data flows</p>
        <ol className="vc-process vc-process--stack">
          {flows.map((step) => (
            <li key={step.title}>
              <strong>{step.title}</strong>
              <span>{step.detail}</span>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  )
}
