import {
  Activity,
  ArrowRight,
  FlaskConical,
  GitBranch,
  Github,
  LayoutDashboard,
  Menu,
  MousePointerClick,
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
import { Fragment, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useDemo } from '../lib/demo-context'
import { workQueue } from '../lib/work-queue'
import { Badge } from './ui'

const navigationGroups = [
  {
    label: 'Work',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/intake', label: 'Scan return', icon: ScanBarcode, end: false },
      { to: '/merchant', label: 'Merchant review', icon: Store, end: false },
    ],
  },
  {
    label: 'Journey views',
    items: [
      { to: '/shopper?journey=checkout', activePath: '/shopper', label: 'Shopper', icon: UserRound, end: false },
      { to: '/operator', label: 'Warehouse', icon: Warehouse, end: false },
    ],
  },
  {
    label: 'Explore',
    items: [
      { to: '/tools', label: 'Live demos', icon: MousePointerClick, end: false },
      { to: '/lifecycle', label: 'Decision map', icon: GitBranch, end: false },
      { to: '/lab', label: 'Evaluation lab', icon: FlaskConical, end: false },
    ],
  },
] as const

const routeTitles: Record<string, string> = {
  '/': 'Operations dashboard',
  '/product': 'Product overview',
  '/lifecycle': 'Decision lifecycle',
  '/shopper': 'Shopper journeys',
  '/tools': 'Interactive demos',
  '/merchant': 'Merchant review',
  '/operator': 'Warehouse review',
  '/intake': 'Scan return',
  '/lab': 'Evaluation lab',
  '/reset': 'Reset demo',
}

export function Shell() {
  const [open, setOpen] = useState(false)
  const { state } = useDemo()
  const location = useLocation()
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const previousPath = useRef(location.pathname)
  const nextItem = workQueue(state)[0]

  useEffect(() => {
    const title = routeTitles[location.pathname] ?? 'Return Integrity'
    document.title = `${title} · Redo Return Integrity`
    setOpen(false)
    if (previousPath.current !== location.pathname) {
      mainRef.current?.focus()
    }
    previousPath.current = location.pathname
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      menuButtonRef.current?.focus()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [open])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Redo Return Integrity home">
          <span className="brand__mark">redo</span>
          <span className="brand__product">Return Integrity</span>
        </Link>
        <button
          ref={menuButtonRef}
          className="nav-toggle"
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="product-navigation"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <nav id="product-navigation" className={`topnav ${open ? 'topnav--open' : ''}`} aria-label="Product navigation">
          {navigationGroups.map((group) => (
            <Fragment key={group.label}>
              <span className="topnav__group-label">{group.label}</span>
              <div className="topnav__group">
                {group.items.map(({ to, label, icon: Icon, end, ...item }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={() => setOpen(false)}
                    className={() => {
                      const activePath = 'activePath' in item ? item.activePath : to
                      const isActive = end ? location.pathname === activePath : location.pathname.startsWith(activePath)
                      return isActive ? 'topnav__link topnav__link--active' : 'topnav__link'
                    }}
                  >
                    <Icon aria-hidden="true" size={16} /> {label}
                  </NavLink>
                ))}
              </div>
            </Fragment>
          ))}
          <div className="topnav__mobile-context">
            <Badge tone="violet" icon={ShieldCheck}>Synthetic browser demo</Badge>
            {nextItem ? <Link to={nextItem.href} onClick={() => setOpen(false)}>Next: {nextItem.owner} task <ArrowRight size={15} aria-hidden="true" /></Link> : <Link to="/reset" onClick={() => setOpen(false)}>Reset walkthrough <RotateCcw size={15} aria-hidden="true" /></Link>}
          </div>
        </nav>
        <div className="topbar__meta">
          <Badge tone="violet" icon={Activity}>Synthetic demo</Badge>
          {nextItem ? <Link className="topbar__next" to={nextItem.href}><span>Next task</span>{nextItem.owner}<ArrowRight size={14} aria-hidden="true" /></Link> : <Link className="topbar__next" to="/reset"><span>Complete</span>Reset<RotateCcw size={14} aria-hidden="true" /></Link>}
          <span className="session-id" title="Browser-local scenario ID">{state.sessionId}</span>
        </div>
      </header>
      {open ? <div className="nav-scrim" aria-hidden="true" onClick={() => setOpen(false)} /> : null}
      <div className="demo-disclosure" role="note"><ShieldCheck size={14} aria-hidden="true" /><span>Independent candidate prototype · fictional merchant · synthetic shopper and return data</span></div>
      <main ref={mainRef} className="main-content" id="main-content" tabIndex={-1}><Outlet /></main>
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
