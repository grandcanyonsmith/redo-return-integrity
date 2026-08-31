import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Shell } from './components/Shell'
import { WorkstationFrame } from './components/WorkstationFrame'
import { currentOperator } from './lib/api'
import { DashboardPage } from './pages/DashboardPage'
import { IntakePage } from './pages/IntakePage'
import { LabPage } from './pages/LabPage'
import { LandingPage } from './pages/LandingPage'
import { LifecyclePage } from './pages/LifecyclePage'
import { LoginPage } from './pages/LoginPage'
import { MerchantPage } from './pages/MerchantPage'
import { OperatorPage } from './pages/OperatorPage'
import { ResetPage } from './pages/ResetPage'
import { SettingsPage } from './pages/SettingsPage'
import { ShopperPage } from './pages/ShopperPage'

const ToolsPage = lazy(() => import('./pages/ToolsPage').then((module) => ({ default: module.ToolsPage })))

function ToolsRoute() {
  return <Suspense fallback={<div className="page" role="status">Loading interactive demos…</div>}><ToolsPage /></Suspense>
}

/** Redirects a pre-redesign absolute path to its /legacy/* home, keeping the query string. */
function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation()
  return <Navigate to={{ pathname: to, search: location.search }} replace />
}

/** Workstation gate: without a logged-in demo operator, go to /login. */
function RequireOperator({ children }: { children: ReactNode }) {
  const location = useLocation()
  if (!currentOperator()) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}

const legacyPaths = ['product', 'lifecycle', 'shopper', 'tools', 'merchant', 'operator', 'intake', 'lab', 'reset'] as const

export default function App() {
  return (
    <Routes>
      <Route element={<RequireOperator><WorkstationFrame /></RequireOperator>}>
        <Route index element={<></>} />
        <Route path="scan" element={<></>} />
        <Route path="board" element={<></>} />
        <Route path="fraud" element={<></>} />
      </Route>
      <Route path="login" element={<LoginPage />} />
      <Route path="settings" element={<RequireOperator><SettingsPage /></RequireOperator>} />

      <Route path="legacy" element={<Shell />}>
        <Route index element={<DashboardPage />} />
        <Route path="product" element={<LandingPage />} />
        <Route path="lifecycle" element={<LifecyclePage />} />
        <Route path="shopper" element={<ShopperPage />} />
        <Route path="tools" element={<ToolsRoute />} />
        <Route path="merchant" element={<MerchantPage />} />
        <Route path="operator" element={<OperatorPage />} />
        <Route path="intake" element={<IntakePage />} />
        <Route path="lab" element={<LabPage />} />
        <Route path="reset" element={<ResetPage />} />
        <Route path="session" element={<Navigate to="/legacy/reset" replace />} />
        <Route path="*" element={<Navigate to="/legacy" replace />} />
      </Route>

      {legacyPaths.map((path) => (
        <Route key={path} path={path} element={<LegacyRedirect to={`/legacy/${path}`} />} />
      ))}
      <Route path="session" element={<Navigate to="/legacy/reset" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
