import { ArrowRight, CheckCircle2, Database, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, PageIntro } from '../components/ui'
import { useDemo } from '../lib/demo-context'

export function ResetPage() {
  const { state, reset } = useDemo()
  const [didReset, setDidReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const performReset = async () => {
    setResetting(true)
    await reset()
    setDidReset(true)
    setResetting(false)
  }
  return (
    <div className="page reset-page">
      <PageIntro eyebrow="DEMO SESSION" title={<>A clean room for <em>every reviewer.</em></>} description="This prototype isolates journey state in the current browser session. Reset restores the three scenarios without affecting waitlist records or any other visitor." actions={<Badge tone="green" icon={ShieldCheck}>Anonymous session</Badge>} />
      <section className="reset-card">
        <div className="reset-card__icon">{didReset ? <CheckCircle2 /> : <Database />}</div>
        <span className="eyebrow">CURRENT SESSION</span>
        <h2>{didReset ? 'Demo reset complete' : state.sessionId}</h2>
        <p>{didReset ? 'Checkout, logistics, inspection, review, and appeal states are back at their starting fixtures.' : 'Resetting deletes only this tab’s demo-state progression and creates a new anonymous session ID.'}</p>
        <dl><div><dt>Checkout</dt><dd>{state.checkout}</dd></div><div><dt>Reverse logistics</dt><dd>{state.reverseLogistics}</dd></div><div><dt>Physical return</dt><dd>{state.physical}</dd></div></dl>
        {!didReset ? <button className="button button--danger" disabled={resetting} onClick={performReset}><Trash2 size={16} /> {resetting ? 'Resetting local + server state…' : 'Reset this demo session'}</button> : <Link className="button button--primary" to="/legacy">Open operations dashboard <ArrowRight size={16} /></Link>}
        <small><RotateCcw size={14} /> Fixture state may also expire automatically after 24 hours when served by the live backend.</small>
      </section>
    </div>
  )
}
