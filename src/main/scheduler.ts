import cron from 'node-cron'
import { Job } from '../shared/types'
import { executeJobWithHandle, ExecuteResult } from './executor'

interface SchedulerCallbacks {
  onJobStart: (jobId: string, runId: string) => void
  onJobFinish: (jobId: string, runId: string, result: ExecuteResult) => void
}

interface ActiveRun {
  runId: string
  kill: () => void
}

export class SchedulerEngine {
  private tasks = new Map<string, ReturnType<typeof cron.schedule>>()
  private activeRuns = new Map<string, ActiveRun>()
  private callbacks: SchedulerCallbacks

  constructor(callbacks: SchedulerCallbacks) {
    this.callbacks = callbacks
  }

  start(jobs: Job[]): void {
    for (const job of jobs) {
      if (job.enabled) this.scheduleJob(job)
    }
  }

  stop(): void {
    for (const task of this.tasks.values()) task.stop()
    this.tasks.clear()
  }

  addJob(job: Job): void {
    this.removeJob(job.id)
    if (job.enabled) this.scheduleJob(job)
  }

  removeJob(jobId: string): void {
    this.tasks.get(jobId)?.stop()
    this.tasks.delete(jobId)
  }

  killJob(jobId: string): void {
    this.activeRuns.get(jobId)?.kill()
  }

  isRunning(jobId: string): boolean {
    return this.activeRuns.has(jobId)
  }

  getRunningJobIds(): string[] {
    return Array.from(this.activeRuns.keys())
  }

  async runNow(job: Job): Promise<ExecuteResult> {
    return this.executeJob(job)
  }

  private scheduleJob(job: Job): void {
    if (!cron.validate(job.cron)) return
    const task = cron.schedule(job.cron, () => this.executeJob(job))
    this.tasks.set(job.id, task)
  }

  private async executeJob(job: Job): Promise<ExecuteResult> {
    if (this.activeRuns.has(job.id)) {
      return { stdout: '', stderr: 'Already running', exit_code: -1, status: 'failure' }
    }

    const runId = `${job.id}-${Date.now()}`
    const { promise, kill } = executeJobWithHandle({ interpreter: job.interpreter, command: job.command })
    this.activeRuns.set(job.id, { runId, kill })
    this.callbacks.onJobStart(job.id, runId)

    const result = await promise
    this.activeRuns.delete(job.id)
    this.callbacks.onJobFinish(job.id, runId, result)
    return result
  }
}
