# Plan de Implementación: Pending Sale Payment Status

## Overview

Este plan convierte el diseño en pasos de código incrementales. El trabajo avanza de abajo hacia arriba: primero el esquema de datos (Prisma), luego la lógica pura de validación y transición de estado en el backend, después la API y su flujo de cobro atómico, y finalmente el frontend (API, Bloque_Folio en el carrito y la Vista_Mis_Folios). Cada paso se apoya en los anteriores y termina conectando los componentes entre sí, sin dejar código huérfano.

El proyecto ya cuenta con `vitest` y `fast-check` como dependencias de desarrollo en ambos paquetes (`mariam-pos-backend` y `mariam-pos-front`), y ambos exponen el script `test: vitest run`. No se requiere instalar ni configurar un framework de pruebas nuevo.

Lenguaje de implementación: **JavaScript (ESM)** en el backend (Node/Express/Prisma) y **TypeScript/React** en el frontend, tal como define el diseño. No se usa pseudocódigo.

## Tasks

- [x] 1. Extender el esquema de datos de Prisma (PendingSale y Sale)
  - Añadir a `PendingSale` los campos `status String @default("PENDING")`, `createdBy String?`, `paidAt DateTime?`, `paidSaleId Int? @unique`, `paidCashRegister String?`, `paidBy String?`
  - Añadir los índices `@@index([status])` y `@@index([cashRegister])` a `PendingSale`
  - Añadir a `Sale` los campos `origin String @default("DIRECT")`, `sourceCashRegister String?`, `onlineOrderId String?` y el índice `@@index([origin])`
  - Todos los campos nuevos opcionales o con `@default` para no requerir migración de datos
  - Archivo: `mariam-pos-backend/prisma/schema.prisma`
  - _Requirements: 1.1, 5.1, 9.1, 9.4, 9.5, 10.1_

- [x] 2. Validación y lógica de estado de la venta pendiente (backend)
  - [x] 2.1 Implementar el validador de estado centralizado
    - Crear `PENDING_SALE_STATUSES = ["PENDING", "PAID"]` y la función `assertValidStatus(status)` que lanza un error con `statusCode = 400` y mensaje descriptivo para valores inválidos
    - Archivo: `mariam-pos-backend/src/controllers/pendingSalesController.js`
    - _Requirements: 1.1, 1.4_

  - [ ]* 2.2 Prueba de propiedad para el validador de estado
    - **Property 2: El validador de estado rechaza valores inválidos**
    - **Validates: Requirements 1.1, 1.4**
    - Generador `arbStatusString` (strings arbitrarios incluyendo los válidos); `fc.assert(..., { numRuns: 100 })`
    - Archivo: `mariam-pos-backend/src/controllers/__tests__/pendingSalesController.status.pbt.test.js`

  - [x] 2.3 Implementar `createPendingSale` con estado y trazabilidad de creación
    - Asignar `status = "PENDING"` al crear; registrar `cashRegister`, `branch`, `createdBy` del payload (o el default documentado cuando se omiten)
    - Garantizar que `paidAt`, `paidSaleId`, `paidCashRegister`, `paidBy` queden nulos al crear
    - Archivo: `mariam-pos-backend/src/controllers/pendingSalesController.js`
    - _Requirements: 1.2, 5.1, 5.3_

  - [ ]* 2.4 Prueba de propiedad para la creación de venta pendiente
    - **Property 1: Crear deja PENDING y registra trazabilidad**
    - **Validates: Requirements 1.2, 5.1**
    - Generador `arbPendingSaleCreatePayload` (details no vacío, campos arbitrarios u omitidos); mock del cliente Prisma
    - Archivo: `mariam-pos-backend/src/controllers/__tests__/pendingSalesController.create.pbt.test.js`

  - [ ]* 2.5 Prueba de propiedad para campos de cobro vacíos en PENDING
    - **Property 4: Un folio PENDING tiene todos los campos de cobro vacíos**
    - **Validates: Requirements 5.3**
    - Verifica que tras creación u operaciones sin cobro `paidAt`, `paidSaleId`, `paidCashRegister`, `paidBy` son nulos
    - Archivo: `mariam-pos-backend/src/controllers/__tests__/pendingSalesController.create.pbt.test.js`

  - [x] 2.6 Implementar `markPendingSalePaid(id, { saleId, paidCashRegister, paidBy }, tx?)`
    - Función reutilizable que valida la transición y escribe `status = "PAID"` junto con `paidSaleId`, `paidAt`, `paidCashRegister`, `paidBy` de forma atómica
    - Si recibe `tx`, usar el cliente transaccional; si no, usar el cliente Prisma normal
    - Devolver 404 si el folio no existe y 409 si el folio ya está `PAID` (idempotencia defensiva)
    - Archivo: `mariam-pos-backend/src/controllers/pendingSalesController.js`
    - _Requirements: 1.3, 4.1, 4.2, 4.3_

