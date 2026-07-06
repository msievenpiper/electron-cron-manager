import type { IpcRendererEvent } from 'electron'
import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'

contextBridge.exposeInMainWorld('cronManager', {
  jobs: {
    list: () => ipcRenderer.invoke(IPC.JOBS_LIST),
    create: (input: unknown) => ipcRenderer.invoke(IPC.JOBS_CREATE, input),
    update: (id: string, input: unknown) => ipcRenderer.invoke(IPC.JOBS_UPDATE, id, input),
    delete: (id: string) => ipcRenderer.invoke(IPC.JOBS_DELETE, id),
    runNow: (id: string) => ipcRenderer.invoke(IPC.JOBS_RUN_NOW, id),
    kill: (id: string) => ipcRenderer.invoke(IPC.JOBS_KILL, id)
  },
  runs: {
    list: () => ipcRenderer.invoke(IPC.RUNS_LIST),
    listByJob: (jobId: string) => ipcRenderer.invoke(IPC.RUNS_LIST_BY_JOB, jobId),
    stats: (window: '24h' | '7d' | '30d') => ipcRenderer.invoke(IPC.RUNS_STATS, window)
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke(IPC.SETTINGS_GET, key),
    set: (key: string, value: string) => ipcRenderer.invoke(IPC.SETTINGS_SET, key, value)
  },
  on: {
    jobStarted: (cb: (jobId: string) => void) => {
      const handler = (_e: IpcRendererEvent, jobId: string) => cb(jobId)
      ipcRenderer.on(IPC.JOB_STARTED, handler)
      return () => ipcRenderer.removeListener(IPC.JOB_STARTED, handler)
    },
    jobFinished: (cb: (jobId: string) => void) => {
      const handler = (_e: IpcRendererEvent, jobId: string) => cb(jobId)
      ipcRenderer.on(IPC.JOB_FINISHED, handler)
      return () => ipcRenderer.removeListener(IPC.JOB_FINISHED, handler)
    }
  }
})
