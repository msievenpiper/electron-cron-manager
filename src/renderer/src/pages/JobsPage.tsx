import { useEffect, useMemo, useState } from 'react'
import cronstrue from 'cronstrue'
import { useJobs } from '../hooks/useJobs'
import { Job, Run } from '../../../shared/types'
import JobEditorDrawer from '../components/JobEditorDrawer'
import StatusBadge, { jobStatusVariant } from '../components/StatusBadge'
import { getNextRunDate } from '../utils/schedule'
import { relativeTime, runDuration } from '../utils/format'

const NOTIFY_LABEL: Record<Job['notify'], string> = {
  all: 'All completions',
  failure: 'Failures only',
  none: 'Silent'
}

function scheduleLabel(cronExpr: string): string {
  try {
    return cronstrue.toString(cronExpr, { verbose: false })
  } catch {
    return cronExpr
  }
}

export default function JobsPage() {
  const { jobs, runningIds, refresh } = useJobs()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingJob, setEditingJob] = useState<Job | null | 'new'>(null)
  const [detailRuns, setDetailRuns] = useState<Run[]>([])

  const filteredJobs = useMemo(
    () => jobs.filter((j) => j.name.toLowerCase().includes(search.trim().toLowerCase())),
    [jobs, search]
  )

  const selectedJob = jobs.find((j) => j.id === selectedId) ?? null

  useEffect(() => {
    if (!selectedJob) return undefined
    window.cronManager.runs.listByJob(selectedJob.id).then(setDetailRuns)
    const cleanup = window.cronManager.on.jobFinished((jobId) => {
      if (jobId === selectedJob.id)
        window.cronManager.runs.listByJob(selectedJob.id).then(setDetailRuns)
    })
    return cleanup
  }, [selectedJob?.id])

  const handleRunNow = async (job: Job): Promise<void> => {
    await window.cronManager.jobs.runNow(job.id)
  }

  const handleKill = async (job: Job): Promise<void> => {
    await window.cronManager.jobs.kill(job.id)
  }

  const handleDelete = async (job: Job): Promise<void> => {
    if (confirm(`Delete "${job.name}"?`)) {
      await window.cronManager.jobs.delete(job.id)
      if (selectedId === job.id) setSelectedId(null)
      refresh()
    }
  }

  const nextRun = selectedJob?.enabled ? getNextRunDate(selectedJob.cron) : null

  return (
    <div className="flex-1 min-h-0 flex">
      <div className="flex w-[268px] shrink-0 flex-col border-r border-white/7 bg-black/18">
        <div className="flex items-center gap-2 border-b border-white/6 px-3 pb-[11px] pt-[13px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs…"
            className="flex-1 rounded-lg border border-white/8 bg-white/[0.055] px-[10px] py-[7px] text-xs text-body outline-none placeholder:text-muted/40 focus:border-accent/50"
          />
          <button
            onClick={() => setEditingJob('new')}
            className="shrink-0 rounded-lg bg-accent-fill px-3 py-[7px] text-xs font-semibold text-white hover:bg-accent-fill-hover"
          >
            + New
          </button>
        </div>

        <div className="flex-1 overflow-auto px-[9px] py-[10px]">
          <div className="flex flex-col gap-[5px]">
            {filteredJobs.map((job) => {
              const isRunning = runningIds.has(job.id)
              const dot = isRunning ? 'bg-success' : job.enabled ? 'bg-accent' : 'bg-disabled-dot'
              const statusColor = isRunning
                ? 'text-success'
                : job.enabled
                  ? 'text-accent-light'
                  : 'text-disabled'
              const statusLabel = isRunning
                ? '↻ Running'
                : job.enabled
                  ? '● Scheduled'
                  : '○ Disabled'
              const selected = selectedId === job.id
              return (
                <button
                  key={job.id}
                  onClick={() => setSelectedId(job.id)}
                  className={`flex flex-col gap-[5px] rounded-[11px] border px-[13px] py-3 text-left transition-colors ${
                    selected ? 'border-accent/28 bg-accent/9' : 'border-white/[6.5%] bg-white/2'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                    <span className="truncate text-[13px] font-semibold text-body">{job.name}</span>
                  </div>
                  <div className="truncate pl-4 text-[11px] text-muted/42">
                    {scheduleLabel(job.cron)}
                  </div>
                  <div className="flex items-center gap-2 pl-4">
                    <span className={`text-[11px] font-medium ${statusColor}`}>{statusLabel}</span>
                    <span className="rounded px-[6px] py-0.5 text-[10px] text-muted/45 bg-white/6">
                      {job.interpreter}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {!selectedJob ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#e2eaf6"
              strokeOpacity={0.2}
              strokeWidth={1.5}
            >
              <rect x="3" y="4" width="18" height="4" rx="1" />
              <rect x="3" y="10" width="18" height="4" rx="1" />
              <rect x="3" y="16" width="18" height="4" rx="1" />
            </svg>
            <p className="text-[13px] font-medium text-muted/25">Select a job to see details</p>
          </div>
        ) : (
          <div className="px-[30px] py-[26px]">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-[21px] font-bold tracking-[-0.5px] text-heading">
                    {selectedJob.name}
                  </h2>
                  <StatusBadge
                    variant={jobStatusVariant(selectedJob, runningIds.has(selectedJob.id))}
                  />
                </div>
                <p className="mt-1 text-[13px] text-muted/48">{scheduleLabel(selectedJob.cron)}</p>
              </div>
              <div className="flex gap-2">
                {runningIds.has(selectedJob.id) ? (
                  <button
                    onClick={() => handleKill(selectedJob)}
                    className="rounded-lg border border-killed/30 bg-killed/10 px-[14px] py-[7px] text-xs font-semibold text-killed hover:bg-killed/18"
                  >
                    ■ Kill
                  </button>
                ) : (
                  <button
                    onClick={() => handleRunNow(selectedJob)}
                    className="rounded-lg border border-success/22 bg-success/10 px-[14px] py-[7px] text-xs font-semibold text-success hover:bg-success/18"
                  >
                    ▶ Run Now
                  </button>
                )}
                <button
                  onClick={() => setEditingJob(selectedJob)}
                  className="rounded-lg border border-accent/22 bg-accent/9 px-[14px] py-[7px] text-xs font-semibold text-accent-light hover:bg-accent/16"
                >
                  Edit
                </button>
              </div>
            </div>

            <div className="mb-[22px] grid grid-cols-2 gap-[10px]">
              <div className="rounded-xl border border-white/6 bg-white/[0.025] px-[15px] py-[14px]">
                <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.5px] text-muted/38">
                  Schedule
                </div>
                <div className="text-[13px] font-medium text-body">
                  {scheduleLabel(selectedJob.cron)}
                </div>
                <div className="mt-1 font-mono text-[11px] text-accent-light/50">
                  {selectedJob.cron}
                </div>
              </div>
              <div className="rounded-xl border border-white/6 bg-white/[0.025] px-[15px] py-[14px]">
                <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.5px] text-muted/38">
                  Next Run
                </div>
                <div className="text-[13px] font-medium text-body">
                  {!selectedJob.enabled ? 'Disabled' : nextRun ? nextRun.toLocaleString() : '—'}
                </div>
              </div>
              <div className="rounded-xl border border-white/6 bg-white/[0.025] px-[15px] py-[14px]">
                <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.5px] text-muted/38">
                  Interpreter
                </div>
                <div className="text-[13px] font-medium text-body">{selectedJob.interpreter}</div>
              </div>
              <div className="rounded-xl border border-white/6 bg-white/[0.025] px-[15px] py-[14px]">
                <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.5px] text-muted/38">
                  Notifications
                </div>
                <div className="text-[13px] font-medium text-body">
                  {NOTIFY_LABEL[selectedJob.notify]}
                </div>
              </div>
            </div>

            <div className="mb-[22px]">
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.5px] text-muted/38">
                Command
              </div>
              <div className="rounded-[10px] border border-white/7 bg-black/40 px-4 py-[14px]">
                <pre className="whitespace-pre-wrap font-mono text-[12.5px] leading-[1.65] text-accent-lighter">
                  {selectedJob.command}
                </pre>
              </div>
            </div>

            <div className="mb-4">
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.5px] text-muted/38">
                Recent Runs
              </div>
              <div className="overflow-hidden rounded-xl border border-white/[6.5%] bg-white/2">
                {detailRuns.length === 0 ? (
                  <p className="p-4 text-[13px] text-muted/30">No runs recorded yet.</p>
                ) : (
                  detailRuns.map((run) => (
                    <div
                      key={run.id}
                      className="flex items-center gap-3 border-b border-white/[4.5%] px-4 py-[10px] last:border-0"
                    >
                      <StatusBadge variant={run.status} />
                      <span className="flex-1 text-xs text-muted/42">
                        {relativeTime(run.started_at)}
                      </span>
                      <span className="min-w-[36px] text-right font-mono text-[11px] text-muted/28">
                        {runDuration(run)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => handleDelete(selectedJob)}
              className="text-xs text-failure/60 hover:text-failure"
            >
              Delete job
            </button>
          </div>
        )}
      </div>

      {editingJob !== null && (
        <JobEditorDrawer
          job={editingJob === 'new' ? null : editingJob}
          onClose={() => setEditingJob(null)}
          onSave={refresh}
        />
      )}
    </div>
  )
}
