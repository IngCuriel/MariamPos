import { PrismaClient } from '@prisma/client'
import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()
const REMOTE_API_URL = process.env.REMOTE_API_URL
const SYNC_INTERVAL = (process.env.SYNC_INTERVAL_MINUTES || 5) * 60 * 1000

// 🧩 función auxiliar: verificar si hay internet
async function hasInternetConnection() {
  try {
    await axios.get(`${REMOTE_API_URL}/api/sales`, { timeout: 3000 })
    return true
  } catch {
    return false
  }
}

/**
 * Envía ventas locales pendientes cuando haya conexión
 */
async function syncPendingSales() {
  const online = await hasInternetConnection()
  if (!online) {
    console.log('🌐 Sin conexión, no se puede sincronizar por ahora='+REMOTE_API_URL)
    return
  }

  const pendingSales = await prisma.sale.findMany({
    where: { syncStatus: 'pendiente' },
    include: { details: true },
    take: 3, // 🔹 Trae solo 3 registros
  })

  if (pendingSales.length === 0) {
    console.log('✅ No hay ventas pendientes.')
    return
  }

  console.log(`📤 Intentando enviar ${pendingSales.length} ventas...`)

  try {
    const res = await axios.post(`${REMOTE_API_URL}/api/sales/bulk`, pendingSales)

    if (res.status === 200) {
      const ids = pendingSales.map((s) => s.id)
      await prisma.sale.updateMany({
        where: { id: { in: ids } },
        data: { syncStatus: 'enviado' },
      })
      console.log('✅ Ventas sincronizadas correctamente.')
    }
  } catch (err) {
    console.error('❌ Error al sincronizar ventas:', err.message)
  }
}

/**
 * Inicia el ciclo automático de sincronización
 */
export async function startSyncLoop() {
  console.log('🔁 Servicio de sincronización (offline-first) iniciado...')
  await syncPendingSales()

  setInterval(async () => {
    await syncPendingSales()
  }, SYNC_INTERVAL)
}