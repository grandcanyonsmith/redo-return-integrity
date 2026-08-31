import * as LabelPrimitive from '@radix-ui/react-label'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn('text-[12.5px] font-semibold text-muted-foreground', className)}
      {...props}
    />
  )
}

export { Label }
