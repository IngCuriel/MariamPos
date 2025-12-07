// main.js
import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import fs from "fs";
import os from "os";
import { spawn, exec } from "child_process";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Obtener __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow;
let backendProcess;
let isQuitting = false;

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
  // Obtener la ruta del preload.js (funciona tanto en desarrollo como en producción)
  // En producción, app.getAppPath() devuelve la ruta de la aplicación empaquetada
  // En desarrollo, __dirname funciona correctamente
  const appPath = app.isPackaged ? app.getAppPath() : __dirname;
  const preloadPath = path.join(appPath, "preload.js");
  
  log(`📄 Ruta de preload: ${preloadPath}`);
  
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join("assets","icon.ico"), // 👈 Aquí tu icono
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath, // Script de preload para IPC
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

// ============================================================
// 🧹 FUNCIÓN PARA LIMPIAR PROCESOS HUÉRFANOS EN EL PUERTO 3001
// ============================================================
const killProcessOnPort = (port) => {
  return new Promise((resolve) => {
    if (process.platform === "win32") {
      // Windows: usar netstat y taskkill
      exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
        if (error || !stdout) {
          log(`✅ Puerto ${port} está libre`);
          resolve();
          return;
        }

        // Extraer PIDs de la salida de netstat
        const lines = stdout.trim().split("\n");
        const pids = new Set();
        
        lines.forEach((line) => {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && !isNaN(pid)) {
            pids.add(pid);
          }
        });

        if (pids.size === 0) {
          log(`✅ Puerto ${port} está libre`);
          resolve();
          return;
        }

        log(`🔍 Encontrados ${pids.size} proceso(s) usando el puerto ${port}`);
        
        // Matar cada proceso encontrado
        const killPromises = Array.from(pids).map((pid) => {
          return new Promise((resolveKill) => {
            exec(`taskkill /F /PID ${pid}`, (killError) => {
              if (killError) {
                log(`⚠️ No se pudo matar proceso ${pid}: ${killError.message}`);
              } else {
                log(`✅ Proceso ${pid} terminado`);
              }
              resolveKill();
            });
          });
        });

        Promise.all(killPromises).then(() => {
          log(`✅ Limpieza de puerto ${port} completada`);
          resolve();
        });
      });
    } else {
      // Linux/Mac: usar lsof y kill
      exec(`lsof -ti:${port}`, (error, stdout) => {
        if (error || !stdout) {
          log(`✅ Puerto ${port} está libre`);
          resolve();
          return;
        }

        const pids = stdout.trim().split("\n").filter(Boolean);
        log(`🔍 Encontrados ${pids.length} proceso(s) usando el puerto ${port}`);

        const killPromises = pids.map((pid) => {
          return new Promise((resolveKill) => {
            exec(`kill -9 ${pid}`, (killError) => {
              if (killError) {
                log(`⚠️ No se pudo matar proceso ${pid}: ${killError.message}`);
              } else {
                log(`✅ Proceso ${pid} terminado`);
              }
              resolveKill();
            });
          });
        });

        Promise.all(killPromises).then(() => {
          log(`✅ Limpieza de puerto ${port} completada`);
          resolve();
        });
      });
    }
  });
};

