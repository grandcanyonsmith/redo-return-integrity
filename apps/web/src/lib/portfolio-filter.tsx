import { addCalendarDays, endOfMonth, startOfIsoWeek, startOfMonth } from '@return-integrity/domain/refund-portfolio'
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type MonthCell = { day: string; inMonth: boolean }

export const monthGrid = (yearMonth: string): MonthCell[] => {
  const first = `${yearMonth}-01`
  const weekday = new Date(`${first}T00:00:00.000Z`).getUTCDay()
  const firstCell = addCalendarDays(first, -weekday)
  return Array.from({ length: 42 }, (_, index) => {
    const day = addCalendarDays(firstCell, index)
    return { day, inMonth: day.startsWith(yearMonth) }
  })
}

export const shiftYearMonth = (yearMonth: string, delta: number): string => {
  const date = new Date(`${yearMonth}-01T00:00:00.000Z`)
  date.setUTCMonth(date.getUTCMonth() + delta)
  return date.toISOString().slice(0, 7)
}

export type PortfolioRangePreset = 'week' | 'month' | 'day'

type PortfolioFilterValue = {
  from: string
  to: string
  selectedDay: string | null
  viewMonth: string
  today: string
  preset: PortfolioRangePreset
  setViewMonth: (yearMonth: string) => void
  selectDay: (day: string) => void
  setWeek: () => void
  setMonth: () => void
}

const PortfolioFilterContext = createContext<PortfolioFilterValue | null>(null)

const todayUtc = () => new Date().toISOString().slice(0, 10)

export function PortfolioFilterProvider({ children }: { children: ReactNode }) {
  const today = todayUtc()
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [preset, setPreset] = useState<PortfolioRangePreset>('month')
  const [from, setFrom] = useState(() => startOfMonth(today))
  const [to, setTo] = useState(() => endOfMonth(today))
  const [viewMonth, setViewMonth] = useState(() => today.slice(0, 7))

  const value = useMemo<PortfolioFilterValue>(() => ({
    from,
    to,
    selectedDay,
    viewMonth,
    today,
    preset,
    setViewMonth,
    selectDay: (day: string) => {
      setPreset('day')
      setSelectedDay(day)
      setFrom(day)
      setTo(day)
      setViewMonth(day.slice(0, 7))
    },
    setWeek: () => {
      const start = startOfIsoWeek(today)
      setPreset('week')
      setSelectedDay(null)
      setFrom(start)
      setTo(addCalendarDays(start, 6))
      setViewMonth(today.slice(0, 7))
    },
    setMonth: () => {
      setPreset('month')
      setSelectedDay(null)
      setFrom(startOfMonth(today))
      setTo(endOfMonth(today))
      setViewMonth(today.slice(0, 7))
    },
  }), [from, preset, selectedDay, to, today, viewMonth])

  return <PortfolioFilterContext.Provider value={value}>{children}</PortfolioFilterContext.Provider>
}

export function usePortfolioFilter(): PortfolioFilterValue {
  const value = useContext(PortfolioFilterContext)
  if (!value) throw new Error('usePortfolioFilter must be used inside PortfolioFilterProvider')
  return value
}
