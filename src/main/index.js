import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { registerIpcHandlers, setMainWindow } from './ipc-handlers.js'
import { destroyAll } from './audio-engine.js'

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 600,
    resizable: true,
    minWidth: 420,
    minHeight: 500,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  setMainWindow(mainWindow)

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  destroyAll()
  app.quit()
})
