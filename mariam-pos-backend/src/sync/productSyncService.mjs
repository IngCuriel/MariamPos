import prisma from '../utils/prisma.js'
import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()
// URL base por defecto (fallback) desde el entorno.
const FALLBACK_REMOTE_API_URL = process.env.REMOTE_API_URL

/**
 * Resuelve la URL base del servidor remoto para la sincronización.
 *
 * Prioridad:
 *   1. La `apiUrl` de la configuración de tienda online HABILITADA
 *      (OnlineStoreConfig con enabled=true). Se asume "esta instalación =
 *      una sucursal": se toma el primer registro habilitado con apiUrl.
 *   2. Si no hay config habilitada con apiUrl, se usa REMOTE_API_URL del .env
 *      (fallback, para no romper la sincronización existente).
 *
 * Nota: las RUTAS siguen siendo fijas (/api/products/bulk, etc.); esta función
 * solo resuelve la BASE. La config se consulta en cada ejecución del sync, de
 * modo que un cambio en el modal de configuración se refleja sin reiniciar.
 */
async function resolveRemoteApiUrl() {
  try {
    const config = await prisma.onlineStoreConfig.findFirst({
      where: { enabled: true, apiUrl: { not: null } },
      orderBy: { updatedAt: 'desc' },
    })
    const fromConfig = config?.apiUrl?.trim()
    if (fromConfig) {
      // Normaliza la base: quita la barra final y un sufijo "/api" si viniera
      // incluido, porque las rutas de este servicio ya agregan "/api/...".
      return fromConfig.replace(/\/$/, '').replace(/\/api$/, '')
    }
  } catch (error) {
    console.warn('⚠️ No se pudo leer OnlineStoreConfig para el sync; se usa REMOTE_API_URL.', error?.message)
  }
  return FALLBACK_REMOTE_API_URL
}
// Intervalo de sincronización: 10 minutos (600000 ms)
const SYNC_INTERVAL = (process.env.SYNC_INTERVAL_MINUTES || 10) * 60 * 1000
// Tiempo de espera para verificar conexión
const CONNECTION_TIMEOUT = 2000
// Número máximo de productos por batch (cada corrida del loop automático sube
// hasta esta cantidad de productos pendientes). 30 es un punto medio: en
// operación normal solo hay unos pocos cambios por vez y se suben rápido; en
// plan free de Render evita payloads muy grandes. La carga inicial masiva de
// miles de productos se hace con el botón manual (que acepta su propio límite).
const BATCH_SIZE = 30
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
 */
async function hasInternetConnection(baseUrl) {
  const base = baseUrl || (await resolveRemoteApiUrl())
  try {
    await axios.get(`${base}/health`, {
      timeout: CONNECTION_TIMEOUT,
      validateStatus: (status) => status < 500
    })
    return true
  } catch {
    try {
      await axios.head(`${base}/api/products`, {
        timeout: CONNECTION_TIMEOUT
      })
      return true
    } catch {
      return false
    }
  }
}

/**
 * Envía un batch de productos con reintentos y manejo de errores
 */
async function sendProductsBatch(products, baseUrl, retryCount = 0) {
  try {
    const res = await axios.post(`${baseUrl}/api/products/bulk`, products, {
      timeout: 60000, // 60 segundos timeout para productos (más datos)
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (res.status === 200 || res.status === 201) {
      const productIds = products.map((p) => p.id).filter(id => id)
      if (productIds.length > 0) {
        await prisma.product.updateMany({
          where: { id: { in: productIds } },
          data: { syncStatus: 'enviado' },
        })
      }
      consecutiveFailures = 0
      return { success: true, count: products.length }
    }
    
    throw new Error(`Respuesta inesperada: ${res.status}`)
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount)
      console.log(`⚠️ Error al enviar batch de productos, reintentando en ${delay}ms... (intento ${retryCount + 1}/${MAX_RETRIES})`)
      await new Promise(resolve => setTimeout(resolve, delay))
      return sendProductsBatch(products, baseUrl, retryCount + 1)
    }
    throw error
  }
}

/**
 * Envía un batch de categorías con reintentos y manejo de errores
 */
async function sendCategoriesBatch(categories, baseUrl, retryCount = 0) {
  try {
    const res = await axios.post(`${baseUrl}/api/products/categories/bulk`, categories, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (res.status === 200 || res.status === 201) {
      const categoryIds = categories.map((c) => c.id).filter(id => id)
      if (categoryIds.length > 0) {
        await prisma.category.updateMany({
          where: { id: { in: categoryIds } },
          data: { syncStatus: 'enviado' },
        })
      }
      return { success: true, count: categories.length }
    }
    
    throw new Error(`Respuesta inesperada: ${res.status}`)
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount)
      console.log(`⚠️ Error al enviar batch de categorías, reintentando en ${delay}ms... (intento ${retryCount + 1}/${MAX_RETRIES})`)
      await new Promise(resolve => setTimeout(resolve, delay))
      return sendCategoriesBatch(categories, baseUrl, retryCount + 1)
    }
    throw error
  }
}

