// mariam-pos-backend/src/index.mjs
import express from "express";
import { startSyncLoop } from './sync/syncService.mjs'
import cors from "cors";
import path from "path";
import fs from "fs";
import os from "os";
import prisma from "./utils/prisma.js";

// -------------------
// Configuración de SQLite para Electron
// -------------------

// Carpeta donde se almacenará la base de datos en producción
const userDataPath = path.join(os.homedir(), "AppData", "Roaming", "MariamPOS");
if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });

// Ruta final de la base de datos
const dbPath = path.join(userDataPath, "database.db");

// Copiar la base de datos por primera vez si no existe
if (!fs.existsSync(dbPath)) {
  const sourceDb = path.join(process.resourcesPath || ".","mariam-pos-backend", "prisma", "database.db");
  fs.copyFileSync(sourceDb, dbPath);
}

// Configurar Prisma para usar la base de datos correcta

//Descomentar el process.env.DATABASE an generar el exe
//process.env.DATABASE_URL = `file:${dbPath}`;

console.log('process.env.DATABASE_URL', process.env.DATABASE_URL);

// -------------------
// Configuración del servidor
// -------------------
const app = express();
app.use(cors());
app.use(express.json());

// Rutas
import categoriesRouter from "./routes/categories.js"; 
import clientsRouter from "./routes/clients.js"; 
import productsRouter from "./routes/products.js";
import salesRouter from "./routes/sales.js";
import inventoryRouter from "./routes/inventory.js";
import cashRegisterRouter from "./routes/cashRegister.js";
import usersRouter from "./routes/users.js";
import creditsRouter from "./routes/credits.js";
import containersRouter from "./routes/containers.js";
import clientContainerDepositsRouter from "./routes/clientContainerDeposits.js";
import syncRouter from "./routes/sync.js";
import healthRouter from "./routes/health.js";
import pendingSalesRouter from "./routes/pendingSales.js";
import copiesRouter from "./routes/copies.js";
import printersRouter from "./routes/printers.js";
import suppliersRouter from "./routes/suppliers.js";
import purchasesRouter from "./routes/purchases.js";
import accountPayablesRouter from "./routes/accountPayables.js";

// Health check (sin /api para facilitar detección)
app.use("/health", healthRouter);

app.use("/api/categories", categoriesRouter); 
app.use("/api/clients", clientsRouter); 
app.use("/api/products", productsRouter); 
app.use("/api/sales", salesRouter); 
app.use("/api/inventory", inventoryRouter);
app.use("/api/cash-register", cashRegisterRouter);
app.use("/api/users", usersRouter);
app.use("/api/credits", creditsRouter);
app.use("/api/containers", containersRouter);
app.use("/api/client-container-deposits", clientContainerDepositsRouter);
app.use("/api/sync", syncRouter);
app.use("/api/pending-sales", pendingSalesRouter);
app.use("/api/copies", copiesRouter);
app.use("/api/printers", printersRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/purchases", purchasesRouter);
app.use("/api/account-payables", accountPayablesRouter);
console.log("✅ Ruta /api/copies registrada correctamente");
console.log("✅ Ruta /api/printers registrada correctamente");
console.log("✅ Ruta /api/suppliers registrada correctamente");
console.log("✅ Ruta /api/purchases registrada correctamente");
console.log("✅ Ruta /api/account-payables registrada correctamente"); 

// -------------------
// Middleware de manejo de errores global
// -------------------
app.use((err, req, res, next) => {
  console.error('❌ Error no manejado en Express:', err);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Middleware para manejar rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// -------------------
// Manejo de errores no capturados
// -------------------
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  // No cerrar el proceso, solo loguear
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection:', reason);
  // No cerrar el proceso, solo loguear
});

// -------------------
// Manejo de señales de terminación
// -------------------
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Señal ${signal} recibida. Cerrando servidor...`);
  
  try {
    // Cerrar Prisma
    await prisma.$disconnect();
    console.log('✅ Prisma desconectado');
    
    // Cerrar servidor
    if (server) {
      server.close(() => {
        console.log('✅ Servidor HTTP cerrado');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error durante el cierre:', error);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// -------------------
// Iniciar servidor
// -------------------
const PORT = 3001; // puerto fijo
// Escuchar en todas las interfaces de red (0.0.0.0) para permitir conexiones desde otros dispositivos
const HOST = process.env.HOST || "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
  console.log(`🖥️  Servidor corriendo en http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  console.log(`🌐 Accesible desde la red local en: http://[IP-DE-ESTA-MAQUINA]:${PORT}`);
  startSyncLoop();//   🔁 activa sincronización automática
});

// Configurar timeout del servidor
server.timeout = 30000; // 30 segundos
server.keepAliveTimeout = 65000; // 65 segundos
server.headersTimeout = 66000; // 66 segundos
