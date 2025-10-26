import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: { contextIsolation: true },
  });

  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  win.webContents.openDevTools(); // 👈 abre las DevTools
}

app.whenReady().then(createWindow);