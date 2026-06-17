// ─────────────────────────────────────────────────────────────────────────────
// PATCH para seu electron/main.js (ou main.ts)
// Aplique estas alterações no arquivo principal do processo Electron
// ─────────────────────────────────────────────────────────────────────────────

const { app, BrowserWindow, ipcMain } = require('electron')

// 1. Na criação da BrowserWindow, adicione frame: false
const mainWindow = new BrowserWindow({
  width: 1280,
  height: 800,
  frame: false,           // ← ADICIONAR: remove barra nativa (File/Edit/View/...)
  titleBarStyle: 'hidden',// ← ADICIONAR
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
  },
  // ... mantenha o resto das suas opções ...
})

// 2. Adicione os handlers IPC para os botões da titlebar customizada
ipcMain.handle('window-minimize', () => {
  mainWindow.minimize()
})

ipcMain.handle('window-maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow.maximize()
  }
})

ipcMain.handle('window-close', () => {
  mainWindow.close()
})
