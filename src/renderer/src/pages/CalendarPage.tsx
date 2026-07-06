import { useState, useEffect } from 'react'
import { Job } from '../../../shared/types'
import CalendarMonthView from '../components/CalendarMonthView'
import CalendarTimelineView from '../components/CalendarTimelineView'

type CalendarView = 'month' | 'timeline'

export default function CalendarPage() {
  const [view, setView] = useState<CalendarView>('month')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])

  useEffect(() => {
    window.cronManager.jobs.list().then(setJobs)
  }, [])

  const handleDaySelect = (date: Date): void => {
    setSelectedDate(date)
    setView('timeline')
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col px-6 py-5">
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <h2 className="text-lg font-bold text-heading">Calendar</h2>
        <div className="flex rounded-lg border border-white/7 bg-white/5 p-[3px]">
          {(['month', 'timeline'] as CalendarView[]).map((v) => (
            <button
              key={v}
              onClick={() => {
                setView(v)
                setSelectedDate(null)
              }}
              className={`rounded-md px-3 py-1 text-xs capitalize transition-colors ${
                view === v ? 'bg-white/10 font-medium text-body' : 'text-muted/45 hover:text-body'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {view === 'month' ? (
          <CalendarMonthView jobs={jobs} onDaySelect={handleDaySelect} />
        ) : (
          <CalendarTimelineView
            key={selectedDate?.toISOString() ?? 'default'}
            jobs={jobs}
            initialDate={selectedDate ?? undefined}
          />
        )}
      </div>
    </div>
  )
}
