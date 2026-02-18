import { ipcMain, BrowserWindow, Notification } from 'electron'
import { IPC } from '../shared/ipc-channels'
import { JobRepository } from './db/jobs'
import { RunRepository } from './db/runs'
import { SchedulerEngine } from './scheduler'
import { ExecuteResult } from './executor'
import Database from 'better-sqlite3'

export function registerIpcHandlers(
  db: Database.Database,
  scheduler: SchedulerEngine,
  getWindow: () => BrowserWindow | null
): void {
  const jobRepo = new JobRepository(db)
  const runRepo = new RunRepository(db)

  const maxRunsPerJob = (): number => {
    const row = db.prepare("SELECT value FROM settings WHERE key='max_runs_per_job'").get() as any
    return parseInt(row?.value ?? '100', 10)
  }

  // Wire scheduler callbacks via public setCallbacks method
  scheduler.setCallbacks({
    onJobStart: (jobId: string, _runId: string) => {
      runRepo.start(jobId)
      getWindow()?.webContents.send(IPC.JOB_STARTED, jobId)
    },
    onJobFinish: (jobId: string, _runId: string, result: ExecuteResult) => {
      const activeRun = runRepo.findByJobId(jobId, 1).find(r => r.status === 'running')
      if (activeRun) {
        runRepo.finish(activeRun.id, result)
        runRepo.prune(jobId, maxRunsPerJob())
        const job = jobRepo.findById(jobId)
        if (job && (job.notify === 'all' || (job.notify === 'failure' && result.status === 'failure'))) {
          new Notification({ title: job.name, body: `${result.status} (exit ${result.exit_code})` }).show()
        }
      }
      getWindow()?.webContents.send(IPC.JOB_FINISHED, jobId)
    },
  })

  ipcMain.handle(IPC.JOBS_LIST, () => jobRepo.findAll())
  ipcMain.handle(IPC.JOBS_CREATE, (_e, input) => {
    const job = jobRepo.create(input)
    scheduler.addJob(job)
    return job
  })
  ipcMain.handle(IPC.JOBS_UPDATE, (_e, id, input) => {
    const job = jobRepo.update(id, input)
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
  ipcMain.handle(IPC.SETTINGS_GET, (_e, key) => {
    return (db.prepare('SELECT value FROM settings WHERE key=?').get(key) as any)?.value
  })
  ipcMain.handle(IPC.SETTINGS_SET, (_e, key, value) => {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
  })
}
