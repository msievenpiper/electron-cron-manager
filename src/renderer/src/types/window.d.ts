import { Job, Run, RunStats, CreateJobInput, UpdateJobInput } from '../../../shared/types'

interface CronManagerAPI {
  jobs: {
    list: () => Promise<Job[]>
    create: (input: CreateJobInput) => Promise<Job>
    update: (id: string, input: UpdateJobInput) => Promise<Job>
    delete: (id: string) => Promise<void>
    runNow: (id: string) => Promise<void>
    kill: (id: string) => Promise<void>
  }
  runs: {
    list: () => Promise<Run[]>
    listByJob: (jobId: string) => Promise<Run[]>
    stats: (window: '24h' | '7d' | '30d') => Promise<RunStats>
  }
  settings: {
    get: (key: string) => Promise<string | undefined>
    set: (key: string, value: string) => Promise<void>
  }
  on: {
    jobStarted: (cb: (jobId: string) => void) => (() => void)
    jobFinished: (cb: (jobId: string) => void) => (() => void)
  }
}

declare global {
  interface Window {
    cronManager: CronManagerAPI
  }
}

export {}
