import { ipcMain, BrowserWindow, Notification } from 'electron'
import { IPC } from '../shared/ipc-channels'
import { JobRepository } from './db/jobs'
import { RunRepository } from './db/runs'
import { SchedulerEngine } from './scheduler'
import { ExecuteResult } from './executor'
import Database from 'better-sqlite3'

const ALLOWED_INTERPRETERS = ['bash', 'sh', 'zsh', 'node', 'python3', 'ruby'] as const

function validateJobInput(input: any): void {
  if (input.interpreter && !ALLOWED_INTERPRETERS.includes(input.interpreter)) {
    throw new Error(`Invalid interpreter: ${input.interpreter}`)
  }
}

export function registerIpcHandlers(
  db: Database.Database,
  scheduler: SchedulerEngine,
  getWindow: () => BrowserWindow | null,
  onStatusChange?: () => void
): void {
  const jobRepo = new JobRepository(db)
  const runRepo = new RunRepository(db)

  const maxRunsPerJob = (): number => {
    const row = db.prepare("SELECT value FROM settings WHERE key='max_runs_per_job'").get() as any
    return parseInt(row?.value ?? '100', 10)
  }

  const activeRunIds = new Map<string, string>() // jobId → DB run id

  const origCallbacks = {
    onJobStart: (jobId: string, _runId: string) => {
      const run = runRepo.start(jobId)
      activeRunIds.set(jobId, run.id)
      getWindow()?.webContents.send(IPC.JOB_STARTED, jobId)
      onStatusChange?.()
    },
    onJobFinish: (jobId: string, _runId: string, result: ExecuteResult) => {
      const runId = activeRunIds.get(jobId)
      activeRunIds.delete(jobId)
      if (runId) {
        runRepo.finish(runId, result)
        runRepo.prune(jobId, maxRunsPerJob())
        const job = jobRepo.findById(jobId)
        if (job && (job.notify === 'all' || (job.notify === 'failure' && result.status === 'failure'))) {
          new Notification({ title: job.name, body: `${result.status} (exit ${result.exit_code})` }).show()
        }
      }
      getWindow()?.webContents.send(IPC.JOB_FINISHED, jobId)
      onStatusChange?.()
    },
  }

  // Wire scheduler callbacks via public setCallbacks method
  scheduler.setCallbacks(origCallbacks)

  ipcMain.handle(IPC.JOBS_LIST, () => jobRepo.findAll())
  ipcMain.handle(IPC.JOBS_CREATE, (_e, input) => {
    validateJobInput(input)
    const job = jobRepo.create(input)
    scheduler.addJob(job)
    return job
  })
  ipcMain.handle(IPC.JOBS_UPDATE, (_e, id, input) => {
    validateJobInput(input)
    const job = jobRepo.update(id, input)
    // addJob handles both enable and disable: removes old schedule, reschedules only if enabled
    if (job) scheduler.addJob(job)
    return job
  })
  ipcMain.handle(IPC.JOBS_DELETE, (_e, id) => {
    scheduler.removeJob(id)
    jobRepo.delete(id)
  })
  ipcMain.handle(IPC.JOBS_RUN_NOW, (_e, id) => {
    const job = jobRepo.findById(id)
    if (job) scheduler.runNow(job)
  })
  ipcMain.handle(IPC.JOBS_KILL, (_e, id) => scheduler.killJob(id))
  ipcMain.handle(IPC.RUNS_LIST, () => runRepo.findAll())
  ipcMain.handle(IPC.RUNS_LIST_BY_JOB, (_e, jobId) => runRepo.findByJobId(jobId))
  ipcMain.handle(IPC.RUNS_STATS, (_e, window: '24h' | '7d' | '30d') => {
    const ms: Record<string, number> = {
      '24h': 24 * 60 * 60 * 1000,
      '7d':  7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    }
    return runRepo.getStats(ms[window] ?? ms['24h'])
  })
  ipcMain.handle(IPC.SETTINGS_GET, (_e, key) => {
    return (db.prepare('SELECT value FROM settings WHERE key=?').get(key) as any)?.value
  })
  ipcMain.handle(IPC.SETTINGS_SET, (_e, key, value) => {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
  })
}
