import CronExpressionParser from 'cron-parser'

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
