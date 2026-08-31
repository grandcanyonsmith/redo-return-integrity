import { cn } from '@/lib/utils'

type RedoBrandProps = {
  product?: string
  inverted?: boolean
  className?: string
}

/** Text treatment of the public Redo wordmark: “redo” plus an orange period. */
export function RedoBrand({ product = 'Return Integrity', inverted = false, className }: RedoBrandProps) {
  return (
    <span className={cn('ws-brand', inverted && 'text-white', className)}>
      redo<span className="ws-brand__dot">.</span>
      {product ? <span className="ws-brand__product">{product}</span> : null}
    </span>
  )
}
