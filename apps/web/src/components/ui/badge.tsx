import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11.5px] font-semibold tracking-wide whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-border bg-muted text-muted-foreground',
        outline: 'border-border bg-card text-muted-foreground',
        success: 'border-[#c3e4d3] bg-[#eaf8f1] text-[#16855b]',
        warning: 'border-[#fde68a] bg-[#fffbeb] text-[#b45309]',
        destructive: 'border-[#ffcbb7] bg-[#fff0ee] text-[#c13232]',
      },
    },
    defaultVariants: {
      variant: 'outline',
    },
  },
)

function Badge({ className, variant, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
