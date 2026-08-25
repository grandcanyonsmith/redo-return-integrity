import {
  Activity,
  FlaskConical,
  GitBranch,
  Github,
  LayoutDashboard,
  Menu,
  PackageCheck,
  RotateCcw,
  ScanBarcode,
  ShieldCheck,
  Sparkles,
  Store,
  UserRound,
  Warehouse,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useDemo } from '../lib/demo-context'
import { Badge } from './ui'

const navigation = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/lifecycle', label: 'Lifecycle', icon: GitBranch, end: false },
  { to: '/shopper', label: 'Shopper', icon: UserRound, end: false },
  { to: '/merchant', label: 'Merchant', icon: Store, end: false },
  { to: '/operator', label: 'Operator', icon: Warehouse, end: false },
  { to: '/intake', label: 'Intake', icon: ScanBarcode, end: false },
  { to: '/lab', label: 'Lab', icon: FlaskConical, end: false },
]

export function Shell() {
  const [open, setOpen] = useState(false)
  const { state } = useDemo()
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Redo Return Integrity home">
          <span className="brand__mark">redo</span>
          <span className="brand__product">Return Integrity</span>
        </Link>
        <button className="nav-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Toggle navigation">
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <nav className={`topnav ${open ? 'topnav--open' : ''}`} aria-label="Product navigation">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'topnav__link topnav__link--active' : 'topnav__link'}>
              <Icon aria-hidden="true" size={16} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar__meta">
          <Badge tone="green" icon={Activity}>Demo active</Badge>
          <span className="session-id">{state.sessionId}</span>
        </div>
      </header>
      <main className="main-content" id="main-content"><Outlet /></main>
      <footer className="footer">
        <div className="brand brand--footer"><span className="brand__mark">redo</span><span className="brand__product">Return Integrity</span></div>
        <p><ShieldCheck size={15} aria-hidden="true" /> Models recommend. Policy constrains. People decide adverse outcomes.</p>
        <div className="footer__links">
          <a href="https://github.com/grandcanyonsmith/redo-return-integrity" target="_blank" rel="noreferrer"><Github size={14} aria-hidden="true" /> Source</a>
          <Link to="/product"><Sparkles size={14} aria-hidden="true" /> Product</Link>
          <Link to="/lifecycle"><PackageCheck size={14} aria-hidden="true" /> 15 checkpoints</Link>
          <Link to="/reset"><RotateCcw size={14} aria-hidden="true" /> Reset demo</Link>
        </div>
      </footer>
    </div>
  )
}
