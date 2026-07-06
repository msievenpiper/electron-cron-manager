import { useState, type ReactElement } from 'react'
import { Job } from '../../../shared/types'
import { getRunDatesInMonth } from '../utils/schedule'
import { jobColor } from '../utils/jobColors'

interface Props {
  jobs: Job[]
  initialDate?: Date
}

export default function CalendarTimelineView({ jobs, initialDate }: Props): ReactElement {
  const today = new Date()
  const [date, setDate] = useState(
    initialDate
      ? new Date(initialDate.getFullYear(), initialDate.getMonth(), initialDate.getDate())
      : new Date(today.getFullYear(), today.getMonth(), today.getDate())
  )

  const goDay = (delta: number): void => {
    const d = new Date(date)
    d.setDate(d.getDate() + delta)
    setDate(d)
  }

  // Compute runs for the selected date
  const dayRuns: { job: Job; jobIdx: number; times: Date[] }[] = jobs
    .map((job, jobIdx) => ({
      job,
      jobIdx,
      times: getRunDatesInMonth(job.cron, date.getFullYear(), date.getMonth()).filter(
        (d) => d.getDate() === date.getDate()
      )
    }))
    .filter((x) => x.times.length > 0)

  const HOURS = Array.from({ length: 24 }, (_, i) => i)
  const hasAnyRuns = dayRuns.length > 0

  return (
    <div>
      {/* Date navigation */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => goDay(-1)} className="px-2 py-1 text-muted/50 hover:text-body">
          ‹
        </button>
        <span className="font-medium text-heading">
          {date.toLocaleDateString('default', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          })}
        </span>
        <button onClick={() => goDay(1)} className="px-2 py-1 text-muted/50 hover:text-body">
          ›
        </button>
      </div>

      {!hasAnyRuns && (
        <p className="text-muted/40 text-sm ml-14">No jobs scheduled for this day.</p>
      )}

      <div>
        {HOURS.map((hour) => {
          const hourRuns = dayRuns.flatMap(({ job, jobIdx, times }) =>
            times.filter((t) => t.getHours() === hour).map((t) => ({ job, jobIdx, t }))
          )
          return (
            <div key={hour} className="flex border-t border-white/5 min-h-[44px]">
              <div className="w-14 text-xs text-muted/35 pt-1.5 shrink-0 text-right pr-3">
                {String(hour).padStart(2, '0')}:00
              </div>
              <div className="flex-1 px-2 py-1 flex flex-wrap gap-1 items-start">
                {hourRuns.map(({ job, jobIdx, t }, i) => (
                  <span
                    key={`${job.id}-${i}`}
                    className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs border"
                    style={{
                      borderColor: `${jobColor(jobIdx)}80`,
                      backgroundColor: `${jobColor(jobIdx)}20`,
                      color: jobColor(jobIdx)
                    }}
                  >
                    <span>{job.name}</span>
                    <span className="opacity-60">:{String(t.getMinutes()).padStart(2, '0')}</span>
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
