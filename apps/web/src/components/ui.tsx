import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './ui/empty'

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
  compact = false,
}: {
  eyebrow: string
  title: React.ReactNode
  description: string
  actions?: React.ReactNode
  compact?: boolean
}) {
  return (
    <header className={`page-intro${compact ? ' page-intro--compact' : ''}`}>
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

export function EmptyNotice({
  icon: Icon,
  title,
  children,
  actions,
}: {
  icon: LucideIcon
  title: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon"><Icon aria-hidden="true" /></EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
      {actions ? <EmptyContent>{actions}</EmptyContent> : null}
    </Empty>
  )
}
