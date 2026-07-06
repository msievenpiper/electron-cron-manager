import CronExpressionParser from 'cron-parser'

export function getNextRunDate(cronExpr: string, from: Date = new Date()): Date | null {
  try {
    const interval = CronExpressionParser.parse(cronExpr, { currentDate: from })
    return interval.next().toDate()
  } catch {
    return null
  }
}

export function formatUpcoming(date: Date, from: Date = new Date()): string {
  const diffMs = date.getTime() - from.getTime()
  const diffHours = diffMs / 3_600_000
  const sameDay = date.toDateString() === from.toDateString()
  const time = date.toLocaleTimeString('default', { hour: 'numeric', minute: '2-digit' })

  if (diffHours < 1) return 'In less than an hour'
  if (sameDay) {
    if (diffHours < 6)
      return `In ~${Math.round(diffHours)} hour${Math.round(diffHours) === 1 ? '' : 's'}`
    return `Tonight at ${time}`
  }
  const tomorrow = new Date(from)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow at ${time}`
  const weekday = date.toLocaleDateString('default', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
  return `${weekday} at ${time}`
}

export function getRunDatesInMonth(cronExpr: string, year: number, month: number): Date[] {
  // month is 0-indexed (JS Date convention)
  const start = new Date(year, month, 1, 0, 0, 0)
  const end = new Date(year, month + 1, 1, 0, 0, 0)
  const dates: Date[] = []

  try {
    const interval = CronExpressionParser.parse(cronExpr, { currentDate: start, endDate: end })
    while (true) {
      try {
        const next = interval.next().toDate()
        if (next >= end) break
        dates.push(next)
      } catch {
        break
      }
    }
  } catch {
    // invalid expression — return empty
  }

  return dates
}