/**
 * Sincroniza productos pendientes de manera eficiente
 * @param {number} limit - Número máximo de productos a sincronizar (opcional, por defecto BATCH_SIZE)
 */
async function syncPendingProducts(limit = BATCH_SIZE) {
  if (isSyncing) {
    console.log('⏳ Sincronización de productos en progreso, omitiendo esta ejecución...')
    return { success: false, message: 'Ya hay una sincronización en progreso' }
  }

  isSyncing = true
  const startTime = Date.now()

  try {
    // Resuelve la URL base para esta corrida: config de tienda online habilitada
    // o, en su defecto, REMOTE_API_URL (fallback).
    const baseUrl = await resolveRemoteApiUrl()
    if (!baseUrl) {
      console.log('⚠️ Sin URL remota configurada (ni config de tienda online ni REMOTE_API_URL). Se omite el sync.')
      return { success: false, message: 'Sin URL remota configurada' }
    }

    const online = await hasInternetConnection(baseUrl)
    
    if (!online) {
      console.log('🌐 Sin conexión a internet. El sistema funciona en modo offline.')
      consecutiveFailures++
      if (consecutiveFailures >= 5) {
        console.log('⚠️ Muchos fallos consecutivos. El sistema seguirá funcionando offline.')
      }
      return { success: false, message: 'Sin conexión a internet' }
    }

    // 1. Sincronizar categorías primero (los productos dependen de ellas)
    const pendingCategories = await prisma.category.findMany({
      where: { syncStatus: 'pendiente' },
      take: BATCH_SIZE,
      orderBy: { createdAt: 'asc' },
    })

    if (pendingCategories.length > 0) {
      console.log(`📤 Sincronizando ${pendingCategories.length} categoría(s) pendiente(s)...`)
      const result = await sendCategoriesBatch(pendingCategories, baseUrl)
      if (result.success) {
        console.log(`✅ ${result.count} categoría(s) sincronizada(s) correctamente.`)
      }
    }

    // 2. Sincronizar productos con sus presentaciones e inventario
    const pendingProducts = await prisma.product.findMany({
      where: { syncStatus: 'pendiente' },
      include: { 
        category: {
          select: {
            id: true,
            name: true,
            description: true,
            showInPOS: true
          }
        },
        presentations: true, // Todas las presentaciones (el bulk hace upsert completo;
        // filtrar solo 'pendiente' causaba que se enviaran vacías y la API borraba
        // las existentes por el deleteMany con notIn:[]).
        priceTiers: true, // Tramos de precio escalonado (mayoreo)
        unit: true, // Unidad de medida (se envía como texto plano)
        inventory: true,
        kitItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true
              }
            },
            presentation: {
              select: {
                id: true,
                name: true,
                quantity: true,
                unitPrice: true
              }
            }
          }
        }
      },
      take: limit, // Usar el límite proporcionado
      orderBy: { createdAt: 'asc' },
    })

    if (pendingProducts.length === 0) {
      const elapsed = Date.now() - startTime
      console.log(`✅ No hay productos pendientes. (${elapsed}ms)`)
      lastSyncTime = new Date()
      return { success: true, count: 0, message: 'No hay productos pendientes' }
    }

    console.log(`📤 Sincronizando ${pendingProducts.length} producto(s) pendiente(s)...`)

    // Preparar datos para enviar
    const productsToSync = pendingProducts.map(product => {
      const productData = {
        id: product.id,
        code: product.code,
        name: product.name,
        status: product.status,
        saleType: product.saleType,
        price: product.price,
        cost: product.cost,
        description: product.description,
        icon: product.icon,
        categoryId: product.categoryId,
        trackInventory: product.trackInventory,
        isKit: product.isKit,
        // Modo de precio y promoción (se sincronizan a la tienda online).
        pricingMode: product.pricingMode,
        isPromo: product.isPromo,
        promoPrice: product.promoPrice,
        promoEndsAt: product.promoEndsAt,
        // Unidad de medida como TEXTO PLANO (no se manda el id para no depender
        // de que las unidades tengan el mismo id entre local y tienda online).
        unitName: product.unit?.name ?? null,
        unitAbbreviation: product.unit?.abbreviation ?? null,
        branch: product.branch || "Sucursal Default",
        createdAt: product.createdAt,
        category: product.category,
        // Tramos de precio escalonado (solo relevantes si pricingMode = "tiered").
        priceTiers: product.priceTiers.map((t) => ({
          minQty: t.minQty,
          maxQty: t.maxQty,
          unitPrice: t.unitPrice
        })),
        presentations: product.presentations.map(p => ({
          id: p.id,
          name: p.name,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          isDefault: p.isDefault,
          branch: p.branch || product.branch || "Sucursal Default"
        })),
        inventory: product.inventory ? {
          id: product.inventory.id,
          currentStock: product.inventory.currentStock,
          minStock: product.inventory.minStock,
          maxStock: product.inventory.maxStock,
          trackInventory: product.inventory.trackInventory,
          branch: product.inventory.branch || product.branch || "Sucursal Default"
        } : null,
        kitItems: product.kitItems.map(ki => ({
          productId: ki.productId,
          presentationId: ki.presentationId,
          quantity: ki.quantity,
          displayOrder: ki.displayOrder
        }))
      }
      return productData
    })

    // Enviar el batch
    const result = await sendProductsBatch(productsToSync, baseUrl)
    
    if (result.success) {
      const elapsed = Date.now() - startTime
      const pendingCount = await prisma.product.count({
        where: { syncStatus: 'pendiente' }
      })
      
      // Actualizar también las presentaciones e inventario como enviados
      const productIds = pendingProducts.map(p => p.id)
      if (productIds.length > 0) {
        await prisma.productPresentation.updateMany({
          where: { 
            productId: { in: productIds },
            syncStatus: 'pendiente'
          },
          data: { syncStatus: 'enviado' },
        })
        
        await prisma.inventory.updateMany({
          where: { 
            productId: { in: productIds },
            syncStatus: 'pendiente'
          },
          data: { syncStatus: 'enviado' },
        })
      }
      
      console.log(`✅ ${result.count} producto(s) sincronizado(s) correctamente. ${pendingCount} pendiente(s) restante(s). (${elapsed}ms)`)
      lastSyncTime = new Date()
      consecutiveFailures = 0
      
      return { 
        success: true, 
        count: result.count, 
        remaining: pendingCount,
        message: `${result.count} producto(s) sincronizado(s) correctamente. ${pendingCount} pendiente(s) restante(s).`
      }
    }

    return { success: false, message: 'Error al sincronizar productos' }

  } catch (error) {
    consecutiveFailures++
    const errorMessage = error.response?.data?.message || error.message || 'Error desconocido'
    console.error(`❌ Error al sincronizar productos: ${errorMessage}`)
    
    if (consecutiveFailures <= 3) {
      console.error('   Detalles:', error.response?.data || error.message)
    }
    
    return { success: false, message: errorMessage }
  } finally {
    isSyncing = false
    const elapsed = Date.now() - startTime
    if (elapsed > 10000) {
      console.warn(`⚠️ La sincronización de productos tardó ${elapsed}ms (más de lo esperado)`)
    }
  }
}

