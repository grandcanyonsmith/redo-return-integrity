import { formatMinutesSaved, refundBoardColumnLabel, summarizeRefundIntegrity, type RefundPortfolioCase } from '@return-integrity/domain/refund-portfolio'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CaseJourneySheet } from '../components/CaseJourneySheet'
import { WorkstationBrand, WorkstationShell } from '../components/WorkstationShell'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { currentOperator, logoutOperator } from '../lib/api'
import { formatCents, formatDay, formatDayRange } from '../lib/ops-format'
import { monthGrid } from '../lib/portfolio-filter'
import { useRefundPortfolio } from '../lib/use-refund-portfolio'
import { CalendarDays, LogOut, Settings } from '@/lib/ws-icons'

const weekdayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const

const monthTitle = (yearMonth: string) => new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
}).format(new Date(`${yearMonth}-01T00:00:00.000Z`))

const dayTitle = (day: string) => new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
}).format(new Date(`${day}T00:00:00.000Z`))

const yearOptions = (viewMonth: string) => {
  const current = Number(viewMonth.slice(0, 4))
  return Array.from({ length: 5 }, (_, index) => String(current - 2 + index))
}

export function HomeDashboardPage() {
  const navigate = useNavigate()
  const operator = currentOperator()
  const { filter, portfolio, isPending } = useRefundPortfolio()
  const [openId, setOpenId] = useState<string | null>(null)
  const selected = useMemo(
    () => portfolio?.cases.find((item) => item.caseId === openId) ?? null,
    [openId, portfolio],
  )

  const cells = monthGrid(filter.viewMonth)
  const stats = portfolio?.stats
  const impact = useMemo(() => summarizeRefundIntegrity(portfolio?.cases ?? []), [portfolio])
  const [viewYear, viewMonthNumber] = filter.viewMonth.split('-')

  const onPresetChange = (value: string) => {
    if (value === 'week') filter.setWeek()
    if (value === 'month') filter.setMonth()
  }

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
        <h1 className="ws-h">Refund dashboard</h1>
        <p className="ws-sub">
          {filter.selectedDay ? formatDay(filter.selectedDay) : formatDayRange(filter.from, filter.to)}
          {filter.selectedDay ? ' · one day' : ' · range'}
        </p>
      </div>

      <div className="ws-dash-kpis" aria-label="Refund statistics">
        <Card className="ws-kpi shadow-none"><b>{stats?.totalRefunds ?? '—'}</b><span>total refunds</span></Card>
        <Card className="ws-kpi shadow-none"><b>{stats ? formatCents(stats.totalAmountCents) : '—'}</b><span>amount processed</span></Card>
        <Card className="ws-kpi shadow-none"><b>{formatMinutesSaved(impact.timeSavedMinutes)}</b><span>time saved with AI</span></Card>
        <Card className="ws-kpi shadow-none"><b>{impact.wrongfulRefundsSaved}</b><span>wrongful refunds saved</span></Card>
        <Card className="ws-kpi shadow-none"><b>{formatCents(impact.wrongfulProductCents)}</b><span>product held back</span></Card>
        <Link to="/fraud" className="ws-kpi ws-kpi--link">
          <b>{impact.fraudulentAttempts}</b>
          <span>fraudulent attempts</span>
        </Link>
      </div>
      <p className="ws-dash-note">
        About {Math.round(impact.industryRate * 100)}% of refunds are fraudulent.
        This range stopped {impact.wrongfulRefundsSaved} wrongful {impact.wrongfulRefundsSaved === 1 ? 'payout' : 'payouts'}
        {' '}worth {formatCents(impact.wrongfulProductCents)} in product.
      </p>

      <Card aria-label="Calendar">
        <CardHeader className="gap-5 pb-4">
          <div className="ws-cal__toolbar">
            <CardTitle className="ws-cal__label flex items-center gap-1.5 font-bold uppercase tracking-[0.06em] text-[11px] text-muted-foreground">
              <CalendarDays size={14} /> Calendar
            </CardTitle>
            <Select value={filter.preset === 'day' ? 'day' : filter.preset} onValueChange={onPresetChange}>
              <SelectTrigger className="h-8 w-full min-w-0 text-sm sm:w-[168px]" aria-label="Date range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="week">This week</SelectItem>
                {filter.preset === 'day' && filter.selectedDay ? (
                  <SelectItem value="day">{dayTitle(filter.selectedDay)}</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>
          <div className="ws-cal__caption">
            <Select
              value={viewMonthNumber}
              onValueChange={(month) => filter.setViewMonth(`${viewYear}-${month}`)}
            >
              <SelectTrigger className="h-8 min-w-0 flex-1 text-sm font-medium" aria-label="Calendar month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthNames.map((name, index) => (
                  <SelectItem key={name} value={String(index + 1).padStart(2, '0')}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={viewYear}
              onValueChange={(year) => filter.setViewMonth(`${year}-${viewMonthNumber}`)}
            >
              <SelectTrigger className="h-8 w-[108px] text-sm font-medium" aria-label="Calendar year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions(filter.viewMonth).map((year) => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <h2 className="sr-only">{monthTitle(filter.viewMonth)}</h2>
          <div className="ws-cal" role="grid" aria-label={monthTitle(filter.viewMonth)}>
            {weekdayLabels.map((label) => <span key={label} className="ws-cal__dow">{label}</span>)}
            {cells.map((cell) => {
              const selectedDay = filter.selectedDay === cell.day
              const isToday = cell.day === filter.today
              const inRange = !selectedDay && cell.day >= filter.from && cell.day <= filter.to
              const rangeStart = filter.preset !== 'month' && inRange && cell.day === filter.from
              const rangeEnd = filter.preset !== 'month' && inRange && cell.day === filter.to
              return (
                <button
                  key={cell.day}
                  type="button"
                  role="gridcell"
                  aria-selected={selectedDay}
                  className={`ws-cal__day${cell.inMonth ? '' : ' ws-cal__day--muted'}${selectedDay ? ' ws-cal__day--selected' : ''}${isToday ? ' ws-cal__day--today' : ''}${inRange ? ' ws-cal__day--range' : ''}${rangeStart ? ' ws-cal__day--range-start' : ''}${rangeEnd ? ' ws-cal__day--range-end' : ''}`}
                  onClick={() => filter.selectDay(cell.day)}
                >
                  {Number(cell.day.slice(8))}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <section aria-label="Refunds processed" className="ws-section">
        <p className="ws-divider">Refunds processed</p>
        {isPending ? <p className="ws-activity__empty">Loading the book…</p> : null}
        {portfolio && portfolio.cases.length === 0 ? <p className="ws-activity__empty">No returns in this date range</p> : null}
        <div className="ws-activity">
          {(portfolio?.cases ?? []).map((item) => (
            <RefundRow key={item.caseId} item={item} onOpen={() => setOpenId(item.caseId)} />
          ))}
        </div>
      </section>
      <CaseJourneySheet item={selected} onClose={() => setOpenId(null)} />
    </WorkstationShell>
  )
}

function RefundRow({ item, onOpen }: { item: RefundPortfolioCase; onOpen: () => void }) {
  const record = item.returnRecord
  return (
    <button type="button" className="ws-activity__item ws-activity__item--btn" aria-label={`${record.customer.name} ${record.rmaId}`} onClick={onOpen}>
      <Avatar className="ws-avatar size-9" aria-hidden="true">
        <AvatarFallback>{record.customer.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)}</AvatarFallback>
      </Avatar>
      <span className="ws-activity__who">{record.customer.name} · <span className="ws-mono">{record.rmaId}</span></span>
      <span className="ws-activity__meta">{record.product.title} · {refundBoardColumnLabel(item.boardColumn)}</span>
      <time className="ws-activity__time">{formatCents(item.processedAmountCents)}</time>
      <span className="ws-activity__status">
        <Badge>{refundBoardColumnLabel(item.boardColumn)}</Badge>
        {item.liveSession ? <Badge variant="success">This session</Badge> : null}
      </span>
    </button>
  )
}
