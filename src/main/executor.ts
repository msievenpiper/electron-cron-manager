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

export async function resolveJobEnv(sourceShellConfig: boolean): Promise<NodeJS.ProcessEnv> {
  if (!sourceShellConfig) return process.env

  const shell = process.env.SHELL || '/bin/zsh'

  return new Promise((resolve) => {
    const proc = spawn(shell, ['-l', '-c', 'env'], { env: process.env })
    let output = ''

    proc.stdout.on('data', (d: Buffer) => { output += d.toString() })
    proc.on('close', () => {
      const env: NodeJS.ProcessEnv = {}
      for (const line of output.split('\n')) {
        const eq = line.indexOf('=')
        if (eq > 0) {
          env[line.slice(0, eq)] = line.slice(eq + 1)
        }
      }
      resolve(Object.keys(env).length > 0 ? env : process.env)
    })
    proc.on('error', () => resolve(process.env))
  })
}

export function executeJobWithHandle(opts: { interpreter: string; command: string; env?: NodeJS.ProcessEnv }): ExecuteHandle {
  let killed = false
  const proc = spawn(opts.interpreter, ['-c', opts.command], { env: opts.env ?? process.env })

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

export async function executeJob(opts: { interpreter: string; command: string; env?: NodeJS.ProcessEnv }): Promise<ExecuteResult> {
  return executeJobWithHandle(opts).promise
}
