import { BookOpen, ChevronDown } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible'
import { cn } from '../../lib/utils'

export const Sources = ({ className, defaultOpen = true, children, ...props }: ComponentProps<typeof Collapsible>) => (
  <Collapsible className={cn('ai-sources', className)} defaultOpen={defaultOpen} {...props}>
    {children}
  </Collapsible>
)

export const SourcesTrigger = ({ count, children, className, ...props }: ComponentProps<typeof CollapsibleTrigger> & { count: number }) => (
  <CollapsibleTrigger className={cn('ai-sources__header', className)} {...props}>
    <BookOpen aria-hidden="true" />
    <span>{children ?? `Used ${count} source${count === 1 ? '' : 's'}`}</span>
    <ChevronDown aria-hidden="true" className="ai-cot__chevron" />
  </CollapsibleTrigger>
)

export const SourcesContent = ({ className, children, ...props }: ComponentProps<typeof CollapsibleContent>) => (
  <CollapsibleContent className={cn('ai-sources__content', className)} {...props}>
    {children}
  </CollapsibleContent>
)

export const Source = ({ title, href, className }: { title: ReactNode; href?: string; className?: string }) => (
  href
    ? <a className={cn('ai-source', className)} href={href}>{title}</a>
    : <span className={cn('ai-source', className)}>{title}</span>
)
