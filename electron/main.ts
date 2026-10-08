import { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { initDb } from './db/client'
import { registerContestHandlers } from './ipc/contests.ipc'
import { registerProfileHandlers } from './ipc/profile.ipc'
import { registerAnalysisHandlers } from './ipc/analysis.ipc'
import { registerResourceHandlers } from './ipc/resources.ipc'
import { registerNoteHandlers } from './ipc/notes.ipc'
import { registerSettingsHandlers } from './ipc/settings.ipc'
import { startScheduler } from './scheduler'
import { logger } from './utils/logger'

// ── Security: refuse any attempt to open external windows with elevated perms ─
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    // Block navigation away from our app URL in the main window
    if (!url.startsWith('file://') && !url.startsWith('http://localhost')) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  contents.setWindowOpenHandler(({ url }) => {
    // Open all links in system browser
    shell.openExternal(url)
    return { action: 'deny' }
  })
})

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,          // Custom titlebar
    titleBarStyle: 'hidden',
    backgroundColor: '#F4F2EC',
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // ── SECURITY: these two must never be flipped ──────────────────────────
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,      // needed for preload to use require
      webSecurity: true,
    }
  })

  // Graceful show: wait for content to be ready to avoid white flash
  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
    logger.info('Main window shown')
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Load the app
  if (process.env.ELECTRON_RENDERER_URL) {
    // Dev mode: Vite dev server
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    // Production: load built HTML
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTray(): void {
  try {
    const iconPath = join(__dirname, '../../build/tray-icon.png')
    const icon = nativeImage.createFromPath(iconPath)
    if (!icon.isEmpty()) {
      tray = new Tray(icon)
      const contextMenu = Menu.buildFromTemplate([
        { label: 'Open Coders Note', click: () => mainWindow?.show() },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
      ])
      tray.setToolTip('Coders Note')
      tray.setContextMenu(contextMenu)
      tray.on('double-click', () => mainWindow?.show())
    }
  } catch (err) {
    logger.warn(`Could not initialize tray: ${err}`)
  }
}

// ── IPC: window controls (custom titlebar) ────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.on('window:close', () => mainWindow?.close())

app.whenReady().then(async () => {
  logger.info(`Starting Coders Note v${app.getVersion()} on ${process.platform}`)

  // 1. Init database (runs migrations)
  await initDb()
  logger.info('Database initialised')

  // 2. Register all IPC handlers
  registerContestHandlers()
  registerProfileHandlers()
  registerAnalysisHandlers()
  registerResourceHandlers()
  registerNoteHandlers()
  registerSettingsHandlers()
  logger.info('IPC handlers registered')

  // 3. Start reminder scheduler
  startScheduler()
  logger.info('Scheduler started')

  // 4. Create window + tray
  createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // macOS: keep app in dock even when all windows closed
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  logger.info('App quitting, cleaning up...')
})