- [x] 3. Consulta de ventas pendientes con filtros y trazabilidad (backend)
  - [x] 3.1 Implementar filtros y forma de respuesta en `getPendingSales`
    - Aceptar query params opcionales `cashRegister` (filtra por Caja_Origen) y `status` (filtra por estado, validado con `assertValidStatus`)
    - Cuando el filtro de `cashRegister` está ausente/vacío en el contexto de la vista de caja auxiliar, no devolver folios de otras cajas
    - Incluir en cada registro `status`, `cashRegister`, `branch`, `createdBy`, `paidAt`, `paidSaleId`, `paidCashRegister`, `paidBy`
    - Archivo: `mariam-pos-backend/src/controllers/pendingSalesController.js`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 3.2 Prueba de propiedad para el filtrado
    - **Property 11: El filtrado es correcto y completo**
    - **Validates: Requirements 7.2, 7.3, 8.2, 8.3, 8.4**
    - Generadores `arbFolioDataset` + `arbFilter` (incluyendo caja vacía/ausente)
    - Archivo: `mariam-pos-backend/src/controllers/__tests__/pendingSalesController.filter.pbt.test.js`

  - [ ]* 3.3 Prueba de propiedad para la forma de la respuesta de la API
    - **Property 12: La respuesta de la API expone estado y trazabilidad**
    - **Validates: Requirements 8.1**
    - Verifica que cada objeto serializado expone las claves `status`, `cashRegister`, `branch`, `createdBy`, `paidAt`, `paidSaleId`, `paidCashRegister`, `paidBy`
    - Archivo: `mariam-pos-backend/src/controllers/__tests__/pendingSalesController.filter.pbt.test.js`

- [x] 4. Ruta de cobro y endpoint de marcado (backend)
  - Añadir `router.patch("/:id/pay", markPendingSalePaidHandler)` conservando las rutas existentes (`get`, `getById`, `post`, `delete`, `put`)
  - Implementar `markPendingSalePaidHandler` que invoque `markPendingSalePaid` y mapee los errores a 400/404/409
  - Archivo: `mariam-pos-backend/src/routes/pendingSales.js`, `mariam-pos-backend/src/controllers/pendingSalesController.js`
  - _Requirements: 1.3, 1.4, 4.1_

- [x] 5. Checkpoint - Asegurar que las pruebas del backend de estado/consulta pasan
  - Ejecutar `vitest run` en `mariam-pos-backend`. Ensure all tests pass, ask the user if questions arise.

