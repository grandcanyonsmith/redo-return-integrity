import {
  formatMinutesSaved,
  refundBoardColumnLabel,
  summarizeRefundIntegrity,
  type RefundPortfolioCase,
  type RefundSchemeSlice,
} from '@return-integrity/domain/refund-portfolio'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CaseJourneySheet } from '../components/CaseJourneySheet'
import { WorkstationBrand, WorkstationShell } from '../components/WorkstationShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { currentOperator, logoutOperator } from '../lib/api'
import { formatCents, formatDay, formatDayRange } from '../lib/ops-format'
import { useRefundPortfolio } from '../lib/use-refund-portfolio'
import { ArrowLeft, LogOut, Settings } from '@/lib/ws-icons'

const percent = (rate: number) => `${Math.round(rate * 100)}%`

export function FraudSchemesPage() {
  const navigate = useNavigate()
  const operator = currentOperator()
  const { filter, portfolio, isPending } = useRefundPortfolio()
  const [openId, setOpenId] = useState<string | null>(null)
  const impact = useMemo(() => summarizeRefundIntegrity(portfolio?.cases ?? []), [portfolio])
  const selected = useMemo(
    () => portfolio?.cases.find((item) => item.caseId === openId) ?? null,
    [openId, portfolio],
  )
  const casesById = useMemo(() => {
    const map = new Map<string, RefundPortfolioCase>()
    for (const item of portfolio?.cases ?? []) map.set(item.caseId, item)
    return map
  }, [portfolio])

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
        <Button type="button" variant="ghost" size="sm" className="w-fit px-0" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> Refund dashboard
        </Button>
        <h1 className="ws-h">Fraudulent attempts</h1>
        <p className="ws-sub">
          {filter.selectedDay ? formatDay(filter.selectedDay) : formatDayRange(filter.from, filter.to)}
          {' · '}
          About {percent(impact.industryRate)} of refunds are fraudulent
        </p>
      </div>

      <div className="ws-dash-kpis" aria-label="Fraudulent attempt totals">
        <Card className="ws-kpi shadow-none">
          <b>{impact.fraudulentAttempts}</b>
          <span>attempted schemes</span>
        </Card>
        <Card className="ws-kpi shadow-none">
          <b>{impact.wrongfulRefundsSaved}</b>
          <span>wrongful refunds saved</span>
        </Card>
        <Card className="ws-kpi shadow-none">
          <b>{formatCents(impact.wrongfulProductCents)}</b>
          <span>product held back</span>
        </Card>
        <Card className="ws-kpi shadow-none">
          <b>{formatMinutesSaved(impact.timeSavedMinutes)}</b>
          <span>time saved with AI</span>
        </Card>
      </div>

      {isPending ? <p className="ws-activity__empty">Loading the book…</p> : null}
      {!isPending && impact.fraudulentAttempts === 0 ? (
        <p className="ws-activity__empty">No fraudulent attempts in this date range</p>
      ) : null}

      <div className="ws-scheme-list">
        {impact.schemes.filter((slice) => slice.attemptCount > 0).map((slice) => (
          <SchemeCard
            key={slice.scheme}
            slice={slice}
            casesById={casesById}
            onOpen={setOpenId}
          />
        ))}
      </div>
      <CaseJourneySheet item={selected} onClose={() => setOpenId(null)} />
    </WorkstationShell>
  )
}

function SchemeCard({
  slice,
  casesById,
  onOpen,
}: {
  slice: RefundSchemeSlice
  casesById: Map<string, RefundPortfolioCase>
  onOpen: (caseId: string) => void
}) {
  return (
    <Card className="ws-scheme">
      <CardContent className="ws-scheme__head pt-4">
        <div>
          <h2 className="ws-scheme__title">{slice.label}</h2>
          <p className="ws-scheme__detail">{slice.detail}</p>
        </div>
        <div className="ws-scheme__money">
          <b>{formatCents(slice.productCents)}</b>
          <span>{slice.attemptCount} {slice.attemptCount === 1 ? 'attempt' : 'attempts'}</span>
        </div>
      </CardContent>
      <CardContent className="ws-scheme__cases">
        {slice.caseIds.map((caseId) => {
          const item = casesById.get(caseId)
          if (!item) return null
          const record = item.returnRecord
          return (
            <button
              key={caseId}
              type="button"
              className="ws-scheme__case"
              aria-label={`${record.customer.name} ${record.rmaId}`}
              onClick={() => onOpen(caseId)}
            >
              <span className="ws-scheme__who">{record.customer.name} · <span className="ws-mono">{record.rmaId}</span></span>
              <span className="ws-scheme__meta">{record.product.title}</span>
              <span className="ws-scheme__amt">{formatCents(record.product.totalEligibleRefundCents)}</span>
              <Badge className="ws-scheme__status">{refundBoardColumnLabel(item.boardColumn)}</Badge>
            </button>
          )
        })}
      </CardContent>
    </Card>
  )
}
