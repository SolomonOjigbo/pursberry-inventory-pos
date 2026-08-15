import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';

const DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    backgroundColor: '#f7f7f5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Non-negotiable for a till that renders remote-sourced product data:
      // no Node in the renderer, isolated context, sandboxed.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once('ready-to-show', () => window.show());

  // Anything trying to open a new window or navigate away goes to the system
  // browser instead — a till should never become a general-purpose browser.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (DEV_SERVER_URL) {
    void window.loadURL(DEV_SERVER_URL);
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    void window.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  return window;
}

// SYNC-101/102 land here: better-sqlite3 opens under app.getPath('userData'),
// and the renderer reaches it only through named IPC channels registered below.
// Keep the database in the main process — the renderer stays sandboxed.
ipcMain.handle('pursberry:app-info', () => ({
  version: app.getVersion(),
  userDataPath: app.getPath('userData'),
  online: true,
}));

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
