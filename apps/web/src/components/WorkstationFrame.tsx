import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { PortfolioFilterProvider } from '../lib/portfolio-filter'
import { ScanStartProvider, useScanStart } from '../lib/scan-start'
import { BoardPage } from '../pages/BoardPage'
import { FraudSchemesPage } from '../pages/FraudSchemesPage'
import { HomeDashboardPage } from '../pages/HomeDashboardPage'
import { IntakeAppPage } from '../pages/IntakeAppPage'
import { WorkstationTabBar } from './WorkstationTabBar'

type WorkstationTab = 'home' | 'scan' | 'board' | 'fraud'

const tabFromPath = (pathname: string): WorkstationTab => {
  if (pathname === '/board') return 'board'
  if (pathname === '/scan') return 'scan'
  if (pathname === '/fraud') return 'fraud'
  return 'home'
}

const titleFor = (tab: WorkstationTab): string => {
  switch (tab) {
    case 'home':
      return 'Refund dashboard · Redo'
    case 'scan':
      return 'Redo · Return Workstation'
    case 'board':
      return 'Return board · Redo'
    case 'fraud':
      return 'Fraudulent attempts · Redo'
    default: {
      const exhausted: never = tab
      return exhausted
    }
  }
}

/** Keeps Home, Scan, and Board mounted so a mid-scan box is not lost when
 * the operator checks the dashboard or board. */
function WorkstationChrome() {
  const location = useLocation()
  const { immersive } = useScanStart()
  const tab = tabFromPath(location.pathname)

  useEffect(() => {
    document.title = titleFor(tab)
  }, [tab])

  const hideTabs = immersive && tab === 'scan'
  return (
    <div className={`ws-frame${hideTabs ? ' ws-frame--scan' : ''}`}>
      <div hidden={tab !== 'home'}><HomeDashboardPage /></div>
      <div hidden={tab !== 'scan'}><IntakeAppPage /></div>
      <div hidden={tab !== 'board'}><BoardPage /></div>
      <div hidden={tab !== 'fraud'}><FraudSchemesPage /></div>
      {hideTabs ? null : <WorkstationTabBar />}
    </div>
  )
}

export function WorkstationFrame() {
  return (
    <PortfolioFilterProvider>
      <ScanStartProvider>
        <WorkstationChrome />
      </ScanStartProvider>
    </PortfolioFilterProvider>
  )
}