app.whenReady().then(async () => {
  try {
    // Limpiar procesos huérfanos en el puerto 3001 antes de iniciar
    log("🧹 Verificando y limpiando procesos en puerto 3001...");
    await killProcessOnPort(3001);
    
    // Esperar un momento para asegurar que el puerto se libere
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const backendPath = path.join(process.resourcesPath || ".", "mariam-pos-backend", "src", "index.mjs");
    log(`🚀 Iniciando backend desde: ${backendPath}`);

    // Configurar spawn con detached: false para asegurar que se cierre con el padre
    backendProcess = spawn("node", [backendPath], {
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
      detached: false, // Importante: asegura que el proceso se cierre con el padre
    });

    backendProcess.stdout.on("data", (data) => log(`📘 BACKEND: ${data}`));
    backendProcess.stderr.on("data", (data) => log(`❌ BACKEND ERROR: ${data}`));
    backendProcess.on("close", (code) => {
      log(`⚙️ Backend cerrado con código: ${code}`);
      backendProcess = null;
    });
    
    backendProcess.on("error", (error) => {
      log(`❌ Error en proceso backend: ${error.message}`);
      backendProcess = null;
    });

    // Guardar el PID del proceso para poder matarlo si es necesario
    if (backendProcess.pid) {
      log(`📌 Backend iniciado con PID: ${backendProcess.pid}`);
    }

    createWindow();
  } catch (err) {
    log(`❌ Error al iniciar backend o ventana: ${err.message}`);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// ============================================================
// 🚪 MANEJO DE CIERRE DE APLICACIÓN CON RECORDATORIO DE TURNO
// ============================================================

// Interceptar el evento de cierre para preguntar sobre el turno
app.on("before-quit", async (event) => {
  if (!mainWindow) return;
  
  // Verificar si hay turnos abiertos antes de cerrar
  try {
    // Enviar mensaje al renderer para verificar turnos abiertos
    const hasOpenShifts = await new Promise((resolve) => {
      mainWindow.webContents.send("check-open-shifts");
      
      // Esperar respuesta del renderer
      ipcMain.once("open-shifts-response", (event, hasShifts) => {
        resolve(hasShifts);
      });
      
      // Timeout de seguridad (5 segundos)
      setTimeout(() => resolve(false), 5000);
    });

    if (hasOpenShifts) {
      // Cancelar el cierre y dejar que el renderer maneje el diálogo
      event.preventDefault();
      mainWindow.webContents.send("show-shift-reminder-on-close");
    }
  } catch (error) {
    log(`⚠️ Error al verificar turnos abiertos: ${error.message}`);
    // Si hay error, permitir el cierre normal
  }
});

// Función para cerrar el proceso backend de forma segura
const killBackendProcess = async () => {
  if (!backendProcess) {
    // Si no hay proceso registrado, intentar limpiar el puerto directamente
    log("🛑 No hay proceso backend registrado, limpiando puerto 3001...");
    await killProcessOnPort(3001);
    return;
  }

  try {
    const pid = backendProcess.pid;
    log(`🛑 Cerrando proceso backend (PID: ${pid})...`);
    
    // En Windows, usar taskkill para asegurar que se cierre completamente
    if (process.platform === "win32") {
      // Primero intentar cerrar suavemente
      backendProcess.kill();
      
      // Si tiene PID, usar taskkill como respaldo
      if (pid) {
        setTimeout(() => {
          // Verificar si el proceso aún existe usando tasklist
          exec(`tasklist /FI "PID eq ${pid}" /NH`, (error, stdout) => {
            // En Windows, si el proceso existe, tasklist devuelve una línea con el PID
            // Si no existe, devuelve "INFO: No tasks are running which match the specified criteria."
            const processStillRunning = !error && stdout && 
              !stdout.includes("No tasks") && 
              !stdout.includes("INFO:") &&
              stdout.trim().length > 0;
            
            if (processStillRunning) {
              log(`⚠️ Proceso ${pid} aún activo, forzando cierre con taskkill...`);
              exec(`taskkill /F /PID ${pid} /T`, (killError) => {
                if (killError) {
                  log(`⚠️ Error al forzar cierre: ${killError.message}`);
                  // Como último recurso, limpiar el puerto
                  killProcessOnPort(3001).then(() => {
                    backendProcess = null;
                  });
                } else {
                  log(`✅ Proceso ${pid} y sus procesos hijos terminados forzosamente`);
                  backendProcess = null;
                }
              });
            } else {
              log(`✅ Proceso ${pid} cerrado correctamente`);
              backendProcess = null;
            }
          });
        }, 2000);
      } else {
        // Si no hay PID, limpiar el puerto directamente
        await killProcessOnPort(3001);
        backendProcess = null;
      }
    } else {
      // Linux/Mac: usar señales SIGTERM y luego SIGKILL
      backendProcess.kill("SIGTERM");
      
      setTimeout(() => {
        if (backendProcess && !backendProcess.killed && pid) {
          log("⚠️ Forzando cierre del proceso backend con SIGKILL...");
          try {
            backendProcess.kill("SIGKILL");
            // También intentar matar por PID directamente
            exec(`kill -9 ${pid}`, () => {});
          } catch (error) {
            log(`⚠️ Error al forzar cierre: ${error.message}`);
          }
        }
        backendProcess = null;
      }, 3000);
    }
  } catch (error) {
    log(`❌ Error al cerrar proceso backend: ${error.message}`);
    // Como último recurso, limpiar el puerto directamente
    await killProcessOnPort(3001);
    backendProcess = null;
  }
};

// Manejar decisión del usuario sobre cerrar la aplicación
ipcMain.on("app-close-decision", async (event, shouldClose) => {
  if (shouldClose) {
    isQuitting = true;
    await killBackendProcess();
    // Esperar un momento para asegurar que el proceso se cierre
    setTimeout(() => {
      app.quit();
    }, 500);
  }
});

app.on("window-all-closed", async () => {
  if (!isQuitting) {
    isQuitting = true;
    await killBackendProcess();
    // Esperar un momento antes de cerrar
    setTimeout(() => {
      if (process.platform !== "darwin") app.quit();
    }, 500);
  }
});

// Manejar cierre de la aplicación - este es el último evento antes de cerrar
app.on("will-quit", async (event) => {
  if (!isQuitting) {
    isQuitting = true;
    // Prevenir el cierre hasta que terminemos el backend
    event.preventDefault();
    await killBackendProcess();
    // Esperar un momento y luego cerrar
    setTimeout(() => {
      app.quit();
    }, 1000);
  }
});

// Manejar cierre forzado (Ctrl+C, etc.)
process.on("SIGINT", async () => {
  if (!isQuitting) {
    isQuitting = true;
    await killBackendProcess();
    setTimeout(() => {
      app.quit();
    }, 500);
  }
});

process.on("SIGTERM", async () => {
  if (!isQuitting) {
    isQuitting = true;
    await killBackendProcess();
    setTimeout(() => {
      app.quit();
    }, 500);
  }
});