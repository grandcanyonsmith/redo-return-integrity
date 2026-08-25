import type { LucideIcon } from 'lucide-react'

export function Badge({
  children,
  tone = 'neutral',
  icon: Icon,
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'orange' | 'green' | 'blue' | 'violet' | 'red' | 'dark'
  icon?: LucideIcon
}) {
  return (
    <span className={`badge badge--${tone}`}>
      {Icon ? <Icon aria-hidden="true" size={13} /> : null}
      {children}
    </span>
  )
}

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string
  title: React.ReactNode
  description: string
  actions?: React.ReactNode
}) {
  return (
    <header className="page-intro">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-intro__description">{description}</p>
      </div>
      {actions ? <div className="page-intro__actions">{actions}</div> : null}
    </header>
  )
}

export function MetricCard({
  label,
  value,
  note,
  tone = 'orange',
}: {
  label: string
  value: string
  note: string
  tone?: 'orange' | 'green' | 'blue' | 'violet'
}) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  )
}

export function EmptyNotice({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div className="empty-notice">
      <span className="empty-notice__icon"><Icon aria-hidden="true" size={22} /></span>
      <div><strong>{title}</strong><p>{children}</p></div>
    </div>
  )
}
