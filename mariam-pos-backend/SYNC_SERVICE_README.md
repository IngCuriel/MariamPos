# 🔄 Servicio de Sincronización Híbrido - MariamPOS

## 📋 Descripción

Servicio de sincronización híbrido que permite al sistema funcionar de manera **offline-first** con sincronización automática cuando hay conexión a internet.

## ✨ Características

- ✅ **Modo Offline-First**: Funciona completamente sin internet
- ✅ **Sincronización Automática**: Cada 10 minutos cuando hay conexión
- ✅ **No Bloqueante**: No afecta el rendimiento de la aplicación
- ✅ **Reintentos Inteligentes**: Backoff exponencial en caso de errores
- ✅ **Detección de Conexión**: Verifica internet antes de sincronizar
- ✅ **Batch Processing**: Envía 3 ventas por vez para no sobrecargar
- ✅ **Manejo de Errores**: Robusto y resiliente

## ⚙️ Configuración

### Variables de Entorno

Agregar al archivo `.env`:

```env
# URL de la API remota para sincronización
REMOTE_API_URL=https://tu-api-remota.com

# Intervalo de sincronización en minutos (default: 10)
SYNC_INTERVAL_MINUTES=10
```

### Endpoint de Health Check

La API remota debe tener un endpoint `/health` o `/api/sales` que responda rápidamente para verificar conexión.

## 🔧 Funcionamiento

### Flujo de Sincronización

1. **Al iniciar el servidor**: Se inicia el servicio de sincronización
2. **Primera sincronización**: Espera 5 segundos después del inicio
3. **Sincronización periódica**: Cada 10 minutos (configurable)
4. **Detección de conexión**: Verifica internet antes de cada intento
5. **Procesamiento por lotes**: Envía 3 ventas a la vez
6. **Actualización de estado**: Marca ventas como "enviado" al sincronizar

### Estados de Sincronización

- **`pendiente`**: Venta creada localmente, esperando sincronización
- **`enviado`**: Venta sincronizada exitosamente con el servidor remoto

### Comportamiento Offline

- ✅ Las ventas se crean normalmente con `syncStatus: "pendiente"`
- ✅ El sistema funciona completamente sin internet
- ✅ Cuando vuelve la conexión, sincroniza automáticamente
- ✅ No se pierden datos

## 📊 API de Monitoreo

### Obtener Estadísticas

```http
GET /api/sync/stats
```

Respuesta:
```json
{
  "pending": 5,
  "synced": 120,
  "online": true,
  "lastSync": "2025-01-15T10:30:00.000Z",
  "isSyncing": false,
  "consecutiveFailures": 0
}
```

### Forzar Sincronización

```http
POST /api/sync/force
```

Fuerza una sincronización inmediata (útil para testing).

## 🚀 Optimizaciones de Rendimiento

### 1. **No Bloqueante**
- Usa `setTimeout` y `setInterval` asíncronos
- No bloquea el hilo principal del servidor
- Las operaciones de red son asíncronas

### 2. **Detección Rápida de Conexión**
- Timeout de 2 segundos para verificar conexión
- Usa endpoint ligero (`/health` o `HEAD /api/sales`)
- No consume muchos recursos

### 3. **Procesamiento por Lotes**
- Envía máximo 3 ventas por vez
- Evita sobrecargar el servidor remoto
- Reduce el tiempo de sincronización

### 4. **Reintentos Inteligentes**
- Backoff exponencial: 1s, 2s, 4s
- Máximo 3 reintentos por batch
- Evita saturar con reintentos infinitos

### 5. **Prevención de Ejecuciones Simultáneas**
- Flag `isSyncing` previene ejecuciones duplicadas
- Una sincronización a la vez

### 6. **Logs Optimizados**
- Logs informativos pero no excesivos
- Advertencias solo cuando es necesario
- No satura la consola

## 📈 Monitoreo y Logs

El servicio genera logs informativos:

- `🔁 Servicio de sincronización híbrido iniciado...`
- `🌐 Sin conexión a internet. El sistema funciona en modo offline.`
- `📤 Sincronizando X venta(s) pendiente(s)...`
- `✅ X venta(s) sincronizada(s) correctamente.`
- `❌ Error al sincronizar ventas: [mensaje]`

## 🔍 Troubleshooting

### Problema: Las ventas no se sincronizan

1. Verificar que `REMOTE_API_URL` esté configurado correctamente
2. Verificar conexión a internet
3. Revisar logs del servidor
4. Verificar que el endpoint `/api/sales/bulk` exista en la API remota

### Problema: Sincronización muy lenta

1. Verificar la velocidad de internet
2. Revisar el timeout del servidor remoto
3. Considerar aumentar `BATCH_SIZE` si el servidor lo soporta

### Problema: Alto uso de CPU/Memoria

1. El servicio está optimizado para bajo consumo
2. Si hay problemas, verificar que no haya múltiples instancias ejecutándose
3. Revisar logs para detectar loops infinitos

## 🎯 Recomendaciones Adicionales

### 1. **Base de Datos**
- Asegurar que el índice en `syncStatus` esté creado (ya está en el schema)
- Considerar limpiar ventas antiguas sincronizadas periódicamente

### 2. **Red**
- Usar conexión estable cuando sea posible
- Considerar sincronización manual si hay problemas de red

### 3. **Backup**
- Las ventas se guardan localmente siempre
- Considerar backup periódico de la base de datos

### 4. **Monitoreo**
- Implementar dashboard para ver estado de sincronización
- Alertas si hay muchas ventas pendientes por mucho tiempo

## 📝 Notas Técnicas

- El servicio usa Prisma para acceder a la base de datos
- Las operaciones son asíncronas y no bloqueantes
- El intervalo se puede ajustar con `SYNC_INTERVAL_MINUTES`
- El servicio se detiene correctamente al cerrar la aplicación (SIGINT/SIGTERM)

