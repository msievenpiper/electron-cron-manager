import { app, BrowserWindow, Tray, nativeImage, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createDatabase } from './db/database'
import { JobRepository } from './db/jobs'
import { SchedulerEngine } from './scheduler'
import { registerIpcHandlers } from './ipc-handlers'

function trayIconPath(filename: string): string {
  return app.isPackaged
    ? join(process.resourcesPath, filename)
    : join(__dirname, '../../resources', filename)
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

const db = createDatabase(join(app.getPath('userData'), 'cron-manager.db'))
const jobRepo = new JobRepository(db)
const scheduler = new SchedulerEngine({
  onJobStart: () => {},
  onJobFinish: () => {},
})

function updateTrayMenu(): void {
  if (!tray) return
  const running = scheduler.getRunningJobIds()

  // Swap tray icon: template image (idle) vs electric blue (jobs running)
  const iconFile = running.length > 0 ? 'tray-icon-active.png' : 'tray-icon.png'
  const icon = nativeImage.createFromPath(trayIconPath(iconFile))
  if (running.length === 0) icon.setTemplateImage(true)
  tray.setImage(icon)

  const runningLabel = running.length > 0 ? `${running.length} job(s) running` : 'No jobs running'
  const menu = Menu.buildFromTemplate([
    { label: runningLabel, enabled: false },
    { type: 'separator' },
    { label: 'Open Cron Manager', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.exit(0) } },
  ])
  tray.setContextMenu(menu)
}

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

  // Tray setup
  const initialIcon = nativeImage.createFromPath(trayIconPath('tray-icon.png'))
  initialIcon.setTemplateImage(true)
  tray = new Tray(initialIcon)
  tray.setToolTip('Cron Manager')
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow?.show()
      mainWindow?.focus()
    }
  })
  updateTrayMenu()

  registerIpcHandlers(db, scheduler, () => mainWindow, updateTrayMenu)
  scheduler.start(jobRepo.findAll())
  app.setLoginItemSettings({ openAtLogin: true })
})

app.on('window-all-closed', () => {
  // Keep running in tray — do not quit
})
