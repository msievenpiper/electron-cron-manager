import { describe, it, expect } from 'vitest'
import { executeJob, executeJobWithHandle } from './executor'

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
