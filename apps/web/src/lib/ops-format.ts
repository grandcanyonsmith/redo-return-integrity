export const moneyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export const formatCents = (cents: number | null | undefined) => (
  cents === null || cents === undefined ? '—' : moneyFormatter.format(cents / 100)
)

export const formatWhen = (iso: string) => new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}).format(new Date(iso))

export const formatDay = (day: string) => new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
}).format(new Date(`${day}T00:00:00.000Z`))

export const formatDayRange = (from: string, to: string) => (
  from === to ? formatDay(from) : `${formatDay(from)} – ${formatDay(to)}`
)
