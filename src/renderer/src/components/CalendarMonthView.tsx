import { useState } from 'react'
import { Job } from '../../../shared/types'
import { getRunDatesInMonth } from '../utils/schedule'

const JOB_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-yellow-500',
  'bg-pink-500',
]

interface Props { jobs: Job[]; onDaySelect: (date: Date) => void }

export default function CalendarMonthView({ jobs, onDaySelect }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay() // 0=Sun

  // Build day → jobs map
  const dayJobMap = new Map<number, Set<number>>() // day → Set of job indices
  jobs.forEach((job, jobIdx) => {
    const dates = getRunDatesInMonth(job.cron, year, month)
    dates.forEach(d => {
      const day = d.getDate()
      if (!dayJobMap.has(day)) dayJobMap.set(day, new Set())
      dayJobMap.get(day)!.add(jobIdx)
    })
  })

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const monthName = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={prevMonth} className="px-2 py-1 text-gray-400 hover:text-white">‹</button>
        <span className="font-medium text-gray-100">{monthName}</span>
        <button onClick={nextMonth} className="px-2 py-1 text-gray-400 hover:text-white">›</button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-xs text-gray-500 py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />
          const jobIndices = Array.from(dayJobMap.get(day) ?? [])
          return (
            <button
              key={day}
              onClick={() => onDaySelect(new Date(year, month, day))}
              className={[
                'aspect-square rounded flex flex-col items-center justify-start p-1 text-xs transition-colors cursor-pointer',
                isToday(day) ? 'bg-blue-900/40 text-blue-300' : 'hover:bg-gray-800 text-gray-200',
              ].join(' ')}
            >
              <span className="leading-none">{day}</span>
              {jobIndices.length > 0 && (
                <div className="flex flex-wrap gap-0.5 justify-center mt-1">
                  {jobIndices.slice(0, 5).map(ji => (
                    <div key={ji} className={`w-1.5 h-1.5 rounded-full ${JOB_COLORS[ji % JOB_COLORS.length]}`} />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
