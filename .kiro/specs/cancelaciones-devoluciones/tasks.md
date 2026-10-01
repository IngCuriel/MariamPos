# Implementation Plan: Cancelaciones y Devoluciones

## Overview

Este plan convierte el diseño en pasos de codificación incrementales. El trabajo se agrupa en:
capa de datos (schema Prisma + migración), lógica pura testeable (`returnCalculations.js`),
controladores transaccionales y rutas del backend, ajustes a los reportes de ventas, y la capa
de frontend (cliente API, modales, selector de motivo, comprobante). Las pruebas basadas en
propiedades (PBT) se concentran en la lógica pura (frontend ya tiene Vitest + fast-check; el
backend requiere agregar un runner como tarea de preparación). Las pruebas de integración
validan los endpoints transaccionales, la atomicidad y los reportes netos.

Lenguajes de implementación: **JavaScript (ESM)** en el backend (`mariam-pos-backend`, ya es
`"type": "module"`) y **TypeScript + React** en el frontend (`mariam-pos-front`). No se usa
pseudocódigo en el diseño, por lo que no se requiere elección de lenguaje.

## Tasks

- [x] 1. Preparación: schema de datos y runner de pruebas del backend
  - [x] 1.1 Extender el schema Prisma con los modelos y campos nuevos
    - En `mariam-pos-backend/prisma/schema.prisma` agregar el enum `SaleReversalReasonType { ESTANDAR, MERMA }`
    - Agregar modelos `SaleCancellation`, `SaleReturn`, `SaleReturnLine` con sus índices (`saleId`, `shiftId`, `createdAt`) tal como define el diseño
    - Agregar a `SaleDetail` los campos `returnedQuantity Float @default(0)` y `baseUnitQuantity Float?`, más la relación inversa `returnLines SaleReturnLine[]`
    - Agregar a `Sale` las relaciones inversas `cancellation SaleCancellation?` y `returns SaleReturn[]`
    - Agregar a `CashRegisterShift` las relaciones inversas `saleCancellations SaleCancellation[]` y `saleReturns SaleReturn[]`
    - Generar la migración (`prisma migrate dev`) y regenerar el cliente Prisma
    - _Requirements: 1.6, 2.6, 3.8, 5.1, 5.2, 5.3, 9.1, 9.2, 9.3_

  - [x] 1.2 Agregar runner de pruebas al backend
    - En `mariam-pos-backend/package.json` agregar `vitest` y confirmar `fast-check` en `devDependencies`, y el script `"test": "vitest run"`
    - Crear configuración mínima de Vitest (ESM, entorno node) para `mariam-pos-backend`
    - _Requirements: (habilitador de pruebas; sin criterio funcional directo)_

- [x] 2. Lógica pura de cálculo de devoluciones (base de las PBT)
  - [x] 2.1 Implementar `utils/returnCalculations.js`
    - Crear `mariam-pos-backend/src/utils/returnCalculations.js` con funciones puras (sin acceso a BD):
      `availableToReturn`, `validateReturnLines`, `baseUnitFactor`, `inventoryDeltaForLine`,
      `computeNewSaleStatus`, `cashRefundAmount`, `cashPortionFromPaymentMethod`
    - `cashPortionFromPaymentMethod` debe parsear el formato `"Mixto (Efectivo: $X, Tarjeta: $Y)"` igual que `cashRegisterController`
    - _Requirements: 2.3, 2.4, 2.5, 2.8, 2.9, 7.1, 7.3, 7.4_

  - [ ]* 2.2 Property test: cantidad devuelta nunca excede lo disponible
    - **Property 1: La cantidad devuelta nunca excede lo vendido disponible**
    - **Validates: Requirements 2.3**
    - Archivo: `mariam-pos-backend/src/utils/returnCalculations.test.js`

  - [ ]* 2.3 Property test: suma devuelto + remanente = original
    - **Property 2: Suma de devoluciones + remanente = original**
    - **Validates: Requirements 2.1, 9.3**

  - [ ]* 2.4 Property test: estado derivado correcto
    - **Property 4: Estado derivado correcto (`computeNewSaleStatus`)**
    - **Validates: Requirements 2.4, 2.5**

  - [ ]* 2.5 Property test: conversión a unidad base
    - **Property 9: Conversión a unidad base (`baseUnitFactor` / `inventoryDeltaForLine`), incluye 1 Bulto = 20 kg**
    - **Validates: Requirements 2.8, 2.9**

  - [ ]* 2.6 Property test: salida de efectivo = porción pagada en efectivo
    - **Property 7: La salida de efectivo iguala la porción pagada en efectivo (incluye pago mixto; nunca negativa)**
    - **Validates: Requirements 7.1, 7.3, 7.4**

