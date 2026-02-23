import { describe, it, expect } from 'vitest'
import { executeJob, executeJobWithHandle, resolveJobEnv } from './executor'

describe('executeJob', () => {
  it('captures stdout from a successful command', async () => {
    const result = await executeJob({ interpreter: 'bash', command: 'echo hello' })
    expect(result.stdout.trim()).toBe('hello')
    expect(result.exit_code).toBe(0)
    expect(result.status).toBe('success')
  })

  it('captures stderr and marks failure on non-zero exit', async () => {
    const result = await executeJob({ interpreter: 'bash', command: 'echo err >&2; exit 1' })
    expect(result.stderr.trim()).toBe('err')
    expect(result.exit_code).toBe(1)
    expect(result.status).toBe('failure')
  })

  it('returns kill handle that terminates process', async () => {
    const { promise, kill } = executeJobWithHandle({ interpreter: 'bash', command: 'sleep 10' })
    kill()
    const result = await promise
    expect(result.status).toBe('killed')
  })
})

describe('resolveJobEnv', () => {
  it('returns process.env when source_shell_config is false', async () => {
    const env = await resolveJobEnv(false)
    expect(env).toBe(process.env)
  })

  it('returns an env object with PATH when source_shell_config is true', async () => {
    const env = await resolveJobEnv(true)
    expect(typeof env).toBe('object')
    expect(env['PATH']).toBeTruthy()
  })
})

describe('executeJob with custom env', () => {
  it('uses provided env vars in the command', async () => {
    const env = { ...process.env, CRON_TEST_VAR: 'hello_from_env' }
    const result = await executeJob({ interpreter: 'bash', command: 'echo $CRON_TEST_VAR', env })
    expect(result.stdout.trim()).toBe('hello_from_env')
    expect(result.status).toBe('success')
  })
})
