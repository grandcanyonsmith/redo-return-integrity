import { refundBoardColumns, refundBoardColumnLabel, type RefundBoardColumn, type RefundPortfolioCase } from '@return-integrity/domain/refund-portfolio'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CaseJourneySheet } from '../components/CaseJourneySheet'
import { WorkstationBrand, WorkstationShell } from '../components/WorkstationShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { currentOperator, logoutOperator } from '../lib/api'
import { formatCents, formatDayRange } from '../lib/ops-format'
import { useRefundPortfolio } from '../lib/use-refund-portfolio'
import { LogOut, Settings } from '@/lib/ws-icons'

export function BoardPage() {
  const navigate = useNavigate()
  const operator = currentOperator()
  const { filter, portfolio, isPending } = useRefundPortfolio()
  const [openId, setOpenId] = useState<string | null>(null)
  const cases = portfolio?.cases ?? []
  const selected = useMemo(() => cases.find((item) => item.caseId === openId) ?? null, [cases, openId])

  return (
    <WorkstationShell
      wide
      withTabs
      topLeft={<WorkstationBrand />}
      topRight={(
        <>
          <span className="ws-operator">{operator?.displayName ?? 'Operator'}</span>
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate('/settings')} aria-label="Station settings">
            <Settings size={16} />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => { void logoutOperator().finally(() => navigate('/login', { replace: true })) }} aria-label="Log out">
            <LogOut size={16} />
          </Button>
        </>
      )}
    >
      <div className="ws-pagehead">
        <h1 className="ws-h">Return board</h1>
        <p className="ws-sub">{formatDayRange(filter.from, filter.to)} · tap a card for the full journey</p>
      </div>
      {isPending ? <p className="ws-activity__empty">Loading columns…</p> : null}
      <div className="ws-board" role="list">
        {refundBoardColumns.map((column) => (
          <BoardColumn
            key={column}
            column={column}
            items={cases.filter((item) => item.boardColumn === column)}
            onOpen={setOpenId}
          />
        ))}
      </div>
      <CaseJourneySheet item={selected} onClose={() => setOpenId(null)} />
    </WorkstationShell>
  )
}

function BoardColumn({
  column,
  items,
  onOpen,
}: {
  column: RefundBoardColumn
  items: RefundPortfolioCase[]
  onOpen: (caseId: string) => void
}) {
  return (
    <Card className="ws-board__col shadow-none" role="listitem" aria-label={refundBoardColumnLabel(column)}>
      <CardHeader className="ws-board__head flex-row items-center justify-between space-y-0 p-0">
        <CardTitle className="text-[13px]">{refundBoardColumnLabel(column)}</CardTitle>
        <Badge>{items.length}</Badge>
      </CardHeader>
      <CardContent className="ws-board__cards p-0">
        {items.length === 0 ? <p className="ws-board__empty">None</p> : null}
        {items.map((item) => {
          const record = item.returnRecord
          return (
            <button
              key={item.caseId}
              type="button"
              className="ws-board__card"
              aria-label={`${record.customer.name} ${record.rmaId}`}
              onClick={() => onOpen(item.caseId)}
            >
              <img src={record.product.imageUrl} alt="" />
              <span className="ws-board__who">{record.customer.name}</span>
              <span className="ws-mono">{record.rmaId}</span>
              <span className="ws-board__amt">{formatCents(item.processedAmountCents ?? record.return.requestedRefundCents)}</span>
              {item.classification ? <Badge>{item.classification.replaceAll('_', ' ')}</Badge> : null}
            </button>
          )
        })}
      </CardContent>
    </Card>
  )
}
