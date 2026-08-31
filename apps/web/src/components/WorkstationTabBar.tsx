import { NavLink, useLocation } from 'react-router-dom'
import { House, ScanBarcode, ViewColumns } from '@/lib/ws-icons'
import { useScanStart } from '../lib/scan-start'

const tabs = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/scan', label: 'Scan', icon: ScanBarcode, end: true, scan: true },
  { to: '/board', label: 'Board', icon: ViewColumns, end: true },
] as const

export function WorkstationTabBar() {
  const location = useLocation()
  const { startScan } = useScanStart()
  return (
    <nav className="ws-tabbar" aria-label="Workstation">
      <div className="ws-tabbar__inner">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => {
              const onHome = tab.to === '/' && (location.pathname === '/' || location.pathname === '/fraud')
              return `ws-tab${'scan' in tab ? ' ws-tab--scan' : ''}${isActive || onHome ? ' ws-tab--current' : ''}`
            }}
            aria-label={tab.label}
            onClick={(event) => {
              if ('scan' in tab && location.pathname === '/scan' && startScan) {
                event.preventDefault()
                startScan()
              }
            }}
          >
            <span className="ws-tab__icon" aria-hidden="true">
              <tab.icon size={'scan' in tab ? 20 : 18} />
            </span>
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
