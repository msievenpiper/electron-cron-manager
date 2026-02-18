import { app, BrowserWindow, Tray, nativeImage, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createDatabase } from './db/database'
import { JobRepository } from './db/jobs'
import { SchedulerEngine } from './scheduler'
import { registerIpcHandlers } from './ipc-handlers'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

const db = createDatabase(join(app.getPath('userData'), 'cron-manager.db'))
const jobRepo = new JobRepository(db)
const scheduler = new SchedulerEngine({
  onJobStart: () => {},
  onJobFinish: () => {},
})

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (e) => {
    e.preventDefault()
    mainWindow?.hide()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.cronmanager')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()
  registerIpcHandlers(db, scheduler, () => mainWindow)
  scheduler.start(jobRepo.findAll())
  app.setLoginItemSettings({ openAtLogin: true })
})

app.on('window-all-closed', () => {
  // Keep running in tray — do not quit
})
