import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative flex w-full items-start gap-2 rounded-md border px-3 py-2.5 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-border bg-muted text-foreground',
        destructive: 'border-[#ffcbb7] bg-[#fff0ee] text-[#c13232]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Alert({ className, variant, ...props }: HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
}

function AlertDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('min-w-0 flex-1 font-medium leading-5', className)} {...props} />
}

export { Alert, AlertDescription, alertVariants }