- [x] 3. Checkpoint - Lógica pura verificada
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Captura de `baseUnitQuantity` al crear la venta
  - [x] 4.1 Poblar `baseUnitQuantity` en `createSales`
    - En `mariam-pos-backend/src/controllers/salesController.js`, al crear cada `SaleDetail`
      calcular `baseUnitQuantity = quantity * presentation.quantity` cuando el renglón viene de
      una presentación; en otro caso `baseUnitQuantity = quantity`
    - Mantener compatibilidad con ventas históricas (campo opcional, fallback a `quantity`)
    - _Requirements: 2.8, 2.9_

  - [ ]* 4.2 Unit test de cálculo de `baseUnitQuantity`
    - Verificar producto simple vs. presentación (p. ej. 1 Bulto de 20 kg → 20)
    - _Requirements: 2.8, 2.9_

- [x] 5. Controlador de reversiones (cancelación y devolución) — transaccional
  - [x] 5.1 Implementar `cancelSale` en `returnsController.js`
    - Crear `mariam-pos-backend/src/controllers/returnsController.js` con `cancelSale`
    - Validar: motivo no vacío (400), venta existente (404), venta no "Cancelada" (409)
    - Resolver turno OPEN de la caja; si requiere salida de efectivo y no hay turno → 409 `requiresShift`
    - Dentro de `prisma.$transaction`: actualizar `Sale.status = "Cancelada"`, crear `SaleCancellation`,
      crear `InventoryMovement` ENTRADA + actualizar `Inventory.currentStock` solo para `trackInventory=true`
      y `reasonType=ESTANDAR` (merma: registrar sin incrementar stock), crear `CashMovement` SALIDA por la
      porción en efectivo si aplica
    - Revalidar `reasonType` para motivos canónicos de merma
    - Construir y devolver `ReversalReceipt` tipo `"CANCELACION"`
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 1.7, 3.1, 3.5, 3.8, 4.1, 4.3, 5.1, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.5, 7.6, 7.7, 9.1, 9.2, 9.3, 10.1, 10.3_

  - [x] 5.2 Implementar `returnSale` en `returnsController.js`
    - Validar: motivo no vacío (400), al menos una línea (400), venta/renglón existentes (404)
    - Usar `validateReturnLines`; si alguna línea excede disponible → 400 con `availableByLine`
    - Resolver turno OPEN; si devuelve efectivo y no hay turno → 409 `requiresShift`
    - Dentro de `prisma.$transaction`: crear `SaleReturn` + `SaleReturnLine[]`, incrementar
      `SaleDetail.returnedQuantity`, mover inventario por `inventoryDeltaForLine` (solo `trackInventory=true`
      + estándar; merma sin incrementar), calcular estado con `computeNewSaleStatus` y actualizar `Sale.status`,
      crear `CashMovement` SALIDA por suma de subtotales devueltos si aplica
    - Construir y devolver `ReversalReceipt` tipo `"DEVOLUCION"` con líneas
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 3.2, 3.5, 3.8, 4.2, 4.3, 5.2, 6.1, 6.2, 6.3, 6.4, 6.5, 7.4, 7.5, 7.6, 7.7, 9.1, 9.2, 9.3, 10.2, 10.3_

  - [x] 5.3 Implementar `getSaleReversals` y `listReversals`
    - `getSaleReversals`: devuelve la venta con sus `SaleCancellation` y `SaleReturn` (bitácora de esa venta)
    - `listReversals`: lista registros de cancelación/devolución con filtros de fecha/sucursal/caja
    - _Requirements: 5.4, 9.4_

  - [ ]* 5.4 Pruebas de integración de endpoints de reversión
    - `cancel`: éxito + rechazos (motivo vacío 400, ya cancelada 409, sin turno con efectivo 409);
      verifica `CashMovement` según método de pago y movimiento de inventario solo `trackInventory=true`
    - `return`: parcial y total; verifica `returnedQuantity`, estado, `SaleReturn`+líneas,
      conversión a unidad base, salida de efectivo = suma de subtotales; rechazo por exceso (400 `availableByLine`)
    - **Property 8: Inventario solo se mueve para `trackInventory = true`** → Validates: Requirements 6.1, 6.2, 6.3, 6.4
    - **Property 11: No eliminación / inmutabilidad** → Validates: Requirements 9.1, 9.3
    - _Requirements: 1.1, 1.5, 2.3, 2.4, 2.5, 6.1, 6.3, 6.4, 7.1, 7.3, 7.4, 7.7_

  - [ ]* 5.5 Prueba de integración de atomicidad
    - **Property 10: Atomicidad (invariante transaccional)** — forzar error a mitad de la transacción
      y verificar que nada se persistió (status y stock intactos)
    - **Validates: Requirements 9.1, 9.2, 9.3**

