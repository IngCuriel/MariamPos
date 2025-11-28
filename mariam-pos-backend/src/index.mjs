// mariam-pos-backend/src/index.mjs
import express from "express";
import { startSyncLoop } from './sync/syncService.mjs'
import cors from "cors";
import pkg from "@prisma/client";
import path from "path";
import fs from "fs";
import os from "os";

const { PrismaClient } = pkg;

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
const prisma = new PrismaClient();

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
import syncRouter from "./routes/sync.js";
import healthRouter from "./routes/health.js";
import pendingSalesRouter from "./routes/pendingSales.js";

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
app.use("/api/sync", syncRouter);
app.use("/api/pending-sales", pendingSalesRouter); 

// -------------------
// Iniciar servidor
// -------------------
const PORT = 3001; // puerto fijo
// Escuchar en todas las interfaces de red (0.0.0.0) para permitir conexiones desde otros dispositivos
const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`🖥️  Servidor corriendo en http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  console.log(`🌐 Accesible desde la red local en: http://[IP-DE-ESTA-MAQUINA]:${PORT}`);
  startSyncLoop();//   🔁 activa sincronización automática
});
