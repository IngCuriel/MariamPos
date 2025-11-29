import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: { 
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.mjs')
    },
  });

  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  win.webContents.openDevTools(); // 👈 abre las DevTools
}

// Handler para abrir URLs en el navegador del sistema
ipcMain.handle('open-external-url', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Error al abrir URL externa:', error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(createWindow);