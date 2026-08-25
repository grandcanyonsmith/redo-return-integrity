import { cn } from '../../lib/utils'
import type { ComponentProps, ReactNode } from 'react'

export function Empty({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('empty', className)} data-slot="empty" role="status" {...props} />
}

export function EmptyHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('empty__header', className)} data-slot="empty-header" {...props} />
}

export function EmptyMedia({
  className,
  variant = 'icon',
  ...props
}: ComponentProps<'div'> & { variant?: 'icon' | 'default' }) {
  return <div className={cn('empty__media', `empty__media--${variant}`, className)} data-slot="empty-media" {...props} />
}

export function EmptyTitle({ className, ...props }: ComponentProps<'h3'>) {
  return <h3 className={cn('empty__title', className)} data-slot="empty-title" {...props} />
}

export function EmptyDescription({ className, children, ...props }: ComponentProps<'p'> & { children: ReactNode }) {
  return <div className={cn('empty__description', className)} data-slot="empty-description" {...props}>{children}</div>
}

export function EmptyContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('empty__content', className)} data-slot="empty-content" {...props} />
}
