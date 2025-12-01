// utils/prisma.js - Instancia única de PrismaClient compartida
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

// Crear una única instancia de PrismaClient para toda la aplicación
// Configuración optimizada para producción
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  errorFormat: 'pretty',
});

// Variable para evitar múltiples desconexiones
let isDisconnecting = false;

// Manejar desconexión al cerrar el proceso
const gracefulShutdown = async () => {
  if (isDisconnecting) {
    return; // Ya se está desconectando
  }
  
  isDisconnecting = true;
  try {
    await prisma.$disconnect();
    console.log('✅ Prisma Client desconectado correctamente');
  } catch (error) {
    console.error('❌ Error al desconectar Prisma Client:', error);
  }
};

// Manejar señales de terminación (solo una vez para evitar duplicados)
const setupShutdownHandlers = () => {
  if (!process.listenerCount('SIGINT')) {
    process.on('SIGINT', gracefulShutdown);
  }
  if (!process.listenerCount('SIGTERM')) {
    process.on('SIGTERM', gracefulShutdown);
  }
  if (!process.listenerCount('beforeExit')) {
    process.on('beforeExit', gracefulShutdown);
  }
};

// Configurar handlers solo una vez
setupShutdownHandlers();

export default prisma;
