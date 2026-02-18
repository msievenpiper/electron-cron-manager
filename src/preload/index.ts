import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'

contextBridge.exposeInMainWorld('cronManager', {
  jobs: {
    list: () => ipcRenderer.invoke(IPC.JOBS_LIST),
    create: (input: unknown) => ipcRenderer.invoke(IPC.JOBS_CREATE, input),
    update: (id: string, input: unknown) => ipcRenderer.invoke(IPC.JOBS_UPDATE, id, input),
    delete: (id: string) => ipcRenderer.invoke(IPC.JOBS_DELETE, id),
    runNow: (id: string) => ipcRenderer.invoke(IPC.JOBS_RUN_NOW, id),
    kill: (id: string) => ipcRenderer.invoke(IPC.JOBS_KILL, id),
  },
  runs: {
    list: () => ipcRenderer.invoke(IPC.RUNS_LIST),
    listByJob: (jobId: string) => ipcRenderer.invoke(IPC.RUNS_LIST_BY_JOB, jobId),
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke(IPC.SETTINGS_GET, key),
    set: (key: string, value: string) => ipcRenderer.invoke(IPC.SETTINGS_SET, key, value),
  },
  on: {
    jobStarted: (cb: (jobId: string) => void) => {
      ipcRenderer.on(IPC.JOB_STARTED, (_e, jobId) => cb(jobId))
    },
    jobFinished: (cb: (jobId: string) => void) => {
      ipcRenderer.on(IPC.JOB_FINISHED, (_e, jobId) => cb(jobId))
    },
  },
})
