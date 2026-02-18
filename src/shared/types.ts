export type Interpreter = 'bash' | 'sh' | 'node' | 'python3' | 'ruby' | 'zsh'
export type NotifySetting = 'all' | 'failure' | 'none'

export interface Job {
  id: string
  name: string
  cron: string
  interpreter: Interpreter
  command: string
  enabled: boolean
  notify: NotifySetting
  created_at: number
  updated_at: number
}

export type RunStatus = 'running' | 'success' | 'failure' | 'killed'

export interface Run {
  id: string
  job_id: string
  started_at: number
  ended_at: number | null
  exit_code: number | null
  stdout: string | null
  stderr: string | null
  status: RunStatus
}

export interface CreateJobInput {
  name: string
  cron: string
  interpreter: Interpreter
  command: string
  enabled?: boolean
  notify?: NotifySetting
}

export interface UpdateJobInput extends Partial<CreateJobInput> {}