- [x] 6. Cobro atómico con origen de venta (backend)
  - [x] 6.1 Implementar la transacción de cobro en `salesController.createSales`
    - Leer del body `origin`, `sourceCashRegister`, `onlineOrderId`, `pendingSaleId`, `paidBy`
    - Dentro de `prisma.$transaction`: crear la `Sale` con `origin: origin || "DIRECT"`, `sourceCashRegister`, `onlineOrderId`; si hay `pendingSaleId`, invocar `markPendingSalePaid(pendingSaleId, { saleId, paidCashRegister: cashRegister, paidBy }, tx)`
    - Garantizar que si la creación de la `Sale` falla, la transacción revierte completa (sin `Sale` huérfana, folio permanece `PENDING`)
    - Archivo: `mariam-pos-backend/src/controllers/salesController.js`
    - _Requirements: 1.3, 4.1, 4.2, 4.3, 4.4, 4.5, 9.2, 9.3, 9.4_

  - [ ]* 6.2 Prueba de propiedad para el post-estado atómico del cobro exitoso
    - **Property 8: El cobro exitoso produce el post-estado atómico correcto**
    - **Validates: Requirements 1.3, 4.1, 4.2, 4.3, 4.4, 5.2, 9.3, 9.4**
    - Generador `arbCobroInput` con `pendingSaleId` presente; mock de `$transaction`
    - Archivo: `mariam-pos-backend/src/controllers/__tests__/salesController.cobro.pbt.test.js`

  - [ ]* 6.3 Prueba de propiedad para el rollback ante fallo de cobro
    - **Property 9: El fallo del cobro revierte por completo**
    - **Validates: Requirements 4.5**
    - Variante de `arbCobroInput` con fallo forzado en la creación de `Sale`
    - Archivo: `mariam-pos-backend/src/controllers/__tests__/salesController.cobro.pbt.test.js`

  - [ ]* 6.4 Prueba de propiedad para el origen por defecto DIRECT
    - **Property 13: Origen por defecto DIRECT al crear y al leer registros heredados**
    - **Validates: Requirements 9.2, 10.3, 10.4**
    - Verifica que al crear sin `origin` la venta es `DIRECT`, y que registros heredados sin `origin`/`status` se interpretan como `DIRECT`/`PENDING`
    - Archivo: `mariam-pos-backend/src/controllers/__tests__/salesController.cobro.pbt.test.js`

  - [ ]* 6.5 Prueba de integración de atomicidad del cobro
    - Cobro real que crea `Sale` y marca `PendingSale` `PAID` en una transacción; caso con fallo inyectado que verifica el rollback (sin `Sale`, folio `PENDING`)
    - Archivo: `mariam-pos-backend/src/controllers/__tests__/salesController.cobro.integration.test.js`
    - _Requirements: 4.3, 4.5_

- [x] 7. Checkpoint - Asegurar que las pruebas del backend de cobro pasan
  - Ejecutar `vitest run` en `mariam-pos-backend`. Ensure all tests pass, ask the user if questions arise.

