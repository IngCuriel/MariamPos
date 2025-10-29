// main.js
import { app, BrowserWindow } from "electron";
import path from "path";
import fs from "fs";
import os from "os";
import { spawn } from "child_process";

let mainWindow;
let backendProcess;

// 📁 RUTA para guardar logs y base de datos
const userDataPath = path.join(os.homedir(), "AppData", "Roaming", "MariamPOS");
if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });

const logPath = path.join(userDataPath, "mariam-pos-log.txt");

// ✍️ Función para escribir logs
const log = (msg) => {
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  console.log(msg);
};

// 🚀 Copiar base de datos si no existe
const dbPath = path.join(userDataPath, "database.db");
if (!fs.existsSync(dbPath)) {
  try {
    const sourceDb = path.join(process.resourcesPath || ".", "mariam-pos-backend", "prisma", "database.db");
    fs.copyFileSync(sourceDb, dbPath);
    log("✅ Base de datos copiada correctamente a AppData/Roaming.");
  } catch (err) {
    log(`❌ Error copiando la base de datos: ${err.message}`);
  }
}

process.env.DATABASE_URL = `file:${dbPath}`;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join("assets","icon.ico"), // 👈 Aquí tu icono
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const frontPath = path.join(process.resourcesPath || ".", "mariam-pos-front", "dist", "index.html");

  log(`🖥️ Cargando frontend desde: ${frontPath}`);
  mainWindow.loadFile(frontPath).catch((err) => log(`❌ Error cargando frontend: ${err.message}`));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// 🧠 Manejo global de errores
process.on("uncaughtException", (err) => log(`💥 Uncaught Exception: ${err.stack || err}`));
process.on("unhandledRejection", (reason) => log(`⚠️ Unhandled Rejection: ${reason}`));

app.whenReady().then(() => {
  try {
    const backendPath = path.join(process.resourcesPath || ".", "mariam-pos-backend", "src", "index.mjs");
    log(`🚀 Iniciando backend desde: ${backendPath}`);

    backendProcess = spawn("node", [backendPath], {
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    backendProcess.stdout.on("data", (data) => log(`📘 BACKEND: ${data}`));
    backendProcess.stderr.on("data", (data) => log(`❌ BACKEND ERROR: ${data}`));
    backendProcess.on("close", (code) => log(`⚙️ Backend cerrado con código: ${code}`));

    createWindow();
  } catch (err) {
    log(`❌ Error al iniciar backend o ventana: ${err.message}`);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== "darwin") app.quit();
});