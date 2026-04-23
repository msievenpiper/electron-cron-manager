import { useState, useEffect } from 'react'
import { Job, Run, RunStats } from '../../../shared/types'

type TimeWindow = '24h' | '7d' | '30d'

const TIME_WINDOWS: TimeWindow[] = ['24h', '7d', '30d']

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

interface JobSummaryRow {
  jobId: string
  jobName: string
  lastRun: Run
  successRate: number | null
}

function buildJobSummary(jobs: Job[], runs: Run[]): JobSummaryRow[] {
  const jobMap = new Map(jobs.map(j => [j.id, j]))
  const byJob = new Map<string, Run[]>()
  for (const run of runs) {
    if (!byJob.has(run.job_id)) byJob.set(run.job_id, [])
    byJob.get(run.job_id)!.push(run)
  }
  const rows: JobSummaryRow[] = []
  for (const [jobId, jobRuns] of byJob) {
    const job = jobMap.get(jobId)
    if (!job) continue
    const lastRun = jobRuns[0]
    const completed = jobRuns.filter(r => r.status === 'success' || r.status === 'failure')
    const successRate = completed.length > 0
      ? Math.round(jobRuns.filter(r => r.status === 'success').length / completed.length * 100)
      : null
    rows.push({ jobId, jobName: job.name, lastRun, successRate })
  }
  return rows
}

function StatusDot({ status }: { status: Run['status'] }) {
  const color =
    status === 'success' ? 'bg-green-500' :
    status === 'failure' ? 'bg-red-500' :
    status === 'running' ? 'bg-blue-500' : 'bg-yellow-500'
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${color}`} />
}

export default function HomePage() {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('24h')
  const [stats, setStats] = useState<RunStats>({ success: 0, failure: 0, running: 0 })
  const [runs, setRuns] = useState<Run[]>([])
  const [jobs, setJobs] = useState<Job[]>([])

  const fetchStats = (w: TimeWindow) =>
    window.cronManager.runs.stats(w).then(setStats)

  const fetchRunsAndJobs = () =>
    Promise.all([
      window.cronManager.runs.list(),
      window.cronManager.jobs.list(),
    ]).then(([r, j]) => { setRuns(r); setJobs(j) })

  useEffect(() => {
    fetchStats(timeWindow)
    fetchRunsAndJobs()
    const cleanupStarted = window.cronManager.on.jobStarted(() => {
      fetchStats(timeWindow)
      fetchRunsAndJobs()
    })
    const cleanupFinished = window.cronManager.on.jobFinished(() => {
      fetchStats(timeWindow)
      fetchRunsAndJobs()
    })
    return () => { cleanupStarted(); cleanupFinished() }
  }, [timeWindow])

  const recentRuns = runs.slice(0, 10)
  const jobMap = new Map(jobs.map(j => [j.id, j]))
  const jobSummary = buildJobSummary(jobs, runs)

  return (
    <div className="p-4 flex-1 min-h-0 overflow-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Overview</h2>
        <div className="flex bg-gray-800 rounded overflow-hidden text-xs">
          {TIME_WINDOWS.map(w => (
            <button
              key={w}
              onClick={() => setTimeWindow(w)}
              className={`px-3 py-1.5 ${
                timeWindow === w ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Running Now</div>
          <div className="text-3xl font-bold text-blue-400">{stats.running}</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Successful</div>
          <div className="text-3xl font-bold text-green-400">{stats.success}</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Failed</div>
          <div className="text-3xl font-bold text-red-400">{stats.failure}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wide mb-3">Recent Runs</h3>
          {recentRuns.length === 0 ? (
            <p className="text-gray-500 text-xs">No runs yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentRuns.map(run => (
                <div key={run.id} className="flex justify-between items-center text-xs">
                  <span className="flex items-center gap-2">
                    <StatusDot status={run.status} />
                    <span className="text-gray-200">{jobMap.get(run.job_id)?.name ?? run.job_id}</span>
                  </span>
                  <span>
                    {run.status === 'running'
                      ? <span className="text-blue-400">running…</span>
                      : <span className="text-gray-500">{relativeTime(run.started_at)}</span>
                    }
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wide mb-3">Job Summary</h3>
          {jobSummary.length === 0 ? (
            <p className="text-gray-500 text-xs">No runs yet.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="pb-1 text-left font-normal">Job</th>
                  <th className="pb-1 text-right font-normal">Last run</th>
                  <th className="pb-1 text-right font-normal">Success</th>
                </tr>
              </thead>
              <tbody>
                {jobSummary.map(row => (
                  <tr key={row.jobId} className="border-b border-gray-800/50">
                    <td className="py-1.5 text-gray-200">{row.jobName}</td>
                    <td className="py-1.5 text-right">
                      <span className={
                        row.lastRun.status === 'success' ? 'text-green-400' :
                        row.lastRun.status === 'failure' ? 'text-red-400' :
                        row.lastRun.status === 'running' ? 'text-blue-400' : 'text-yellow-400'
                      }>
                        {row.lastRun.status === 'running'
                          ? '↻ now'
                          : relativeTime(row.lastRun.started_at)
                        }
                      </span>
                    </td>
                    <td className="py-1.5 text-right">
                      {row.successRate === null
                        ? <span className="text-gray-500">—</span>
                        : <span className={
                            row.successRate === 100 ? 'text-green-400' :
                            row.successRate >= 80  ? 'text-yellow-400' : 'text-red-400'
                          }>{row.successRate}%</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
