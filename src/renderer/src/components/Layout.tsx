import { useState, type ReactElement } from 'react'
import HomePage from '../pages/HomePage'
import JobsPage from '../pages/JobsPage'
import CalendarPage from '../pages/CalendarPage'
import HistoryPage from '../pages/HistoryPage'

type Tab = 'home' | 'jobs' | 'calendar' | 'history'

export default function Layout(): ReactElement {
  const [tab, setTab] = useState<Tab>('home')

  return (
    <div className="flex flex-col h-screen bg-app text-body">
      <nav className="flex border-b border-white/7 bg-titlebar px-2">
        {(['home', 'jobs', 'calendar', 'history'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`h-[42px] px-4 text-[13px] tracking-[-0.1px] capitalize transition-colors border-b-2 ${
              tab === t
                ? 'border-accent text-accent-light font-semibold'
                : 'border-transparent text-muted/48 font-normal hover:text-muted/70'
            }`}
          >
            {t}
          </button>
        ))}
      </nav>
      <main className="flex-1 overflow-hidden flex flex-col">
        {tab === 'home' && <HomePage />}
        {tab === 'jobs' && <JobsPage />}
        {tab === 'calendar' && <CalendarPage />}
        {tab === 'history' && <HistoryPage />}
      </main>
    </div>
  )
}
