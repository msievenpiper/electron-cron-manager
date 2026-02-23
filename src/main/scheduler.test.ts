import { describe, it, expect, vi } from 'vitest'
import { SchedulerEngine } from './scheduler'

describe('SchedulerEngine', () => {
  it('starts and stops without error', () => {
    const engine = new SchedulerEngine({
      onJobStart: vi.fn(),
      onJobFinish: vi.fn(),
    })
    expect(() => engine.start([])).not.toThrow()
    expect(() => engine.stop()).not.toThrow()
  })

  it('tracks a running job via runNow and calls callbacks', async () => {
    const onStart = vi.fn()
    const onFinish = vi.fn()
    const engine = new SchedulerEngine({ onJobStart: onStart, onJobFinish: onFinish })

    await engine.runNow({ id: 'j1', interpreter: 'bash', command: 'echo hi', cron: '* * * * *', name: 'test', enabled: true, notify: 'none', source_shell_config: true, created_at: 0, updated_at: 0 })

    expect(onStart).toHaveBeenCalledWith('j1', expect.any(String))
    expect(onFinish).toHaveBeenCalled()
  })

  it('can kill a running job', async () => {
    const onFinish = vi.fn()
    const engine = new SchedulerEngine({ onJobStart: vi.fn(), onJobFinish: onFinish })

    const promise = engine.runNow({ id: 'j1', interpreter: 'bash', command: 'sleep 5', cron: '* * * * *', name: 'test', enabled: true, notify: 'none', source_shell_config: true, created_at: 0, updated_at: 0 })
    await new Promise(r => setTimeout(r, 100))
    engine.killJob('j1')
    const result = await promise
    expect(result.status).toBe('killed')
  })

  it('runs job with source_shell_config false without error', async () => {
    const onFinish = vi.fn()
    const engine = new SchedulerEngine({ onJobStart: vi.fn(), onJobFinish: onFinish })
    await engine.runNow({ id: 'j2', interpreter: 'bash', command: 'echo no-env', cron: '* * * * *', name: 'test', enabled: true, notify: 'none', source_shell_config: false, created_at: 0, updated_at: 0 })
    expect(onFinish).toHaveBeenCalledWith('j2', expect.any(String), expect.objectContaining({ status: 'success' }))
  })
})
