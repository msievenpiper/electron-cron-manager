import { spawn } from 'child_process'
import { RunStatus } from '../shared/types'

export interface ExecuteResult {
  stdout: string
  stderr: string
  exit_code: number
  status: RunStatus
}

export interface ExecuteHandle {
  promise: Promise<ExecuteResult>
  kill: () => void
}

export function executeJobWithHandle(opts: { interpreter: string; command: string }): ExecuteHandle {
  let killed = false
  const proc = spawn(opts.interpreter, ['-c', opts.command], { env: process.env })

  let stdout = ''
  let stderr = ''

  proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
  proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

  const promise = new Promise<ExecuteResult>((resolve) => {
    proc.on('close', (code) => {
      if (killed) {
        resolve({ stdout, stderr, exit_code: code ?? -1, status: 'killed' })
      } else {
        resolve({ stdout, stderr, exit_code: code ?? -1, status: code === 0 ? 'success' : 'failure' })
      }
    })
  })

  return {
    promise,
    kill: () => {
      killed = true
      proc.kill('SIGTERM')
    },
  }
}

export async function executeJob(opts: { interpreter: string; command: string }): Promise<ExecuteResult> {
  return executeJobWithHandle(opts).promise
}
