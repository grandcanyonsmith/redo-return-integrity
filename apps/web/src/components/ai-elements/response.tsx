import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

export const Response = ({ className, children, ...props }: ComponentProps<'div'>) => (
  <div className={cn('ai-response', className)} {...props}>
    {children}
  </div>
)
