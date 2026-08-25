import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Shell } from './components/Shell'
import { DashboardPage } from './pages/DashboardPage'
import { IntakePage } from './pages/IntakePage'
import { LabPage } from './pages/LabPage'
import { LandingPage } from './pages/LandingPage'
import { LifecyclePage } from './pages/LifecyclePage'
import { MerchantPage } from './pages/MerchantPage'
import { OperatorPage } from './pages/OperatorPage'
import { ResetPage } from './pages/ResetPage'
import { ShopperPage } from './pages/ShopperPage'

const ToolsPage = lazy(() => import('./pages/ToolsPage').then((module) => ({ default: module.ToolsPage })))

function ToolsRoute() {
  return <Suspense fallback={<div className="page" role="status">Loading interactive demos…</div>}><ToolsPage /></Suspense>
}

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
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
        <Route path="session" element={<Navigate to="/reset" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
