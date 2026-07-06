import { useState, useEffect, useCallback } from 'react'
import { Job, Run } from '../../../shared/types'
import StatusBadge from '../components/StatusBadge'
import LogDetailModal from '../components/LogDetailModal'
import { jobColor } from '../utils/jobColors'
import { relativeTime, runDuration } from '../utils/format'

export default function HistoryPage() {
  const [runs, setRuns] = useState<Run[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [logRunId, setLogRunId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const [runList, jobList] = await Promise.all([
      window.cronManager.runs.list(),
      window.cronManager.jobs.list()
    ])
    setRuns(runList)
    setJobs(jobList)
  }, [])

  useEffect(() => {
    refresh()
    const cleanup = window.cronManager.on.jobFinished(() => refresh())
    return cleanup
  }, [refresh])

  const jobMap = new Map(jobs.map((j) => [j.id, j]))
  const jobIndex = new Map(jobs.map((j, i) => [j.id, i]))
  const logRun = runs.find((r) => r.id === logRunId) ?? null

  return (
    <div className="flex-1 min-h-0 overflow-auto px-[26px] py-[22px]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-heading">History</h2>
        <button
          onClick={refresh}
          className="rounded-[7px] border border-white/8 px-3 py-[6px] text-xs text-muted/45 hover:text-muted/70"
        >
          ↺ Refresh
        </button>
      </div>

      {runs.length === 0 ? (
        <p className="text-sm text-muted/40">No runs yet. Trigger a job to see history.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/7 bg-white/2">
          <div className="grid grid-cols-[120px_1fr_90px_80px_60px] border-b border-white/7 px-4 py-[9px]">
            {['Status', 'Job', 'Time', 'Duration', ''].map((h) => (
              <span
                key={h}
                className="text-[10.5px] font-semibold uppercase tracking-[0.5px] text-muted/32"
              >
                {h}
              </span>
            ))}
          </div>
          {runs.map((run) => {
            const job = jobMap.get(run.job_id)
            const idx = jobIndex.get(run.job_id) ?? 0
            return (
              <div
                key={run.id}
                className="grid grid-cols-[120px_1fr_90px_80px_60px] items-center border-b border-white/4 px-4 py-[11px] last:border-0 hover:bg-white/2"
              >
                <StatusBadge variant={run.status} />
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: jobColor(idx) }}
                  />
                  <span className="truncate text-[13px] font-medium text-body">
                    {job?.name ?? run.job_id}
                  </span>
                </span>
                <span className="text-xs text-muted/42">{relativeTime(run.started_at)}</span>
                <span className="font-mono text-[11.5px] text-muted/30">{runDuration(run)}</span>
                <button
                  onClick={() => setLogRunId(run.id)}
                  className="justify-self-start rounded-[5px] border border-white/6 px-2 py-1 text-[11px] text-muted/30 hover:text-muted/60"
                >
                  Logs
                </button>
              </div>
            )
          })}
        </div>
      )}

      {logRun && (
        <LogDetailModal
          run={logRun}
          job={jobMap.get(logRun.job_id)}
          onClose={() => setLogRunId(null)}
        />
      )}
    </div>
  )
}