/**
 * Obtiene estadísticas de sincronización de productos
 */
export async function getProductSyncStats() {
  const pendingProducts = await prisma.product.count({
    where: { syncStatus: 'pendiente' }
  })
  
  const syncedProducts = await prisma.product.count({
    where: { syncStatus: 'enviado' }
  })

  const pendingCategories = await prisma.category.count({
    where: { syncStatus: 'pendiente' }
  })

  const syncedCategories = await prisma.category.count({
    where: { syncStatus: 'enviado' }
  })

  const online = await hasInternetConnection()

  return {
    products: {
      pending: pendingProducts,
      synced: syncedProducts
    },
    categories: {
      pending: pendingCategories,
      synced: syncedCategories
    },
    // Compatibilidad con estructura antigua del frontend
    pendingProducts,
    pendingCategories,
    online,
    lastSync: lastSyncTime,
    isSyncing,
    consecutiveFailures
  }
}

/**
 * Fuerza una sincronización inmediata de productos
 * @param {number} limit - Número máximo de productos a sincronizar (opcional, por defecto BATCH_SIZE)
 */
export async function forceProductSync(limit = BATCH_SIZE) {
  if (isSyncing) {
    throw new Error('Ya hay una sincronización en progreso')
  }
  
  console.log(`🔄 Sincronización forzada de productos iniciada (límite: ${limit})...`)
  return await syncPendingProducts(limit)
}

/**
 * Inicia el ciclo automático de sincronización de productos
 */
export async function startProductSyncLoop() {
  if (syncIntervalId) {
    console.log('⚠️ El servicio de sincronización de productos ya está en ejecución')
    return
  }

  console.log('🔁 Servicio de sincronización de productos iniciado...')
  console.log(`   Intervalo: ${SYNC_INTERVAL / 1000 / 60} minutos`)
  console.log(`   API remota: config de tienda online (enabled) o REMOTE_API_URL (${FALLBACK_REMOTE_API_URL || 'No configurada'})`)
  console.log(`   Modo: Offline-first (funciona sin internet)`)
  
  // Sincronizar inmediatamente al iniciar (si hay conexión)
  setTimeout(async () => {
    await syncPendingProducts()
  }, 10000) // Esperar 10 segundos después del inicio para no sobrecargar

  // Configurar intervalo periódico
  syncIntervalId = setInterval(async () => {
    await syncPendingProducts()
  }, SYNC_INTERVAL)

  console.log('✅ Servicio de sincronización de productos activo')
}

/**
 * Detiene el servicio de sincronización de productos
 */
export async function stopProductSyncLoop() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId)
    syncIntervalId = null
    console.log('🛑 Servicio de sincronización de productos detenido')
  }
}

