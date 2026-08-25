import { useControllableState } from '@radix-ui/react-use-controllable-state'
import { Brain, ChevronDown } from 'lucide-react'
import { createContext, memo, useContext, useMemo, type ComponentProps, type ReactNode } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible'
import { cn } from '../../lib/utils'

interface ReasoningContextValue {
  isStreaming: boolean
  isOpen: boolean
  duration?: number
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null)

export const useReasoning = () => {
  const context = useContext(ReasoningContext)
  if (!context) throw new Error('Reasoning components must be used within Reasoning')
  return context
}

export type ReasoningProps = ComponentProps<'div'> & {
  isStreaming?: boolean
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  duration?: number
}

export const Reasoning = memo(({
  className,
  isStreaming = false,
  open,
  defaultOpen = true,
  onOpenChange,
  duration,
  children,
  ...props
}: ReasoningProps) => {
  const [isOpen, setIsOpen] = useControllableState({
    defaultProp: defaultOpen,
    onChange: onOpenChange,
    prop: open,
  })
  const value = useMemo(
    () => ({ duration, isOpen: Boolean(isOpen), isStreaming }),
    [duration, isOpen, isStreaming],
  )
  return (
    <ReasoningContext.Provider value={value}>
      <Collapsible className={cn('ai-reason', className)} open={isOpen} onOpenChange={setIsOpen} {...props}>
        {children}
      </Collapsible>
    </ReasoningContext.Provider>
  )
})

export const ReasoningTrigger = memo(({ className, children, ...props }: ComponentProps<typeof CollapsibleTrigger>) => {
  const { isStreaming, isOpen, duration } = useReasoning()
  const label = isStreaming
    ? 'Thinking…'
    : duration
      ? `Thought for ${(duration / 1000).toFixed(1)}s`
      : 'Model reasoning'
  return (
    <CollapsibleTrigger className={cn('ai-reason__header', className)} {...props}>
      {children ?? (
        <>
          <Brain aria-hidden="true" />
          <span>{label}</span>
          <ChevronDown aria-hidden="true" className={cn('ai-cot__chevron', isOpen && 'ai-cot__chevron--open')} />
        </>
      )}
    </CollapsibleTrigger>
  )
})

export const ReasoningContent = memo(({ className, children, ...props }: ComponentProps<typeof CollapsibleContent> & { children: ReactNode }) => (
  <CollapsibleContent className={cn('ai-reason__content', className)} {...props}>
    {children}
  </CollapsibleContent>
))

Reasoning.displayName = 'Reasoning'
ReasoningTrigger.displayName = 'ReasoningTrigger'
ReasoningContent.displayName = 'ReasoningContent'
