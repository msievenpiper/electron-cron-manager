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

  const handleDaySelect = (date: Date) => {
    setSelectedDate(date)
    setView('timeline')
  }

  return (
    <div className="p-4 flex-1 min-h-0 flex flex-col">
      <div className="flex justify-between items-center mb-4 shrink-0">
        <h2 className="text-lg font-semibold">Calendar</h2>
        <div className="flex gap-1 bg-gray-800 rounded p-1">
          {(['month', 'timeline'] as CalendarView[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 text-xs rounded capitalize transition-colors ${
                view === v ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {view === 'month'
          ? <CalendarMonthView jobs={jobs} onDaySelect={handleDaySelect} />
          : <CalendarTimelineView jobs={jobs} initialDate={selectedDate ?? undefined} />
        }
      </div>
    </div>
  )
}