- [x] 8. API del frontend para ventas pendientes
  - [x] 8.1 Extender tipos y funciones en `pendingSales.ts`
    - Añadir `PendingSaleStatus = "PENDING" | "PAID"` y los campos `status`, `createdBy?`, `paidAt?`, `paidSaleId?`, `paidCashRegister?`, `paidBy?` a la interfaz `PendingSale`
    - Actualizar `getPendingSales(filters?: { cashRegister?; status? })` para armar el query string
    - Añadir `markPendingSalePaid(id, { saleId, paidCashRegister?, paidBy? })` que llama `PATCH /pending-sales/:id/pay`
    - Archivo: `mariam-pos-front/src/api/pendingSales.ts`
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 9. Bloque_Folio inmutable en el carrito de la caja principal
  - [x] 9.1 Extender el modelo del carrito y el estado del folio cargado
    - Añadir a `ItemCart` los campos opcionales `folioBlockId?`, `folioCode?`, `folioCashRegister?`
    - Añadir el estado `loadedFolio` (`{ pendingSaleId, code, cashRegister } | null`)
    - Archivo: `mariam-pos-front/src/pages/sales/salesPage.tsx`
    - _Requirements: 3.1, 3.7_

  - [x] 9.2 Implementar la carga del folio y las reglas de inmutabilidad
    - `handlePendingSaleSelect`: mapear detalles a `ItemCart[]` marcados con `folioBlockId`, agregarlos al carrito sin borrar la `PendingSale`, setear `loadedFolio`
    - Volver no-op `handleUpdateQuantity`, `handleRemove` y la edición de precio cuando la línea tiene `folioBlockId`; ocultar/deshabilitar sus controles en la UI
    - Permitir agregar Productos_Extra por el flujo normal (`handleAdd`) sin `folioBlockId` (editables)
    - Mostrar en el Bloque_Folio el `folioCode` y la Caja_Origen, de forma clara y discreta
    - Archivo: `mariam-pos-front/src/pages/sales/salesPage.tsx`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.7_

  - [ ]* 9.3 Prueba de propiedad para la inmutabilidad de las líneas del bloque
    - **Property 5: Inmutabilidad de las líneas del Bloque_Folio**
    - **Validates: Requirements 3.2, 3.3**
    - Generador `arbCart` (mezcla de líneas con y sin `folioBlockId`)
    - Archivo: `mariam-pos-front/src/pages/sales/__tests__/cart.immutability.pbt.test.ts`

  - [ ]* 9.4 Prueba de propiedad para la editabilidad de los Productos_Extra
    - **Property 6: Los Productos_Extra permanecen editables**
    - **Validates: Requirements 3.4**
    - Archivo: `mariam-pos-front/src/pages/sales/__tests__/cart.immutability.pbt.test.ts`

  - [x] 9.5 Implementar `handleRemoveFolioBlock` y el cálculo del detalle a entregar
    - `handleRemoveFolioBlock()`: eliminar todas las líneas con `folioBlockId === loadedFolio.pendingSaleId`, limpiar `loadedFolio`, conservar Productos_Extra, sin tocar la base de datos (folio sigue `PENDING`)
    - Calcular el detalle a entregar como los `details` propios del folio, excluyendo Productos_Extra
    - Archivo: `mariam-pos-front/src/pages/sales/salesPage.tsx`
    - _Requirements: 3.5, 3.6, 6.1, 6.2_

  - [ ]* 9.6 Prueba de propiedad para quitar el Bloque_Folio conservando los extras
    - **Property 7: Quitar el Bloque_Folio conserva exactamente los Productos_Extra**
    - **Validates: Requirements 3.5**
    - Archivo: `mariam-pos-front/src/pages/sales/__tests__/cart.immutability.pbt.test.ts`

  - [ ]* 9.7 Prueba de propiedad para el detalle a entregar
    - **Property 10: El detalle a entregar es el del folio y excluye los extras**
    - **Validates: Requirements 6.1, 6.2**
    - Archivo: `mariam-pos-front/src/pages/sales/__tests__/delivery.detail.pbt.test.ts`

  - [x] 9.8 Conectar el cobro con el folio cargado en `confirmPayment`
    - Si `loadedFolio` existe, añadir al payload de `createSale`: `origin: "PENDING_SALE"`, `sourceCashRegister`, `pendingSaleId`, `paidBy`; si no, `origin: "DIRECT"`
    - Tras éxito, limpiar `loadedFolio` junto con el carrito
    - Archivo: `mariam-pos-front/src/pages/sales/salesPage.tsx`
    - _Requirements: 4.1, 9.3_

  - [ ]* 9.9 Prueba de ejemplo del render del Bloque_Folio
    - Verifica que muestra `code` y Caja_Origen, que los controles de edición/eliminación individual están deshabilitados y que el botón "Quitar folio" está presente (React Testing Library)
    - Archivo: `mariam-pos-front/src/pages/sales/__tests__/folioBlock.render.test.tsx`
    - _Requirements: 3.1, 3.7_

- [x] 10. Dejar de borrar el folio al cargarlo (PendingSalesModal)
  - `loadPendingSales`: llamar `getPendingSales({ status: "PENDING" })` para listar solo folios cobrables
  - `handleSelect`: eliminar la llamada a `deletePendingSale`; solo invocar `onSelect(pendingSale)`
  - Archivo: `mariam-pos-front/src/pages/sales/PendingSalesModal.tsx`
  - _Requirements: 2.1, 2.2, 2.3, 8.4_

