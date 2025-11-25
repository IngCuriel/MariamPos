# 📊 Análisis y Recomendaciones: Sistema de Corte de Caja

## 🔍 Análisis del Sistema Actual

### Estado Actual
- ✅ Las ventas se registran con `branch` (sucursal) y `cashRegister` (caja)
- ✅ Métodos de pago: Efectivo, Tarjeta, etc.
- ✅ Reportes básicos por método de pago
- ❌ **No existe sistema de turnos/cortes de caja**
- ❌ **No hay control de fondo inicial de caja**
- ❌ **No hay registro de diferencias (sobrantes/faltantes)**
- ❌ **No hay relación entre ventas y turnos**

---

## 🎯 Objetivos del Sistema de Corte de Caja

1. **Control de Turnos**: Registrar inicio y fin de turno por cajero/caja
2. **Fondo de Caja**: Establecer monto inicial al abrir turno
3. **Reconciliación**: Comparar monto esperado vs real
4. **Reportes**: Desglose por método de pago, diferencias, etc.
5. **Auditoría**: Historial completo de cortes de caja

---

## 🏗️ Propuesta de Arquitectura

### 1. Modelo de Base de Datos

```prisma
model CashRegisterShift {
  id              Int       @id @default(autoincrement())
  shiftNumber     String    @unique // Folio único del turno
  branch          String    // Sucursal
  cashRegister    String    // Caja (ej: "Caja 1")
  cashierName     String?   // Nombre del cajero (por ahora string, luego puede ser FK a User)
  
  // Fechas del turno
  startTime       DateTime  @default(now())
  endTime         DateTime?
  
  // Fondos
  initialCash     Float     @default(0) // Fondo inicial
  finalCash       Float?    // Efectivo contado al cerrar
  expectedCash    Float?    // Efectivo esperado (calculado)
  difference      Float?    // Diferencia (finalCash - expectedCash)
  
  // Totales por método de pago
  totalCash       Float     @default(0) // Total en efectivo
  totalCard       Float     @default(0) // Total en tarjeta
  totalTransfer   Float     @default(0) // Total en transferencia
  totalOther      Float     @default(0) // Otros métodos
  
  // Estado
  status          ShiftStatus @default(OPEN) // OPEN, CLOSED, CANCELLED
  
  // Observaciones
  notes           String?
  
  // Relación con ventas
  sales           Sale[]
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([branch, cashRegister])
  @@index([status])
  @@index([startTime])
}

enum ShiftStatus {
  OPEN      // Turno abierto
  CLOSED    // Turno cerrado
  CANCELLED // Turno cancelado
}
```

### 2. Modificación al Modelo Sale

Agregar relación con el turno:

```prisma
model Sale {
  // ... campos existentes ...
  
  // Nueva relación con turno
  shiftId          Int?
  shift            CashRegisterShift? @relation(fields: [shiftId], references: [id])
  
  // ... resto de campos ...
}
```

---

## 🔄 Flujo de Trabajo Recomendado

### Apertura de Turno
1. Usuario selecciona sucursal y caja
2. Ingresa monto inicial (fondo de caja)
3. Sistema crea registro de turno con estado `OPEN`
4. Todas las ventas se asocian a este turno

### Durante el Turno
- Las ventas se registran normalmente
- El sistema calcula automáticamente los totales por método de pago
- Se puede consultar el estado del turno en tiempo real

### Cierre de Turno
1. Usuario solicita cerrar turno
2. Sistema calcula:
   - Total esperado en efectivo = `initialCash + totalCash`
   - Totales por método de pago
3. Usuario ingresa el efectivo contado físicamente
4. Sistema calcula diferencia: `finalCash - expectedCash`
5. Usuario puede agregar notas/observaciones
6. Sistema cierra el turno (status = `CLOSED`)
7. Se genera reporte del corte

---

## 📋 Funcionalidades Requeridas

### Backend

#### Controladores (`cashRegisterController.js`)
- `openShift`: Abrir nuevo turno
- `closeShift`: Cerrar turno con conteo final
- `getActiveShift`: Obtener turno activo de una caja
- `getShiftById`: Obtener detalles de un turno
- `getShiftsByDateRange`: Listar turnos por rango de fechas
- `getShiftSummary`: Resumen de un turno (totales, ventas, etc.)
- `cancelShift`: Cancelar turno (solo si no tiene ventas)

#### Rutas (`routes/cashRegister.js`)
```
POST   /api/cash-register/shifts/open
POST   /api/cash-register/shifts/:id/close
GET    /api/cash-register/shifts/active
GET    /api/cash-register/shifts/:id
GET    /api/cash-register/shifts
GET    /api/cash-register/shifts/:id/summary
DELETE /api/cash-register/shifts/:id
```

### Frontend

#### Componentes Necesarios
1. **ShiftModal**: Modal para abrir/cerrar turno
2. **ShiftStatusBar**: Barra que muestra estado del turno actual
3. **ShiftHistory**: Lista de turnos históricos
4. **ShiftReport**: Reporte detallado de un corte

#### Integración en `salesPage.tsx`
- Verificar si hay turno activo antes de permitir ventas
- Mostrar estado del turno en el header
- Botón para abrir/cerrar turno
- Asociar ventas al turno activo automáticamente

