import { NavLink, Outlet } from 'react-router-dom'
import {
  BarChart3,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  Puzzle,
  Settings,
  Users,
} from 'lucide-react'
import '../verify-console.css'

const nav = [
  { to: '/verify/overview', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/verify', label: 'Rules', icon: GitBranch, end: true },
  { to: '/verify/cases', label: 'Cases', icon: FolderKanban, end: false },
  { to: '/verify/customers', label: 'Customers', icon: Users, end: false },
  { to: '/verify/integrations', label: 'Integrations', icon: Puzzle, end: true },
  { to: '/verify/analytics', label: 'Analytics', icon: BarChart3, end: true },
  { to: '/verify/settings', label: 'Settings', icon: Settings, end: true },
] as const

export function VerifyConsole() {
  return (
    <div className="vc">
      <aside className="vc-sidebar">
        <div className="vc-wordmark" aria-label="Redo Verify">
          redo<span className="vc-wordmark__verify">verify</span>
        </div>
        <nav className="vc-nav" aria-label="Redo Verify">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              <item.icon aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="vc-sidebar__foot">
          <a className="vc-help" href="/legacy/product">Need help? View docs</a>
          <small>Risk Team</small>
          <strong>SKIMS</strong>
        </div>
      </aside>
      <Outlet />
    </div>
  )
}
