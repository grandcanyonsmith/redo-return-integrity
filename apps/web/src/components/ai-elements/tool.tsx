import { CheckCircle2, ChevronDown, Circle, Clock, Wrench, XCircle } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible'
import { cn } from '../../lib/utils'

export type ToolState = 'output-available' | 'input-available' | 'input-streaming' | 'output-error'

const statusCopy: Record<ToolState, { label: string; icon: typeof CheckCircle2 }> = {
  'output-available': { label: 'Completed', icon: CheckCircle2 },
  'input-available': { label: 'Running', icon: Circle },
  'input-streaming': { label: 'Pending', icon: Clock },
  'output-error': { label: 'Error', icon: XCircle },
}

export const Tool = ({ className, ...props }: ComponentProps<typeof Collapsible>) => (
  <Collapsible className={cn('ai-tool', className)} {...props} />
)

export const ToolHeader = ({
  title,
  state: toolState = 'output-available',
  className,
  ...props
}: Omit<ComponentProps<typeof CollapsibleTrigger>, 'title'> & { title: string; state?: ToolState }) => {
  const status = statusCopy[toolState]
  const Icon = status.icon
  return (
    <CollapsibleTrigger className={cn('ai-tool__header', className)} {...props}>
      <span className="ai-tool__title"><Wrench aria-hidden="true" />{title}</span>
      <span className={`ai-tool__status ai-tool__status--${toolState}`}><Icon aria-hidden="true" />{status.label}</span>
      <ChevronDown aria-hidden="true" className="ai-cot__chevron" />
    </CollapsibleTrigger>
  )
}

export const ToolContent = ({ className, ...props }: ComponentProps<typeof CollapsibleContent>) => (
  <CollapsibleContent className={cn('ai-tool__content', className)} {...props} />
)

export const ToolOutput = ({
  output,
  errorText,
  className,
}: {
  output?: ReactNode
  errorText?: string
  className?: string
}) => {
  if (!output && !errorText) return null
  return (
    <div className={cn('ai-tool__output', errorText && 'ai-tool__output--error', className)}>
      <small>{errorText ? 'Error' : 'Result'}</small>
      {errorText ? <pre>{errorText}</pre> : output}
    </div>
  )
}
