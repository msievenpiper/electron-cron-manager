import { useEffect, useState } from 'react'
import cronstrue from 'cronstrue'
import { Job, Run, RunStats } from '../../../shared/types'
import { useJobs } from '../hooks/useJobs'
import { getNextRunDate, formatUpcoming } from '../utils/schedule'
import { jobColor } from '../utils/jobColors'
import { relativeTime } from '../utils/format'
import JobEditorDrawer from '../components/JobEditorDrawer'

type TimeWindow = '24h' | '7d' | '30d'

const TIME_WINDOWS: TimeWindow[] = ['7d', '24h', '30d']
const WINDOW_LABEL: Record<TimeWindow, string> = {
  '24h': 'Last 24h',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days'
}

function scheduleLabel(cronExpr: string): string {
  try {
    return cronstrue.toString(cronExpr, { verbose: false })
  } catch {
    return cronExpr
  }
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString()
}

function countByDayAndStatus(runs: Run[], day: Date, status: Run['status']): number {
  return runs.filter((r) => r.status === status && isSameDay(new Date(r.started_at), day)).length
}

export default function HomePage() {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('7d')
  const [stats, setStats] = useState<RunStats>({ success: 0, failure: 0, running: 0 })
  const [runs, setRuns] = useState<Run[]>([])
  const { jobs, runningIds, refresh: refreshJobs } = useJobs()
  const [showNewJob, setShowNewJob] = useState(false)

  const fetchStats = (w: TimeWindow): void => {
    window.cronManager.runs.stats(w).then(setStats)
  }

  const fetchRuns = (): void => {
    window.cronManager.runs.list().then(setRuns)
  }

  useEffect(() => {
    fetchStats(timeWindow)
    fetchRuns()
    const cleanupStarted = window.cronManager.on.jobStarted(() => {
      fetchStats(timeWindow)
      fetchRuns()
    })
    const cleanupFinished = window.cronManager.on.jobFinished(() => {
      fetchStats(timeWindow)
      fetchRuns()
    })
    return () => {
      cleanupStarted()
      cleanupFinished()
    }
  }, [timeWindow])

  const jobMap = new Map(jobs.map((j) => [j.id, j]))
  const jobIndex = new Map(jobs.map((j, i) => [j.id, i]))

  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const successDelta =
    countByDayAndStatus(runs, today, 'success') - countByDayAndStatus(runs, yesterday, 'success')

  const recentRuns = runs.slice(0, 6)

  const upcomingRuns = jobs
    .filter((j) => j.enabled)
    .map((job) => ({ job, next: getNextRunDate(job.cron) }))
    .filter((x): x is { job: Job; next: Date } => x.next !== null)
    .sort((a, b) => a.next.getTime() - b.next.getTime())
    .slice(0, 5)

  const handleRunNow = async (job: Job): Promise<void> => {
    await window.cronManager.jobs.runNow(job.id)
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto px-[26px] py-[22px]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-[-0.4px] text-heading">Overview</h2>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-white/7 bg-white/6 p-0.5">
            {TIME_WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => setTimeWindow(w)}
                className={`rounded-md px-3 py-[5px] text-xs font-semibold transition-colors ${
                  timeWindow === w
                    ? 'bg-accent/25 text-accent-lighter'
                    : 'text-muted/45 font-normal'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowNewJob(true)}
            className="rounded-lg bg-accent-fill px-[14px] py-[6px] text-[12.5px] font-semibold text-white shadow-[0_2px_14px_rgba(37,99,235,0.35)] hover:bg-accent-fill-hover"
          >
            + New Job
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-[13px]">
        <div className="rounded-2xl border border-running/18 bg-running/7 px-5 py-[18px]">
          <div className="mb-1 flex items-center gap-[6px] whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.7px] text-muted/45">
            <span className="relative flex h-[7px] w-[7px] shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-running/50" />
              <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-running shadow-[0_0_0_3px_rgba(96,165,250,0.2)]" />
            </span>
            Running Now
          </div>
          <div className="text-[44px] font-bold tracking-[-2px] text-running">{stats.running}</div>
          <div className="text-xs text-muted/40">
            {stats.running} job{stats.running === 1 ? '' : 's'} active right now
          </div>
        </div>

        <div className="rounded-2xl border border-success/15 bg-success/[0.055] px-5 py-[18px]">
          <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.7px] text-muted/45">
            Successful
          </div>
          <div className="text-[44px] font-bold tracking-[-2px] text-success">{stats.success}</div>
          <div className="text-xs">
            {successDelta !== 0 && (
              <span className="font-medium text-success">
                {successDelta > 0 ? '↑' : '↓'} {Math.abs(successDelta)} from yesterday
              </span>
            )}
            <span className="text-muted/30"> · {WINDOW_LABEL[timeWindow]}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-failure/16 bg-failure/[0.055] px-5 py-[18px]">
          <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.7px] text-muted/45">
            Failed
          </div>
          <div className="text-[44px] font-bold tracking-[-2px] text-failure">{stats.failure}</div>
          <div className="text-xs">
            {stats.failure > 0 && (
              <span className="font-medium text-failure">⚠ Needs attention</span>
            )}
            <span className="text-muted/30"> · {WINDOW_LABEL[timeWindow]}</span>
          </div>
        </div>
      </div>

      <div className="mb-[13px] grid grid-cols-2 gap-[13px]">
        <div className="rounded-2xl border border-white/7 bg-white/[0.025] px-5 py-[18px]">
          <div className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.6px] text-muted/45">
            Recent Activity
          </div>
          {recentRuns.length === 0 ? (
            <p className="text-xs text-muted/30">No runs yet.</p>
          ) : (
            <div>
              {recentRuns.map((run) => {
                const job = jobMap.get(run.job_id)
                const color =
                  run.status === 'success'
                    ? 'text-success'
                    : run.status === 'failure'
                      ? 'text-failure'
                      : run.status === 'running'
                        ? 'text-running'
                        : 'text-killed'
                const label =
                  run.status === 'success'
                    ? 'OK'
                    : run.status === 'failure'
                      ? 'Failed'
                      : run.status === 'running'
                        ? 'Running'
                        : 'Killed'
                const dotColor =
                  run.status === 'success'
                    ? 'bg-success'
                    : run.status === 'failure'
                      ? 'bg-failure'
                      : run.status === 'running'
                        ? 'bg-running'
                        : 'bg-killed'
                return (
                  <div
                    key={run.id}
                    className="flex items-center gap-[9px] border-b border-white/5 py-[7px] last:border-0"
                  >
                    <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${dotColor}`} />
                    <span className="flex-1 truncate text-[13px] font-medium text-body">
                      {job?.name ?? run.job_id}
                    </span>
                    <span className={`text-[11px] font-semibold ${color}`}>{label}</span>
                    <span className="min-w-[48px] text-right text-[11px] text-muted/32">
                      {relativeTime(run.started_at)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/7 bg-white/[0.025] px-5 py-[18px]">
          <div className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.6px] text-muted/45">
            Upcoming Runs
          </div>
          {upcomingRuns.length === 0 ? (
            <p className="text-xs text-muted/30">No upcoming runs.</p>
          ) : (
            <div>
              {upcomingRuns.map(({ job, next }) => (
                <div key={job.id} className="flex items-center gap-[9px] py-[9px]">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: jobColor(jobIndex.get(job.id) ?? 0) }}
                  />
                  <span className="flex-1 truncate text-[13px] font-medium text-body">
                    {job.name}
                  </span>
                  <span className="text-xs text-muted/48">{formatUpcoming(next)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/7 bg-white/[0.025] px-[18px] py-4">
        <div className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.6px] text-muted/45">
          Quick Run
        </div>
        {jobs.length === 0 ? (
          <p className="text-xs text-muted/30">No jobs yet.</p>
        ) : (
          <div className="flex flex-col gap-[5px]">
            {jobs.map((job) => {
              const isRunning = runningIds.has(job.id)
              const dot = isRunning ? 'bg-success' : job.enabled ? 'bg-accent' : 'bg-disabled-dot'
              return (
                <div
                  key={job.id}
                  className="flex items-center gap-[11px] rounded-[10px] border border-white/5 bg-white/2 px-3 py-[9px]"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                  <span className="min-w-[130px] text-[13px] font-semibold text-body">
                    {job.name}
                  </span>
                  <span className="flex-1 truncate text-xs text-muted/42">
                    {scheduleLabel(job.cron)}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                      isRunning
                        ? 'bg-success/12 text-success'
                        : !job.enabled
                          ? 'bg-white/4 text-disabled'
                          : 'bg-accent/10 text-accent-lighter'
                    }`}
                  >
                    {isRunning ? 'Running' : job.enabled ? 'Scheduled' : 'Disabled'}
                  </span>
                  <button
                    onClick={() => handleRunNow(job)}
                    disabled={isRunning}
                    className={`rounded-[7px] px-[13px] py-[6px] text-xs font-semibold transition-colors ${
                      isRunning
                        ? 'border border-success/28 bg-success/12 text-success'
                        : 'border border-white/9 bg-white/6 text-muted/65 hover:bg-white/9'
                    }`}
                  >
                    {isRunning ? '↻ Running…' : '▶ Run Now'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showNewJob && (
        <JobEditorDrawer job={null} onClose={() => setShowNewJob(false)} onSave={refreshJobs} />
      )}
    </div>
  )
}
