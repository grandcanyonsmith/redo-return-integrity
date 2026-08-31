import { buildRefundPortfolio, type RefundPortfolio } from '@return-integrity/domain/refund-portfolio'
import { useQuery, type QueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { listIntakeActivity, listRefundPortfolio, type IntakeActivityRecord } from './api'
import { usePortfolioFilter } from './portfolio-filter'

/** Pins a just-written activity row onto the shared feed so Home / Board
 * overlay the case immediately, then refreshes both queries from the API. */
export function rememberIntakeActivity(queryClient: QueryClient, record: IntakeActivityRecord | undefined) {
  if (record) {
    queryClient.setQueryData<IntakeActivityRecord[]>(['intake-activity'], (current) => {
      const existing = current ?? []
      if (existing.some((item) => item.activityId === record.activityId)) return existing
      return [record, ...existing]
    })
  }
  void queryClient.invalidateQueries({ queryKey: ['intake-activity'], refetchType: 'all' })
  void queryClient.invalidateQueries({ queryKey: ['refund-portfolio'], refetchType: 'all' })
}

/** Shared Home / Board book. When this session has intake activity, overlay
 * it onto the seeded cases here so the dashboard does not wait on a second
 * portfolio request — send / set-aside / call already refresh activity. */
export function useRefundPortfolio() {
  const filter = usePortfolioFilter()
  const activityQuery = useQuery({
    queryKey: ['intake-activity'],
    queryFn: listIntakeActivity,
  })
  const portfolioQuery = useQuery({
    queryKey: ['refund-portfolio', filter.from, filter.to],
    queryFn: () => listRefundPortfolio(filter.from, filter.to),
  })
  const portfolio = useMemo<RefundPortfolio | undefined>(() => {
    const activity = activityQuery.data ?? []
    if (activity.length > 0) {
      return buildRefundPortfolio({
        activity,
        from: filter.from,
        to: filter.to,
      })
    }
    return portfolioQuery.data
  }, [activityQuery.data, filter.from, filter.to, portfolioQuery.data])

  return {
    filter,
    portfolio,
    isPending: !portfolio && (portfolioQuery.isPending || activityQuery.isPending),
  }
}
