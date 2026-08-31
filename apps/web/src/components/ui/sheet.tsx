import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ComponentProps } from 'react'
import { X } from '@/lib/ws-icons'
import { cn } from '@/lib/utils'
import { Button } from './button'

function Sheet({ ...props }: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />
}

function SheetTrigger({ ...props }: ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger {...props} />
}

function SheetClose({ ...props }: ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close {...props} />
}

function SheetPortal({ ...props }: ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal {...props} />
}

function SheetOverlay({ className, ...props }: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn('fixed inset-0 z-[60] bg-ink/40', className)}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = 'bottom',
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { side?: 'bottom' | 'right' }) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-[60] flex flex-col bg-paper shadow-lg outline-none',
          side === 'bottom' && 'inset-x-0 bottom-0 mx-auto max-h-[min(92dvh,860px)] w-full max-w-none rounded-t-xl border border-border sm:max-w-[560px]',
          side === 'right' && 'inset-y-0 right-0 h-full w-full max-w-md border-l border-border',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close asChild>
          <Button variant="ghost" size="icon" className="absolute top-3 right-3" aria-label="Close">
            <X size={16} />
          </Button>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 p-4 pr-12', className)} {...props} />
}

function SheetTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('text-[15px] font-bold tracking-tight', className)} {...props} />
}

function SheetDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('text-[12.5px] text-muted-foreground', className)} {...props} />
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
}