---

## 🎨 Interfaz de Usuario Sugerida

### Al Iniciar la Aplicación
```
┌─────────────────────────────────────┐
│  🏪 Mariam POS - Sucursal: Centro   │
│  📦 Caja: Caja 1                    │
│                                     │
│  ⚠️ No hay turno activo            │
│  [Abrir Turno]                      │
└─────────────────────────────────────┘
```

### Durante el Turno
```
┌─────────────────────────────────────┐
│  🟢 Turno Activo                    │
│  Fondo Inicial: $500.00             │
│  Ventas Efectivo: $1,250.00         │
│  Ventas Tarjeta: $800.00            │
│  Total Esperado: $1,750.00          │
│  [Ver Detalles] [Cerrar Turno]      │
└─────────────────────────────────────┘
```

### Modal de Cierre
```
┌─────────────────────────────────────┐
│  Cerrar Turno                       │
│                                     │
│  Resumen del Turno:                 │
│  • Fondo Inicial: $500.00           │
│  • Ventas Efectivo: $1,250.00       │
│  • Ventas Tarjeta: $800.00         │
│  • Total Esperado: $1,750.00       │
│                                     │
│  Efectivo Contado: [_______]       │
│  Diferencia: $0.00                  │
│                                     │
│  Observaciones:                     │
│  [________________________]         │
│                                     │
│  [Cancelar] [Cerrar Turno]         │
└─────────────────────────────────────┘
```

---

## 🔐 Validaciones y Reglas de Negocio

1. **Solo un turno activo por caja**: No se puede abrir otro turno si hay uno abierto
2. **Ventas solo con turno activo**: No permitir ventas sin turno abierto
3. **Cierre obligatorio**: Al final del día, cerrar todos los turnos
4. **Auditoría**: No permitir modificar turnos cerrados
5. **Diferencia tolerancia**: Alertar si la diferencia es significativa (>$50)

---

## 📊 Reportes del Corte de Caja

### Información a Mostrar
- **Resumen General**
  - Fondo inicial
  - Total de ventas
  - Total por método de pago
  - Efectivo esperado vs contado
  - Diferencia

- **Desglose de Ventas**
  - Número de ventas
  - Lista de ventas (opcional)
  - Promedio de ticket

- **Métodos de Pago**
  - Efectivo: $X.XX (Y ventas)
  - Tarjeta: $X.XX (Y ventas)
  - Transferencia: $X.XX (Y ventas)
  - Otros: $X.XX (Y ventas)

---

## 🚀 Plan de Implementación

### Fase 1: Base de Datos (Prioridad Alta)
1. ✅ Crear modelo `CashRegisterShift` en Prisma
2. ✅ Agregar relación `shiftId` en `Sale`
3. ✅ Crear migración
4. ✅ Actualizar Prisma Client

### Fase 2: Backend (Prioridad Alta)
1. ✅ Crear controlador `cashRegisterController.js`
2. ✅ Crear rutas `routes/cashRegister.js`
3. ✅ Integrar con `salesController` para asociar ventas
4. ✅ Implementar lógica de cálculo de totales

### Fase 3: Frontend - Core (Prioridad Alta)
1. ✅ Crear API client para cortes de caja
2. ✅ Crear componente `ShiftModal`
3. ✅ Integrar en `salesPage.tsx`
4. ✅ Validar turno activo antes de ventas

### Fase 4: Frontend - Reportes (Prioridad Media)
1. ✅ Crear componente `ShiftReport`
2. ✅ Crear vista de historial de turnos
3. ✅ Agregar exportación de reportes (PDF/Excel)

### Fase 5: Mejoras (Prioridad Baja)
1. ⏳ Notificaciones de diferencias significativas
2. ⏳ Dashboard de turnos activos
3. ⏳ Integración con sistema de usuarios

---

## 💡 Consideraciones Adicionales

### Escalabilidad Futura
- **Usuarios/Cajeros**: Cuando implementen autenticación, cambiar `cashierName` por FK a `User`
- **Múltiples Cajas**: El sistema ya soporta múltiples cajas por sucursal
- **Sincronización**: Considerar sincronización de turnos si hay múltiples dispositivos

### Seguridad
- Validar permisos para abrir/cerrar turnos
- Registrar quién abrió/cerró cada turno
- No permitir modificar turnos cerrados

### Performance
- Indexar por `branch`, `cashRegister`, `status` para consultas rápidas
- Cachear turno activo en memoria del servidor
- Optimizar consultas de reportes con agregaciones

---

## ✅ Checklist de Implementación

- [ ] Modelo de base de datos
- [ ] Migración de Prisma
- [ ] Controlador backend
- [ ] Rutas backend
- [ ] Integración con ventas
- [ ] API client frontend
- [ ] Componente ShiftModal
- [ ] Integración en salesPage
- [ ] Validaciones de negocio
- [ ] Reportes básicos
- [ ] Pruebas manuales
- [ ] Documentación de uso

---

## 📝 Notas Finales

Este sistema de corte de caja es **esencial** para:
- Control financiero adecuado
- Auditoría de operaciones
- Detección de discrepancias
- Reportes gerenciales

La implementación debe ser **robusta** y **fácil de usar** para los cajeros.