- [x] 6. Rutas del backend y montaje
  - [x] 6.1 Crear `routes/returns.js` y montar en `index.mjs`
    - Crear `mariam-pos-backend/src/routes/returns.js` con `POST /sales/:id/cancel`,
      `POST /sales/:id/return`, `GET /sales/:id/reversals`, `GET /returns`
    - Montar el router en `mariam-pos-backend/src/index.mjs` tras el router de ventas
    - _Requirements: 1.1, 2.1, 5.4, 9.4_

- [x] 7. Checkpoint - Backend de reversiones funcional
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Ajuste de reportes a ingreso neto
  - [x] 8.1 Excluir canceladas y descontar devuelto en reportes agregados
    - En `mariam-pos-backend/src/controllers/salesController.js` ajustar `getSalesByCategory`,
      `getSalesByDepartment`, `getTopProducts`, `getSalesSummary`, `getSalesByPaymentMethod` y
      `getSalesByClient`: agregar filtro `status: { not: "Cancelada" }` y usar cantidad neta
      `quantity - returnedQuantity` y `netSubTotal = subTotal * (quantity - returnedQuantity)/quantity`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 8.2 Ajustar `getDailySales` a neto
    - Ajustar la consulta de ventas diarias para excluir canceladas (`status IS NULL OR status <> 'Cancelada'`)
      y reflejar devoluciones parciales sumando el neto por renglón (JOIN con `SaleDetail` o `findMany` + agrupación en JS)
    - _Requirements: 8.4, 8.5, 8.6_

  - [ ]* 8.3 Property test: venta cancelada aporta cero / neto decreciente
    - **Property 5: Una venta cancelada aporta cero a los reportes** → Validates: Requirements 8.1, 8.2, 8.3, 8.4
    - **Property 6: Monto neto de reporte = original − devuelto (monótono, no negativo)** → Validates: Requirements 8.5, 8.6
    - Extraer la agregación de `netSubTotal` a función pura testeable y probarla con fast-check

  - [ ]* 8.4 Pruebas de integración de reportes netos
    - Sembrar una venta cancelada, una con devolución parcial y una normal; verificar ingreso neto
      esperado en los reportes agregados y diarios
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 9. Checkpoint - Reportes netos verificados
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Frontend: tipos, constantes y cliente API
  - [x] 10.1 Definir constantes de motivos y tipos de reversión
    - En `mariam-pos-front/src/constants/index.ts` agregar `CANCEL_REASONS`, `RETURN_REASONS`, `MERMA_REASONS`
    - En `mariam-pos-front/src/types/index.ts` agregar los tipos de request/response
      (`CancelSaleRequest/Response`, `ReturnSaleRequest/Response`, `ReversalReceipt`)
    - _Requirements: 3.3, 3.4, 3.5_

  - [x] 10.2 Crear cliente API `src/api/returns.ts`
    - Crear `mariam-pos-front/src/api/returns.ts` con `cancelSale`, `returnSale`, `getSaleReversals`
      siguiendo el patrón de `src/api/sales.ts` (`getAxiosClient`)
    - _Requirements: 1.1, 2.1, 9.4_

  - [ ]* 10.3 Unit test del cliente API con mock de axios
    - Verificar forma del request/response de `cancelSale` y `returnSale`
    - _Requirements: 1.1, 2.1_

