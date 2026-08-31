import { refundBoardColumnLabel, type RefundJourneyStage, type RefundPortfolioCase } from '@return-integrity/domain/refund-portfolio'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  Box,
  Camera,
  CreditCard,
  Mail,
  MousePointerClick,
  Package,
  Phone,
  Scale,
  ShoppingCart,
  Stamp,
  Truck,
  Warehouse,
} from '@/lib/ws-icons'
import { formatCents, formatWhen } from '../lib/ops-format'

const stageIcon = (stage: RefundJourneyStage) => {
  switch (stage) {
    case 'BROWSE':
      return MousePointerClick
    case 'CHECKOUT':
      return ShoppingCart
    case 'PAYMENT':
      return CreditCard
    case 'PICK_PACK_LABEL':
      return Stamp
    case 'OUTBOUND_SHIPPING':
    case 'INBOUND_SHIPPING':
      return Truck
    case 'RETURN_REQUEST':
      return Package
    case 'WAREHOUSE_WEIGHT':
      return Scale
    case 'PHOTOS':
      return Camera
    case 'AI_ASSESSMENT':
      return Box
    case 'EMAIL':
      return Mail
    case 'VOICE_CALL':
      return Phone
    case 'STATUS':
      return Warehouse
    default: {
      const exhausted: never = stage
      return exhausted
    }
  }
}

type CaseJourneySheetProps = {
  item: RefundPortfolioCase | null
  onClose: () => void
}

export function CaseJourneySheet({ item, onClose }: CaseJourneySheetProps) {
  if (!item) return null
  const record = item.returnRecord

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="bottom" aria-label={record.customer.name} aria-describedby="ws-case-desc">
        <SheetHeader>
          <SheetTitle>{record.customer.name}</SheetTitle>
          <SheetDescription id="ws-case-desc">
            <span className="ws-mono">{record.rmaId}</span> · {record.orderId}
          </SheetDescription>
          <p className="ws-sub">{record.product.title}</p>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 px-4 pb-[calc(20px+env(safe-area-inset-bottom,0px))]">
          <div className="ws-sheet__stats">
            <Badge>{refundBoardColumnLabel(item.boardColumn)}</Badge>
            {item.resolutionStatus ? <Badge variant="secondary">{item.resolutionStatus.replaceAll('_', ' ')}</Badge> : null}
            <span className="ws-sheet__amount">{formatCents(item.processedAmountCents ?? record.return.requestedRefundCents)}</span>
          </div>
          <dl className="ws-kv">
            <dt>Requested</dt>
            <dd>{formatCents(record.return.requestedRefundCents)}</dd>
          </dl>
          <dl className="ws-kv">
            <dt>Processed</dt>
            <dd>{formatCents(item.processedAmountCents)}</dd>
          </dl>
          <dl className="ws-kv">
            <dt>Status</dt>
            <dd>{item.resolutionStatus?.replaceAll('_', ' ') ?? refundBoardColumnLabel(item.boardColumn)}</dd>
          </dl>
          {item.handledBy ? (
            <dl className="ws-kv">
              <dt>Handled by</dt>
              <dd>{item.handledBy}</dd>
            </dl>
          ) : null}
          <p className="ws-divider">Journey</p>
          <ol className="ws-journey">
            {item.journey.map((entry) => {
              const Icon = stageIcon(entry.stage)
              return (
                <li key={entry.eventId}>
                  <span className="ws-journey__icon" aria-hidden="true"><Icon size={14} /></span>
                  <time dateTime={entry.at}>{formatWhen(entry.at)}</time>
                  {entry.imageUrl ? <img className="ws-timeline__thumb" src={entry.imageUrl} alt="" /> : null}
                  <span className="ws-timeline__text">
                    <strong>{entry.title}</strong>
                    {entry.detail}
                    {entry.metric ? <small className="ws-timeline__by">{entry.metric}</small> : null}
                  </span>
                </li>
              )
            })}
          </ol>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