- [x] 11. Vista_Mis_Folios para la caja auxiliar (MyFoliosModal, nuevo)
  - [x] 11.1 Crear el componente `MyFoliosModal` con semáforo y filtrado por caja
    - Leer `caja` de `localStorage`; si no existe, render vacío sin consultar la API
    - Cargar con `getPendingSales({ cashRegister: caja })`; mostrar por fila semáforo (🟡 PENDING / 🟢 PAID), folio (`code`), estado, total y fecha de creación
    - Reutilizar `PendingSaleDetailModal` para ver el detalle del folio
    - Archivo: `mariam-pos-front/src/pages/sales/MyFoliosModal.tsx` (nuevo)
    - _Requirements: 6.3, 7.1, 7.2, 7.3, 7.6_

  - [x] 11.2 Implementar refresco manual y polling simple
    - Control de refresco manual que vuelve a consultar `getPendingSales` y actualiza el estado mostrado
    - Polling periódico con `setInterval` (p.ej. 15000 ms) cuando el refresco automático está habilitado, con limpieza en el `useEffect`
    - Ante fallo de la consulta, conservar la última lista y reintentar en el siguiente ciclo
    - Archivo: `mariam-pos-front/src/pages/sales/MyFoliosModal.tsx`
    - _Requirements: 7.4, 7.5_

  - [ ]* 11.3 Prueba de ejemplo del semáforo y el refresco
    - Verifica `PENDING → 🟡`, `PAID → 🟢`, y que al pulsar refrescar `getPendingSales` se vuelve a invocar y la fila refleja el nuevo estado (fake timers para el polling)
    - Archivo: `mariam-pos-front/src/pages/sales/__tests__/myFolios.render.test.tsx`
    - _Requirements: 7.1, 7.4, 7.5, 7.6_

- [x] 12. Checkpoint - Asegurar que las pruebas del frontend pasan
  - Ejecutar `vitest run` en `mariam-pos-front`. Ensure all tests pass, ask the user if questions arise.

- [x] 13. Compatibilidad del esquema con datos existentes
  - [ ]* 13.1 Prueba de integración de preservación de datos tras `prisma db push`
    - Sobre una copia sembrada de la base SQLite, verificar conteos y valores de `PendingSale` y `Sale` antes/después de aplicar el esquema; registros sin `status`/`origin` se interpretan como `PENDING`/`DIRECT`
    - Archivo: `mariam-pos-backend/src/__tests__/schema.compat.integration.test.js`
    - _Requirements: 10.2, 10.3, 10.4_

  - [x] 13.2 Documentar el runbook de aplicación del esquema
    - Documentar el procedimiento `npx prisma db push` (no `migrate dev`), con respaldo previo del archivo SQLite y la nota de que se ejecuta solo tras confirmación explícita del usuario
    - Archivo: `.kiro/specs/pending-sale-payment-status/schema-apply-runbook.md` (nuevo)
    - _Requirements: 10.5_

- [x] 14. Checkpoint final - Asegurar que toda la suite pasa
  - Ejecutar `vitest run` en `mariam-pos-backend` y en `mariam-pos-front`. Ensure all tests pass, ask the user if questions arise.

## Notes

- Las tareas marcadas con `*` son opcionales (pruebas unitarias, de propiedad e integración) y pueden omitirse para un MVP más rápido.
- Cada propiedad de corrección del diseño se implementa como una única prueba de propiedad con `fast-check` y `{ numRuns: 100 }`, etiquetada con `// Feature: pending-sale-payment-status, Property {n}: ...`.
- Las pruebas de propiedad del backend usan un mock/stub del cliente Prisma; la atomicidad real (`$transaction`) se cubre con la prueba de integración 6.5.
- Las partes de UI (render del bloque, semáforo, polling) se cubren con pruebas de ejemplo, no con PBT.
- La aplicación del esquema vía `prisma db push` es un procedimiento manual documentado (tarea 13.2), no automatizado, y requiere confirmación explícita del usuario.
- Cada tarea referencia cláusulas específicas de requisitos para trazabilidad.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "8.1"] },
    { "id": 2, "tasks": ["2.3", "9.1", "10"] },
    { "id": 3, "tasks": ["2.2", "2.4", "2.6", "9.2", "11.1"] },
    { "id": 4, "tasks": ["2.5", "3.1", "9.3", "9.5", "11.2"] },
    { "id": 5, "tasks": ["3.2", "9.4", "9.7", "9.8", "11.3"] },
    { "id": 6, "tasks": ["3.3", "4", "9.6", "9.9"] },
    { "id": 7, "tasks": ["6.1"] },
    { "id": 8, "tasks": ["6.2", "6.5"] },
    { "id": 9, "tasks": ["6.3"] },
    { "id": 10, "tasks": ["6.4"] },
    { "id": 11, "tasks": ["13.1", "13.2"] }
  ]
}
```