- [x] 11. Frontend: componentes de UI
  - [x] 11.1 Implementar `ReasonPicker`
    - Crear `mariam-pos-front/src/pages/sales/ReasonPicker.tsx`: botones de motivos sugeridos +
      campo de motivo libre + checkbox "Es merma"; marcar `reasonType="merma"` automáticamente
      para "Producto caducado" y "Producto defectuoso / dañado"; bloquear envío sin motivo
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 11.2 Unit test de `ReasonPicker`
    - Verifica merma automática para motivos canónicos, merma manual en motivo libre y bloqueo sin motivo
    - _Requirements: 3.1, 3.5, 3.6, 3.7_

  - [x] 11.3 Implementar `CancelSaleModal`
    - Crear `mariam-pos-front/src/pages/sales/CancelSaleModal.tsx`: confirma cancelación, embebe
      `ReasonPicker`, llama `cancelSale`; al éxito abre el comprobante; maneja 409 `requiresShift`
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 7.7_

  - [x] 11.4 Implementar `ReturnSaleModal`
    - Crear `mariam-pos-front/src/pages/sales/ReturnSaleModal.tsx`: lista renglones con cantidad
      disponible (`quantity - returnedQuantity`), permite elegir cantidades por renglón, valida en
      cliente (no exceder disponible), embebe `ReasonPicker`, llama `returnSale`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 7.7_

  - [ ]* 11.5 Unit test de validación de cantidad en `ReturnSaleModal`
    - No permite exceder la cantidad disponible por renglón (refleja Property 1)
    - _Requirements: 2.3_

  - [x] 11.6 Implementar `CancellationReturnReceipt`
    - Crear `mariam-pos-front/src/pages/sales/CancellationReturnReceipt.tsx` reutilizando el patrón de
      `Ticket.tsx`; rotular claramente como CANCELACIÓN o DEVOLUCIÓN con folio, fecha/hora, cajera,
      sucursal, caja, motivo, monto devuelto y líneas (en devolución)
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ]* 11.7 Unit test de forma de `ReversalReceipt`
    - Verifica campos requeridos y etiqueta de tipo correcto
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 12. Integración y wiring final
  - [x] 12.1 Agregar acciones "Cancelar" y "Devolver" en la vista de ventas
    - Desde la vista de historial/listado de ventas del turno (p. ej. `ShiftHistoryPage.tsx`)
      agregar acciones por venta que abren `CancelSaleModal` / `ReturnSaleModal`; deshabilitar
      "Cancelar" para ventas ya "Cancelada"; mostrar reversiones asociadas (`getSaleReversals`)
    - _Requirements: 1.5, 9.4_

  - [ ]* 12.2 Prueba de integración de UI del flujo de reversión
    - Flujo cliente: abrir modal → elegir motivo/cantidades → enviar → render de comprobante (axios mockeado)
    - _Requirements: 1.1, 2.1, 10.1, 10.2_

- [x] 13. Checkpoint final - Todo integrado
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Las tareas marcadas con `*` son opcionales (pruebas) y pueden omitirse para un MVP más rápido;
  el agente de código NO debe implementarlas automáticamente.
- Cada tarea referencia criterios de aceptación específicos para trazabilidad.
- Las PBT del backend dependen de la tarea 1.2 (runner Vitest + fast-check). El frontend ya tiene
  Vitest + fast-check configurado.
- Las propiedades 1–11 del diseño están cubiertas: 1→2.2, 2→2.3, 4→2.4, 9→2.5, 7→2.6, 8+11→5.4,
  10→5.5, 5+6→8.3. Las propiedades 3 (consistencia denormalizada) y partes de 8/11 se validan vía
  las pruebas de integración transaccionales (5.4/5.5), ya que requieren estado de BD.
- Los checkpoints aseguran validación incremental.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "4.1", "10.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "4.2", "10.2"] },
    { "id": 3, "tasks": ["5.1", "5.2", "8.1", "8.2", "10.3", "11.1"] },
    { "id": 4, "tasks": ["5.3", "5.4", "5.5", "8.3", "8.4", "11.2", "11.3", "11.4", "11.6"] },
    { "id": 5, "tasks": ["6.1", "11.5", "11.7", "12.1"] },
    { "id": 6, "tasks": ["12.2"] }
  ]
}
```
