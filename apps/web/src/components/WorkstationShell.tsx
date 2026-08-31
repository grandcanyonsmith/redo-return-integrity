import type { ReactNode } from 'react'
import { RedoBrand } from './RedoBrand'
import { currentOperator } from '../lib/api'
import '../intake-app.css'

export const workstationSteps = ['Scan', 'Match', 'Inspect', 'Act'] as const
export type WorkstationStep = (typeof workstationSteps)[number]

export function WorkstationBrand() {
  const station = currentOperator()?.stationId.replace('-', ' ') ?? 'STN 04'
  return (
    <span className="ws-topbar__side">
      <RedoBrand product="Intake" />
      <span className="ws-station">{station}</span>
    </span>
  )
}

/** Top-bar step indicator: `1 Scan · 2 Match · 3 Inspect · 4 Act`. Pass
 * `current="done"` once the intake is queued so every step reads complete. */
export function StepIndicator({ current }: { current: WorkstationStep | 'done' }) {
  const currentIndex = current === 'done' ? workstationSteps.length : workstationSteps.indexOf(current)
  return (
    <ol className="ws-stepper" aria-label="Intake progress">
      {workstationSteps.map((step, index) => (
        <li
          key={step}
          className={`ws-stepper__step${index < currentIndex ? ' ws-stepper__step--done' : ''}`}
          aria-current={index === currentIndex ? 'step' : undefined}
        >
          <span className="ws-stepper__num" aria-hidden="true">{index + 1}</span>
          <span className="ws-stepper__label">{step}</span>
        </li>
      ))}
    </ol>
  )
}

type WorkstationShellProps = {
  /** Left side of the thin top bar. Defaults to the station brand. */
  topLeft?: ReactNode
  /** Right side of the thin top bar, typically a StepIndicator. */
  topRight?: ReactNode
  /** Sticky bottom bar contents — the always-reachable primary action. */
  actionBar?: ReactNode
  /** Optional desktop side rail (≥1024px), e.g. the session activity log. */
  rail?: ReactNode
  /** Widen the main column for the dashboard and board. */
  wide?: boolean
  /** Lift the action dock above the Home / Scan / Board tab bar. */
  withTabs?: boolean
  /** Full-bleed camera chrome for label and contents capture. */
  scanMode?: boolean
  children: ReactNode
}

export function WorkstationShell({ topLeft, topRight, actionBar, rail, wide, withTabs, scanMode, children }: WorkstationShellProps) {
  const classes = [
    'ws-app',
    wide ? 'ws-app--wide' : '',
    withTabs ? 'ws-app--with-tabs' : '',
    actionBar ? 'ws-app--with-action' : '',
    scanMode ? 'ws-app--scan' : '',
  ].filter(Boolean).join(' ')
  return (
    <div className={classes}>
      <a className="skip-link" href="#ws-main">Skip to main content</a>
      {scanMode ? null : (
        <header className="ws-topbar">
          {topLeft ?? <WorkstationBrand />}
          {topRight ? <span className="ws-topbar__side">{topRight}</span> : null}
        </header>
      )}
      <div className="ws-body">
        <main id="ws-main" className={wide ? 'ws-main ws-main--wide' : 'ws-main'} tabIndex={-1}>{children}</main>
        {scanMode || !rail ? null : <aside className="ws-rail" aria-label="Session activity">{rail}</aside>}
      </div>
      {scanMode || !actionBar ? null : (
        <div className="ws-actionbar">
          <div className="ws-actionbar__inner">{actionBar}</div>
        </div>
      )}
    </div>
  )
}
