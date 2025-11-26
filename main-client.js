// main-client.js - Versión CLIENTE (solo frontend)
import { app, BrowserWindow } from "electron";
import path from "path";
import fs from "fs";
import os from "os";

let mainWindow;

// 📁 RUTA para guardar logs
const userDataPath = path.join(os.homedir(), "AppData", "Roaming", "MariamPOS-Client");
if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });

const logPath = path.join(userDataPath, "mariam-pos-client-log.txt");

// ✍️ Función para escribir logs
const log = (msg) => {
  const timestamp = `[${new Date().toISOString()}]`;
  fs.appendFileSync(logPath, `${timestamp} ${msg}\n`);
  console.log(msg);
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join("assets", "icon.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true, // Importante para conexiones HTTP a servidor
    },
    title: "MariamPOS - Cliente",
  });

  // Cargar el frontend desde los recursos
  const frontPath = path.join(
    process.resourcesPath || ".",
    "mariam-pos-front",
    "dist",
    "index.html"
  );

  log(`🖥️ Modo CLIENTE - Cargando frontend desde: ${frontPath}`);
  
  mainWindow.loadFile(frontPath).catch((err) => {
    log(`❌ Error cargando frontend: ${err.message}`);
    // Mostrar mensaje de error al usuario
    mainWindow.webContents.once("did-finish-load", () => {
      mainWindow.webContents.executeJavaScript(`
        document.body.innerHTML = '<div style="padding: 50px; text-align: center; font-family: Arial;">
          <h1>❌ Error al cargar la aplicación</h1>
          <p>No se pudo cargar el frontend desde: ${frontPath}</p>
          <p>Verifica que los archivos estén correctamente instalados.</p>
        </div>';
      `);
    });
  });

  // Abrir DevTools en desarrollo (opcional, comentar en producción)
  // mainWindow.webContents.openDevTools();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Log cuando la ventana esté lista
  mainWindow.webContents.once("did-finish-load", () => {
    log("✅ Frontend cargado correctamente");
    log("💻 Modo CLIENTE activo - Conectándose al servidor remoto");
  });
}

// 🧠 Manejo global de errores
process.on("uncaughtException", (err) => {
  log(`💥 Uncaught Exception: ${err.stack || err}`);
});

process.on("unhandledRejection", (reason) => {
  log(`⚠️ Unhandled Rejection: ${reason}`);
});

app.whenReady().then(() => {
  log("🚀 Iniciando MariamPOS Cliente...");
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Log de inicio
log("==========================================");
log("MariamPOS CLIENTE iniciado");
log(`Versión: ${app.getVersion()}`);
log(`Sistema: ${process.platform} ${process.arch}`);
log("==========================================");

