import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

function MessageScroller({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="message-scroller"
      className={cn(
        'relative min-h-0 overflow-hidden rounded-xl border border-border bg-card',
        className,
      )}
      {...props}
    />
  )
}

function MessageScrollerViewport({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="message-scroller-viewport"
      className={cn(
        'h-full max-h-[min(46dvh,380px)] overflow-y-auto overscroll-contain px-3 py-3 [mask-image:linear-gradient(to_bottom,transparent,black_16px,black_calc(100%-16px),transparent)]',
        className,
      )}
      {...props}
    />
  )
}

function MessageScrollerContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="message-scroller-content"
      className={cn('flex flex-col gap-3', className)}
      {...props}
    />
  )
}

export { MessageScroller, MessageScrollerContent, MessageScrollerViewport }
