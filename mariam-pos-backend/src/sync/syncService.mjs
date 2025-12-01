import prisma from '../utils/prisma.js'
import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()
const REMOTE_API_URL = process.env.REMOTE_API_URL
// Intervalo de sincronización: 10 minutos (600000 ms)
const SYNC_INTERVAL = (process.env.SYNC_INTERVAL_MINUTES || 10) * 60 * 1000
// Tiempo de espera para verificar conexión (más corto para no bloquear)
const CONNECTION_TIMEOUT = 2000
// Número máximo de ventas por batch
const BATCH_SIZE = 3
// Reintentos con backoff exponencial
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 1000 // 1 segundo

// Estado del servicio
let syncIntervalId = null
let isSyncing = false
let lastSyncTime = null
let consecutiveFailures = 0

/**
 * Verifica si hay conexión a internet de manera eficiente
 * Usa un endpoint ligero para no consumir muchos recursos
 */
async function hasInternetConnection() {
  try {
    // Usar un endpoint simple o un ping a un servicio confiable
    const response = await axios.get(`${REMOTE_API_URL}/health`, { 
      timeout: CONNECTION_TIMEOUT,
      validateStatus: (status) => status < 500 // Acepta 200-499 como conexión válida
    })
    return true
  } catch (error) {
    // Si el endpoint /health no existe, intentar con el endpoint de ventas
    try {
      await axios.head(`${REMOTE_API_URL}/api/sales`, { 
        timeout: CONNECTION_TIMEOUT 
      })
      return true
    } catch {
      return false
    }
  }
}

/**
 * Envía un batch de ventas con reintentos y manejo de errores
 */
async function sendSalesBatch(sales, retryCount = 0) {
  try {
    const res = await axios.post(`${REMOTE_API_URL}/api/sales/bulk`, sales, {
      timeout: 30000, // 30 segundos timeout para la petición
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (res.status === 200 || res.status === 201) {
      const ids = sales.map((s) => s.id)
      await prisma.sale.updateMany({
        where: { id: { in: ids } },
        data: { syncStatus: 'enviado' },
      })
      consecutiveFailures = 0 // Resetear contador de fallos
      return { success: true, count: sales.length }
    }
    
    throw new Error(`Respuesta inesperada: ${res.status}`)
  } catch (error) {
    // Si hay error y aún tenemos reintentos, intentar de nuevo con backoff
    if (retryCount < MAX_RETRIES) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount)
      console.log(`⚠️ Error al enviar batch, reintentando en ${delay}ms... (intento ${retryCount + 1}/${MAX_RETRIES})`)
      await new Promise(resolve => setTimeout(resolve, delay))
      return sendSalesBatch(sales, retryCount + 1)
    }
    
    // Si se agotaron los reintentos, lanzar el error
    throw error
  }
}

/**
 * Sincroniza ventas pendientes de manera eficiente
 * Funciona de forma no bloqueante y optimizada
 */
