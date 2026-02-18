import { useState } from 'react'
import JobsPage from '../pages/JobsPage'
import CalendarPage from '../pages/CalendarPage'
import HistoryPage from '../pages/HistoryPage'

type Tab = 'jobs' | 'calendar' | 'history'

export default function Layout() {
  const [tab, setTab] = useState<Tab>('jobs')

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      <nav className="flex border-b border-gray-800 px-4">
        {(['jobs', 'calendar', 'history'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </nav>
      <main className="flex-1 overflow-auto">
        {tab === 'jobs' && <JobsPage />}
        {tab === 'calendar' && <CalendarPage />}
        {tab === 'history' && <HistoryPage />}
      </main>
    </div>
  )
}
