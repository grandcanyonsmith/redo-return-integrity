import { useControllableState } from '@radix-ui/react-use-controllable-state'
import type { LucideIcon } from 'lucide-react'
import { Brain, ChevronDown, Dot } from 'lucide-react'
import { createContext, memo, useContext, useMemo, type ComponentProps, type ReactNode } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible'
import { cn } from '../../lib/utils'

interface ChainOfThoughtContextValue {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

const ChainOfThoughtContext = createContext<ChainOfThoughtContextValue | null>(null)

const useChainOfThought = () => {
  const context = useContext(ChainOfThoughtContext)
  if (!context) throw new Error('ChainOfThought components must be used within ChainOfThought')
  return context
}

export type ChainOfThoughtProps = ComponentProps<'div'> & {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export const ChainOfThought = memo(({
  className,
  open,
  defaultOpen = true,
  onOpenChange,
  children,
  ...props
}: ChainOfThoughtProps) => {
  const [isOpen, setIsOpen] = useControllableState({
    defaultProp: defaultOpen,
    onChange: onOpenChange,
    prop: open,
  })
  const value = useMemo(() => ({ isOpen: Boolean(isOpen), setIsOpen }), [isOpen, setIsOpen])
  return (
    <ChainOfThoughtContext.Provider value={value}>
      <Collapsible className={cn('ai-cot', className)} open={isOpen} onOpenChange={setIsOpen}>
        <div {...props}>{children}</div>
      </Collapsible>
    </ChainOfThoughtContext.Provider>
  )
})

export const ChainOfThoughtHeader = memo(({ className, children, ...props }: ComponentProps<typeof CollapsibleTrigger>) => {
  const { isOpen } = useChainOfThought()
  return (
    <CollapsibleTrigger className={cn('ai-cot__header', className)} {...props}>
      <Brain aria-hidden="true" />
      <span>{children ?? 'Decision chain'}</span>
      <ChevronDown aria-hidden="true" className={cn('ai-cot__chevron', isOpen && 'ai-cot__chevron--open')} />
    </CollapsibleTrigger>
  )
})

export type ChainOfThoughtStepProps = ComponentProps<'div'> & {
  icon?: LucideIcon
  label: ReactNode
  description?: ReactNode
  status?: 'complete' | 'active' | 'pending'
}

export const ChainOfThoughtStep = memo(({
  className,
  icon: Icon = Dot,
  label,
  description,
  status = 'complete',
  children,
  ...props
}: ChainOfThoughtStepProps) => (
  <div className={cn('ai-cot__step', `ai-cot__step--${status}`, className)} {...props}>
    <span className="ai-cot__rail" aria-hidden="true"><Icon /></span>
    <div className="ai-cot__step-body">
      <strong>{label}</strong>
      {description ? <p>{description}</p> : null}
      {children}
    </div>
  </div>
))

export const ChainOfThoughtSearchResults = memo(({ className, ...props }: ComponentProps<'div'>) => (
  <div className={cn('ai-cot__chips', className)} {...props} />
))

export const ChainOfThoughtSearchResult = memo(({ className, children, ...props }: ComponentProps<'span'>) => (
  <span className={cn('ai-chip', className)} {...props}>{children}</span>
))

export const ChainOfThoughtContent = memo(({ className, children, ...props }: ComponentProps<typeof CollapsibleContent>) => (
  <CollapsibleContent className={cn('ai-cot__content', className)} {...props}>
    {children}
  </CollapsibleContent>
))

export const ChainOfThoughtImage = memo(({ className, children, caption, ...props }: ComponentProps<'div'> & { caption?: string }) => (
  <figure className={cn('ai-cot__image', className)} {...props}>
    {children}
    {caption ? <figcaption>{caption}</figcaption> : null}
  </figure>
))

ChainOfThought.displayName = 'ChainOfThought'
ChainOfThoughtHeader.displayName = 'ChainOfThoughtHeader'
ChainOfThoughtStep.displayName = 'ChainOfThoughtStep'
ChainOfThoughtSearchResults.displayName = 'ChainOfThoughtSearchResults'
ChainOfThoughtSearchResult.displayName = 'ChainOfThoughtSearchResult'
ChainOfThoughtContent.displayName = 'ChainOfThoughtContent'
ChainOfThoughtImage.displayName = 'ChainOfThoughtImage'
