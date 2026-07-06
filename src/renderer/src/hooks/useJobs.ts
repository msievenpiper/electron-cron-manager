import { useState, useEffect, useCallback } from 'react'
import { Job } from '../../../shared/types'

export function useJobs(): { jobs: Job[]; runningIds: Set<string>; refresh: () => Promise<void> } {
  const [jobs, setJobs] = useState<Job[]>([])
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set())

  const refresh = useCallback(async (): Promise<void> => {
    const list = await window.cronManager.jobs.list()
    setJobs(list)
  }, [])

  useEffect(() => {
    // Initial load on mount, in addition to the live event subscription below.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
    const cleanupStarted = window.cronManager.on.jobStarted((jobId) => {
      setRunningIds((prev) => new Set([...prev, jobId]))
      refresh()
    })
    const cleanupFinished = window.cronManager.on.jobFinished((jobId) => {
      setRunningIds((prev) => {
        const s = new Set(prev)
        s.delete(jobId)
        return s
      })
      refresh()
    })
    return () => {
      cleanupStarted()
      cleanupFinished()
    }
  }, [refresh])

  return { jobs, runningIds, refresh }
}
