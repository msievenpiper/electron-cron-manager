import { useMemo, useState } from 'react'
import { Job } from '../../../shared/types'
import { getRunDatesInMonth } from '../utils/schedule'
import { jobColor } from '../utils/jobColors'

interface Props {
  jobs: Job[]
  onDaySelect: (date: Date) => void
}

type DayJobEntry = { jobIdx: number }

export default function CalendarMonthView({ jobs, onDaySelect }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const prevMonth = (): void => {
    if (month === 0) {
      setMonth(11)
      setYear((y) => y - 1)
    } else setMonth((m) => m - 1)
  }
  const nextMonth = (): void => {
    if (month === 11) {
      setMonth(0)
      setYear((y) => y + 1)
    } else setMonth((m) => m + 1)
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay() // 0=Sun

  const dayJobMap = useMemo(() => {
    const buildMap = new Map<number, Map<number, DayJobEntry>>()

    jobs.forEach((job, jobIdx) => {
      if (!job.enabled) return
      const dates = getRunDatesInMonth(job.cron, year, month)
      dates.forEach((d) => {
        const day = d.getDate()
        if (!buildMap.has(day)) buildMap.set(day, new Map())
        const jobMap = buildMap.get(day)!
        if (!jobMap.has(jobIdx)) jobMap.set(jobIdx, { jobIdx })
      })
    })

    const result = new Map<number, DayJobEntry[]>()
    buildMap.forEach((jobMap, day) => {
      result.set(day, Array.from(jobMap.values()))
    })
    return result
  }, [jobs, year, month])

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
  ]

  const monthName = new Date(year, month).toLocaleString('default', {
    month: 'long',
    year: 'numeric'
  })
  const isCurrentMonth = month === today.getMonth() && year === today.getFullYear()
  const isToday = (day: number) => isCurrentMonth && day === today.getDate()
  const isPast = (day: number) => isCurrentMonth && day < today.getDate()

  const enabledJobs = jobs.filter((j) => j.enabled).map((j) => ({ job: j, idx: jobs.indexOf(j) }))

  const truncate = (name: string): string => (name.length > 12 ? `${name.slice(0, 10)}…` : name)

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <button
          onClick={prevMonth}
          className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-white/8 bg-white/[0.055] text-[15px] text-muted/60 hover:bg-white/9"
        >
          ‹
        </button>
        <span className="min-w-[126px] text-[15px] font-semibold tracking-[-0.3px] text-heading">
          {monthName}
        </span>
        <button
          onClick={nextMonth}
          className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-white/8 bg-white/[0.055] text-[15px] text-muted/60 hover:bg-white/9"
        >
          ›
        </button>

        <div className="ml-4 flex flex-wrap items-center gap-x-[14px] gap-y-1">
          {enabledJobs.map(({ job, idx }) => (
            <span key={job.id} className="flex items-center gap-[6px]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: jobColor(idx) }} />
              <span className="text-[11px] text-muted/50">{job.name}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div
            key={d}
            className="py-1 text-center text-[11px] font-semibold uppercase tracking-[0.4px] text-muted/30"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />
          const jobEntries = dayJobMap.get(day) ?? []
          const today_ = isToday(day)
          const past = isPast(day)
          return (
            <button
              key={day}
              onClick={() => onDaySelect(new Date(year, month, day))}
              className={`flex min-h-[84px] flex-col items-start gap-[3px] rounded-lg px-[7px] pb-[5px] pt-2 text-left transition-colors ${
                today_
                  ? 'border border-accent/28 bg-accent/10'
                  : 'border border-white/[0.055] bg-white/[0.018] hover:bg-white/[0.035]'
              }`}
            >
              <span
                className={`text-xs leading-none ${
                  today_
                    ? 'font-bold text-accent-light'
                    : past
                      ? 'text-muted/26'
                      : 'font-normal text-body'
                }`}
              >
                {day}
              </span>
              {jobEntries.length > 0 && (
                <div className="flex w-full flex-col gap-[2px]">
                  {jobEntries.slice(0, 3).map(({ jobIdx }) => (
                    <div key={jobIdx} className="flex items-center gap-[4px]">
                      <span
                        className="h-[5px] w-[5px] shrink-0 rounded-full"
                        style={{ backgroundColor: jobColor(jobIdx) }}
                      />
                      <span className="truncate text-[10px]" style={{ color: jobColor(jobIdx) }}>
                        {truncate(jobs[jobIdx]?.name ?? '')}
                      </span>
                    </div>
                  ))}
                  {jobEntries.length > 3 && (
                    <span className="text-[9.5px] leading-none text-muted/32">
                      +{jobEntries.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
