import {
  ArrowRight,
  ChevronDown,
  FlaskConical,
  GitBranch,
  Github,
  LayoutDashboard,
  Menu,
  MousePointerClick,
  RotateCcw,
  ScanBarcode,
  ShieldCheck,
  Sparkles,
  Store,
  UserRound,
  Warehouse,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useDemo } from '../lib/demo-context'
import { workQueue } from '../lib/work-queue'

const primaryNavigation = [
  { to: '/legacy', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/legacy/intake', label: 'Scan return', icon: ScanBarcode, end: false },
  { to: '/legacy/operator', label: 'Warehouse', icon: Warehouse, end: false },
  { to: '/legacy/merchant', label: 'Merchant', icon: Store, end: false },
] as const

const exploreNavigation = [
  { to: '/legacy/tools', label: 'Live demos', icon: MousePointerClick, end: false },
  { to: '/legacy/shopper?journey=checkout', activePath: '/legacy/shopper', label: 'Shopper journey', icon: UserRound, end: false },
  { to: '/legacy/lifecycle', label: 'Decision map', icon: GitBranch, end: false },
  { to: '/legacy/lab', label: 'Evaluation lab', icon: FlaskConical, end: false },
  { to: '/legacy/product', label: 'Product overview', icon: Sparkles, end: false },
] as const

const routeTitles: Record<string, string> = {
  '/legacy': 'Operations dashboard',
  '/legacy/product': 'Product overview',
  '/legacy/lifecycle': 'Decision lifecycle',
  '/legacy/shopper': 'Shopper journeys',
  '/legacy/tools': 'Interactive demos',
  '/legacy/merchant': 'Merchant review',
  '/legacy/operator': 'Warehouse review',
  '/legacy/intake': 'Scan return',
  '/legacy/lab': 'Evaluation lab',
  '/legacy/reset': 'Reset demo',
}

export function Shell() {
  const [open, setOpen] = useState(false)
  const { state } = useDemo()
  const location = useLocation()
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const exploreRef = useRef<HTMLDetailsElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const previousPath = useRef(location.pathname)
  const nextItem = workQueue(state)[0]
  const compactNextTitle = nextItem?.title.split(' · ')[0] ?? 'Continue'
  const currentHref = `${location.pathname}${location.search}`
  const showNext = nextItem && nextItem.href !== currentHref
  const exploreIsActive = exploreNavigation.some((item) => {
    const activePath = 'activePath' in item ? item.activePath : item.to
    return location.pathname.startsWith(activePath.split('?')[0])
  })
  const closeNavigation = (targetHref: string) => {
    const drawerWasOpen = open
    const stayedOnCurrentRoute = targetHref === currentHref
    exploreRef.current?.removeAttribute('open')
    setOpen(false)
    if (drawerWasOpen) {
      window.requestAnimationFrame(() => {
        if (stayedOnCurrentRoute) menuButtonRef.current?.focus()
        else mainRef.current?.focus()
      })
    }
  }

  useEffect(() => {
    const title = routeTitles[location.pathname] ?? 'Return Integrity'
    document.title = `${title} · Redo Return Integrity`
    setOpen(false)
    exploreRef.current?.removeAttribute('open')
    if (previousPath.current !== location.pathname) {
      mainRef.current?.focus()
    }
    previousPath.current = location.pathname
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const desktopQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 981px)') : undefined
    if (desktopQuery?.matches) {
      setOpen(false)
      return
    }
    const previousOverflow = document.body.style.overflow
    const footer = document.querySelector<HTMLElement>('.footer')
    document.body.style.overflow = 'hidden'
    mainRef.current?.setAttribute('inert', '')
    footer?.setAttribute('inert', '')
    const focusFrame = window.requestAnimationFrame(() => navRef.current?.querySelector<HTMLElement>('a[href]')?.focus())
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false)
    }
    const handleMenuKeys = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        menuButtonRef.current?.focus()
        return
      }
      if (event.key !== 'Tab' || !navRef.current || !menuButtonRef.current) return
      const menuItems = Array.from(navRef.current.querySelectorAll<HTMLElement>('a[href], summary, button:not([disabled])')).filter((item) => {
        const closedDetails = item.closest('details:not([open])')
        return !closedDetails || (item.tagName === 'SUMMARY' && item.parentElement === closedDetails)
      })
      const first = menuItems[0]
      const last = menuItems.at(-1)
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        menuButtonRef.current.focus()
      } else if (event.shiftKey && document.activeElement === menuButtonRef.current) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        menuButtonRef.current.focus()
      } else if (!event.shiftKey && document.activeElement === menuButtonRef.current) {
        event.preventDefault()
        first.focus()
      }
    }
    desktopQuery?.addEventListener('change', closeAtDesktop)
    document.addEventListener('keydown', handleMenuKeys)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousOverflow
      mainRef.current?.removeAttribute('inert')
      footer?.removeAttribute('inert')
      desktopQuery?.removeEventListener('change', closeAtDesktop)
      document.removeEventListener('keydown', handleMenuKeys)
    }
  }, [open])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="topbar">
        <Link to="/legacy" className="brand" aria-label="Redo Return Integrity legacy home">
          <span className="brand__mark">redo</span>
          <span className="brand__product">Return Integrity</span>
        </Link>

        <nav ref={navRef} id="product-navigation" className={`topnav ${open ? 'topnav--open' : ''}`} aria-label="Product navigation">
          <div className="topnav__primary">
            {primaryNavigation.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => closeNavigation(to)}
                className={({ isActive }) => isActive ? 'topnav__link topnav__link--active' : 'topnav__link'}
              >
                <Icon aria-hidden="true" size={16} /> {label}
              </NavLink>
            ))}
          </div>
          <details ref={exploreRef} className={`topnav__explore ${exploreIsActive ? 'topnav__explore--active' : ''}`}>
            <summary>Explore <ChevronDown aria-hidden="true" size={15} /></summary>
            <div className="topnav__explore-menu">
              {exploreNavigation.map(({ to, label, icon: Icon, end, ...item }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => closeNavigation(to)}
                  className={() => {
                    const activePath = 'activePath' in item ? item.activePath : to
                    return location.pathname.startsWith(activePath.split('?')[0]) ? 'topnav__link topnav__link--active' : 'topnav__link'
                  }}
                >
                  <Icon aria-hidden="true" size={16} /> {label}
                </NavLink>
              ))}
            </div>
          </details>
        </nav>

        <div className="topbar__actions">
          {showNext ? (
            <Link className="topbar__continue" to={nextItem.href} aria-label="Continue next task" aria-describedby="next-task-context">
              <span className="topbar__continue-prefix">Continue</span>
              <span id="next-task-context" className="topbar__continue-label">{compactNextTitle}</span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          ) : !nextItem ? (
            <Link className="topbar__continue" to="/legacy/reset">
              <span className="topbar__continue-prefix">Complete</span>
              <span className="topbar__continue-label">Reset</span>
              <RotateCcw size={15} aria-hidden="true" />
            </Link>
          ) : null}
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
        </div>
      </header>
      {open ? <div className="nav-scrim" aria-hidden="true" onClick={() => { setOpen(false); menuButtonRef.current?.focus() }} /> : null}
      <div className="demo-disclosure" role="note">
        <ShieldCheck size={14} aria-hidden="true" />
        <span>Independent candidate prototype using fictional people, orders, and return evidence.</span>
      </div>
      <main ref={mainRef} className="main-content" id="main-content" tabIndex={-1}><Outlet /></main>
      <footer className="footer">
        <p><ShieldCheck size={15} aria-hidden="true" /> OpenAI recommends. Policy constrains. People own adverse decisions.</p>
        <div className="footer__links">
          <a href="https://github.com/grandcanyonsmith/redo-return-integrity" target="_blank" rel="noreferrer"><Github size={14} aria-hidden="true" /> Source</a>
          <Link to="/legacy/reset"><RotateCcw size={14} aria-hidden="true" /> Reset demo</Link>
        </div>
      </footer>
    </div>
  )
}
