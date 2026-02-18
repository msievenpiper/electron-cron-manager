import { useState, useEffect, useCallback } from 'react'
import { Job } from '../../../shared/types'

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    const list = await window.cronManager.jobs.list()
    setJobs(list)
  }, [])

  useEffect(() => {
    refresh()
    window.cronManager.on.jobStarted((jobId) => {
      setRunningIds(prev => new Set([...prev, jobId]))
      refresh()
    })
    window.cronManager.on.jobFinished((jobId) => {
      setRunningIds(prev => {
        const s = new Set(prev)
        s.delete(jobId)
        return s
      })
      refresh()
    })
  }, [refresh])

  return { jobs, runningIds, refresh }
}
