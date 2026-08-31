import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowUpRight, MoreHorizontal } from 'lucide-react'
import {
  carrierMarkLabel,
  defaultVerifyModuleId,
  defaultVerifyTab,
  isVerifyModuleId,
  isVerifyTab,
  modulesForTab,
  verifyModuleById,
  verifyModuleIds,
  verifyTabLabel,
  verifyTabs,
  type VerifyModuleId,
  type VerifyTab,
} from '@return-integrity/domain/verify-modules'
import { Button } from '@/components/ui/button'
import { VerifyCustomerPopup } from '../components/VerifyCustomerPopup'

const percent = (rate: number) => `${(rate * 100).toFixed(1)}%`

export function VerifyRulesPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const requestedTab = params.get('tab')
  const tab: VerifyTab = isVerifyTab(requestedTab) ? requestedTab : defaultVerifyTab
  const requestedRule = params.get('rule')
  const rows = modulesForTab(tab)
  const selectedId: VerifyModuleId = isVerifyModuleId(requestedRule) && rows.some((row) => row.id === requestedRule)
    ? requestedRule
    : (rows[0]?.id ?? defaultVerifyModuleId)
  const selected = verifyModuleById[selectedId]
  const [enabled, setEnabled] = useState<Record<VerifyModuleId, boolean>>(() =>
    Object.fromEntries(verifyModuleIds.map((id) => [id, true])) as Record<VerifyModuleId, boolean>,
  )
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    document.title = 'Redo Verify · SKIMS'
  }, [])

  const select = (nextTab: VerifyTab, ruleId?: VerifyModuleId) => {
    const nextRule = ruleId ?? modulesForTab(nextTab)[0]?.id ?? defaultVerifyModuleId
    setParams({ tab: nextTab, rule: nextRule }, { replace: true })
    setSaved(false)
    setTesting(false)
  }

  const process = useMemo(() => ([
    { title: 'Risk detected', detail: 'A configured trigger is identified.' },
    { title: 'Safe route offered', detail: 'The customer sees secure verification options.' },
    { title: 'Customer verifies', detail: 'They complete the chosen method.' },
    { title: 'Order continues', detail: 'Fulfillment proceeds with the least added friction.' },
  ]), [])

  return (
    <div className="vc-workspace">
      <div className="vc-main">
        <header className="vc-top">
          <div className="vc-title">
            <h1>Risk-to-Route Rules</h1>
            <span className="vc-live">LIVE</span>
          </div>
          <div className="vc-actions">
            <Button type="button" variant="outline" size="sm" onClick={() => { setTesting(true); navigate('/verify/experience') }}>
              Test rule
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label="More rule actions">
              <MoreHorizontal size={18} />
            </Button>
            <Button type="button" size="sm" onClick={() => setSaved(true)}>
              Save & activate
            </Button>
          </div>
        </header>
        {saved ? <p className="vc-toast" role="status">Rule saved for this demo session. Nothing was published remotely.</p> : null}

        <div className="vc-tabs" role="tablist" aria-label="Lifecycle">
          {verifyTabs.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={item === tab}
              onClick={() => select(item)}
            >
              {verifyTabLabel(item)}
            </button>
          ))}
        </div>

        <div className="vc-table-wrap">
          <table className="vc-table">
            <thead>
              <tr>
                <th>Trigger</th>
                <th>Risk</th>
                <th>Intervention</th>
                <th>Customer completion rate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  aria-selected={row.id === selectedId}
                  onClick={() => select(tab, row.id)}
                >
                  <td>{row.trigger}</td>
                  <td><span className={`vc-risk vc-risk--${row.risk}`}>{row.risk}</span></td>
                  <td>{row.intervention}</td>
                  <td>
                    <span className="vc-rate">
                      {percent(row.completionRate)}
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="vc-switch"
                      role="switch"
                      aria-checked={enabled[row.id] !== false}
                      aria-label={`${row.trigger} status`}
                      onClick={(event) => {
                        event.stopPropagation()
                        setEnabled((current) => ({ ...current, [row.id]: current[row.id] === false }))
                      }}
                    >
                      <i />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="vc-builder">
          <section className="vc-logic" aria-label="Rule logic">
            <p className="vc-kicker">If / then</p>
            <div className="vc-ifthen">
              <span className="vc-op">IF</span>
              <span className="vc-chip">{selected.ifConditions[0]}</span>
              <span className="vc-op">+</span>
              <span className="vc-chip">{selected.ifConditions[1]}</span>
            </div>
            <div className="vc-ifthen" style={{ marginTop: 12 }}>
              <span className="vc-op">THEN</span>
              <span className="vc-route">
                <b>{selected.thenRoutes[0].label}</b>
                {selected.thenRoutes[0].carrierMark
                  ? <small>{carrierMarkLabel(selected.thenRoutes[0].carrierMark)}</small>
                  : null}
              </span>
              <span className="vc-op">OR</span>
              <span className="vc-route">
                <b>{selected.thenRoutes[1].label}</b>
                {selected.thenRoutes[1].carrierMark
                  ? <small>{carrierMarkLabel(selected.thenRoutes[1].carrierMark)}</small>
                  : null}
              </span>
            </div>
          </section>
          <section className="vc-impact" aria-label="Estimated impact">
            <p className="vc-kicker">Estimated impact</p>
            <b>{selected.impact.completionLabel.split(' ')[0]}</b>
            <span>{selected.impact.completionLabel.replace(/^\S+\s/, '')}</span>
            <b>{selected.impact.protectedLabel.split(' ')[0]}</b>
            <span>{selected.impact.protectedLabel.replace(/^\S+\s/, '')}</span>
          </section>
        </div>

        <ol className="vc-process" aria-label="How a rule runs">
          {process.map((step) => (
            <li key={step.title}>
              <strong>{step.title}</strong>
              <span>{step.detail}</span>
            </li>
          ))}
        </ol>
      </div>

      <VerifyCustomerPopup
        module={selected}
        testing={testing}
        onNeedAnotherWay={() => select('refunds', 'resolve')}
        onChooseAnotherOption={() => select('delivery', 'delivery')}
      />
    </div>
  )
}