async function syncPendingSales() {
  // Prevenir ejecuciones simultáneas
  if (isSyncing) {
    console.log('⏳ Sincronización en progreso, omitiendo esta ejecución...')
    return
  }

  isSyncing = true
  const startTime = Date.now()

  try {
    // Verificar conexión de manera rápida
    const online = await hasInternetConnection()
    
    if (!online) {
      console.log('🌐 Sin conexión a internet. El sistema funciona en modo offline.')
      consecutiveFailures++
      
      // Si hay muchos fallos consecutivos, aumentar el intervalo temporalmente
      if (consecutiveFailures >= 5) {
        console.log('⚠️ Muchos fallos consecutivos. El sistema seguirá funcionando offline.')
      }
      return
    }

    // Obtener ventas pendientes con límite para no sobrecargar
    const pendingSales = await prisma.sale.findMany({
      where: { syncStatus: 'pendiente' },
      include: { 
        details: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        }
      },
      take: BATCH_SIZE,
      orderBy: { createdAt: 'asc' }, // Enviar las más antiguas primero
    })

    if (pendingSales.length === 0) {
      const elapsed = Date.now() - startTime
      console.log(`✅ No hay ventas pendientes. (${elapsed}ms)`)
      lastSyncTime = new Date()
      return
    }

    console.log(`📤 Sincronizando ${pendingSales.length} venta(s) pendiente(s)...`)

    // Enviar el batch
    const result = await sendSalesBatch(pendingSales)
    
    if (result.success) {
      const elapsed = Date.now() - startTime
      const pendingCount = await prisma.sale.count({
        where: { syncStatus: 'pendiente' }
      })
      
      console.log(`✅ ${result.count} venta(s) sincronizada(s) correctamente. ${pendingCount} pendiente(s) restante(s). (${elapsed}ms)`)
      lastSyncTime = new Date()
      consecutiveFailures = 0
    }

  } catch (error) {
    consecutiveFailures++
    const errorMessage = error.response?.data?.message || error.message || 'Error desconocido'
    console.error(`❌ Error al sincronizar ventas: ${errorMessage}`)
    
    // Si hay muchos fallos, no saturar los logs
    if (consecutiveFailures <= 3) {
      console.error('   Detalles:', error.response?.data || error.message)
    }
  } finally {
    isSyncing = false
    const elapsed = Date.now() - startTime
    if (elapsed > 5000) {
      console.warn(`⚠️ La sincronización tardó ${elapsed}ms (más de lo esperado)`)
    }
  }
}

/**
 * Obtiene estadísticas de sincronización
 */
export async function getSyncStats() {
  const pendingCount = await prisma.sale.count({
    where: { syncStatus: 'pendiente' }
  })
  
  const syncedCount = await prisma.sale.count({
    where: { syncStatus: 'enviado' }
  })

  const online = await hasInternetConnection()

  return {
    pending: pendingCount,
    synced: syncedCount,
    online,
    lastSync: lastSyncTime,
    isSyncing,
    consecutiveFailures
  }
}

/**
 * Fuerza una sincronización inmediata (útil para testing o sincronización manual)
 */
export async function forceSync() {
  if (isSyncing) {
    throw new Error('Ya hay una sincronización en progreso')
  }
  
  console.log('🔄 Sincronización forzada iniciada...')
  await syncPendingSales()
}

/**
 * Inicia el ciclo automático de sincronización
 * Funciona de forma híbrida: offline-first con sincronización automática
 */
export async function startSyncLoop() {
  if (syncIntervalId) {
    console.log('⚠️ El servicio de sincronización ya está en ejecución')
    return
  }

  console.log('🔁 Servicio de sincronización híbrido iniciado...')
  console.log(`   Intervalo: ${SYNC_INTERVAL / 1000 / 60} minutos`)
  console.log(`   API remota: ${REMOTE_API_URL || 'No configurada'}`)
  console.log(`   Modo: Offline-first (funciona sin internet)`)
  
  // Sincronizar inmediatamente al iniciar (si hay conexión)
  // Usar setTimeout para no bloquear el inicio del servidor
  setTimeout(async () => {
    await syncPendingSales()
  }, 5000) // Esperar 5 segundos después del inicio para no sobrecargar

  // Configurar intervalo periódico
  syncIntervalId = setInterval(async () => {
    await syncPendingSales()
  }, SYNC_INTERVAL)

  console.log('✅ Servicio de sincronización activo')
}

/**
 * Detiene el servicio de sincronización
 */
export async function stopSyncLoop() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId)
    syncIntervalId = null
    console.log('🛑 Servicio de sincronización detenido')
  }
}

/**
 * Limpieza al cerrar la aplicación
 * Nota: La desconexión de Prisma se maneja en utils/prisma.js
 */
process.on('SIGINT', async () => {
  await stopSyncLoop()
  // Prisma se desconecta automáticamente en utils/prisma.js
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await stopSyncLoop()
  // Prisma se desconecta automáticamente en utils/prisma.js
  process.exit(0)
})
