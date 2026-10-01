# Plan de Implementación — Productos de Precio Abierto

## Overview

El enfoque extrae la lógica de negocio a **funciones puras** (en `mariam-pos-front/src/utils/openPrice.ts` para web y `mariam-pos-app/utils/openPrice.ts` para móvil) para que las 9 Correctness Properties del diseño sean verificables con pruebas de propiedad (fast-check). Sobre esas funciones puras se conecta la UI: alta/edición de producto, modal de captura de precio en venta, carrito, y ventas pendientes. El backend no requiere cambios de esquema; los reportes se cubren con pruebas de integración.

Como los proyectos web (Vite + React) y móvil (Expo + React Native) **no tienen framework de pruebas configurado**, la primera fase instala y configura el runner (Vitest para web, Jest/`jest-expo` para móvil) y `fast-check`, requisito para implementar las propiedades 1–9 del diseño.

El trabajo sigue este orden incremental: tipos y utilidades puras → pruebas de propiedad → alta/edición producto (web) → captura de precio en venta (web) → carrito web → ventas pendientes (web) → flujo móvil completo → verificación de reportes → cierre.

## Tasks

- [x] 1. Configurar infraestructura de pruebas y tipos compartidos
  - [x] 1.1 Configurar Vitest + fast-check en el proyecto web
    - Instalar `vitest` y `fast-check` como devDependencies en `mariam-pos-front`
    - Agregar script `"test": "vitest run"` y `"test:watch": "vitest"` en `mariam-pos-front/package.json`
    - Crear configuración de Vitest (en `vite.config.ts` o `vitest.config.ts`) con entorno `jsdom` para pruebas de UI
    - Fijar iteraciones de PBT a mínimo 100 (`fc.configureGlobal({ numRuns: 100 })` en un setup file)
    - _Requirements: soporte de testing para 1.x–6.x_

  - [x] 1.2 Configurar Jest (`jest-expo`) + fast-check en el proyecto móvil
    - Instalar `jest`, `jest-expo`, `@testing-library/react-native` y `fast-check` en `mariam-pos-app`
    - Agregar `"test": "jest"` y preset `jest-expo` en `mariam-pos-app/package.json`
    - Fijar iteraciones de PBT a mínimo 100 en el setup de Jest
    - _Requirements: soporte de testing para 3.x–5.x (móvil)_

  - [x] 1.3 Extender el tipo de `saleType` para incluir "PrecioAbierto" (web)
    - En `mariam-pos-front/src/types/index.ts`, admitir `"PrecioAbierto"` como valor válido de `Product.saleType` y propagar en `ItemCart`/detalle de venta y `PendingSaleDetail` si están tipados
    - No modificar esquema Prisma (campos ya son `String?`)
    - _Requirements: 1.4, 2.5, 5.1_

- [x] 2. Lógica pura de Precio Abierto (web) — funciones y propiedades
  - [x] 2.1 Crear utilidades puras de Precio Abierto en web
    - Crear `mariam-pos-front/src/utils/openPrice.ts` con:
      - `isOpenPrice(product)` → `product.saleType === "PrecioAbierto"`
      - `buildOpenPriceProduct(formState)` → normaliza a `price=0`, `cost=0`, `saleType="PrecioAbierto"`, `pricingMode="simple"`, `priceTiers=[]`, `isPromo=false`, `promoPrice=0`, `presentations=undefined`, `trackInventory=false`
      - `validateOpenPriceProduct(product)` → válido sii `name` y `category` no vacíos (sin exigir `price>0` ni `cost>0`)
      - `buildOpenPriceCartLine(product, precio)` → línea con `quantity=1`, `price=precio`, sin `selectedPresentation`
      - `isValidOpenPrice(value)` → `true` sii numérico y `> 0`
      - `tryUpdateQuantity(line, change)` → si la línea es Precio Abierto, retorna la línea con `quantity=1` (inmutable)
      - `lineSubtotal(line)` → `price * quantity`
    - _Requirements: 1.4, 1.5, 1.6, 2.5, 3.4, 3.5, 3.7, 4.2_

  - [ ]* 2.2 Prueba de propiedad: normalización al guardar
    - **Property 1: Guardar Precio Abierto normaliza el producto**
    - **Validates: Requirements 1.4, 2.5**
    - Generador con combinaciones previas arbitrarias de precio/costo/presentaciones/tiered/promo/inventario
    - Comentario de trazabilidad: `Feature: precio-abierto, Property 1`

  - [ ]* 2.3 Prueba de propiedad: validación de catálogo
    - **Property 2: Validación de catálogo para Precio Abierto**
    - **Validates: Requirements 1.5, 1.6**
    - Incluir nombres/categorías vacíos y con solo espacios; `price`/`cost` en 0
    - Comentario: `Feature: precio-abierto, Property 2`

  - [ ]* 2.4 Prueba de propiedad: captura de precio → línea qty 1 y subtotal
    - **Property 3: La captura de precio produce una línea con cantidad 1 y subtotal igual al precio**
    - **Validates: Requirements 3.4, 3.7**
    - Comentario: `Feature: precio-abierto, Property 3`

  - [ ]* 2.5 Prueba de propiedad: precios inválidos rechazados
    - **Property 4: Precios inválidos son rechazados**
    - **Validates: Requirements 3.5**
    - Generador con vacío, no numérico, 0, negativos
    - Comentario: `Feature: precio-abierto, Property 4`

  - [ ]* 2.6 Prueba de propiedad: cantidad inmutable en 1
    - **Property 5: La cantidad de una línea de Precio Abierto es inmutable en 1**
    - **Validates: Requirements 4.2**
    - Comentario: `Feature: precio-abierto, Property 5`

  - [ ]* 2.7 Prueba de propiedad: no regresión de otros tipos
    - **Property 9: La rama de Precio Abierto no altera el manejo de los demás tipos**
    - **Validates: Requirements 7.1**
    - Generador con líneas "Pieza", "Granel" y Producto Común
    - Comentario: `Feature: precio-abierto, Property 9`

- [x] 3. Checkpoint — Verificar lógica pura y entorno de pruebas
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Alta/edición de producto Precio Abierto (web)
  - [x] 4.1 Agregar tipo "Precio Abierto" y ocultamiento condicional en el formulario
    - En `mariam-pos-front/src/pages/product/NewEditProductModal.tsx`: agregar la opción "Precio Abierto" al selector de `saleType`; derivar `isOpenPrice`
    - Cuando `isOpenPrice`: ocultar "Precio base" y "Costo" y mostrar la leyenda `El precio se definirá al momento de la venta`; ocultar presentaciones, tiered (forzar `pricingMode="simple"`), promoción (`isPromo=false`) e inventario (`trackInventory=false`)
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4_

  - [x] 4.2 Limpieza al cambiar a Precio Abierto, validación y submit
    - Al setear `saleType="PrecioAbierto"`, limpiar `priceTiers`, `presentations`, `isPromo`, `promoPrice`, `trackInventory` usando `buildOpenPriceProduct`
    - `validateForm`: usar `validateOpenPriceProduct` (exigir nombre y categoría; no exigir `price>0` ni `cost>0`)
    - `handleSubmit`: construir el producto a guardar con `buildOpenPriceProduct` (persistir `price=0`, `saleType="PrecioAbierto"`)
    - _Requirements: 1.4, 1.5, 1.6, 2.5_

  - [ ]* 4.3 Pruebas de ejemplo (UI) del formulario de producto
    - Verificar presencia de la opción "Precio Abierto", ocultamiento de precio base/costo/presentaciones/tiered/promo/inventario y leyenda mostrada
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4_

- [x] 5. Captura de precio en venta (web)
  - [x] 5.1 Crear `OpenPriceModal` (SweetAlert2)
    - Crear `mariam-pos-front/src/pages/sales/OpenPriceModal.tsx` basado en `ProductComunModal.tsx`
    - Pide **solo** el precio: campo en blanco con placeholder; sin campo cantidad
    - `preConfirm` usa `isValidOpenPrice`; si inválido muestra validación y no cierra; cancelar devuelve `null`
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6_

  - [x] 5.2 Enganchar Precio Abierto en `handleAdd`
    - En `mariam-pos-front/src/pages/sales/salesPage.tsx`: antes de las ramas tiered/presentaciones/granel, detectar `isOpenPrice(product)` y abrir `OpenPriceModal`
    - Con precio válido, usar `buildOpenPriceCartLine` y hacer **push** de línea independiente (no fusionar por `id`); reproducir sonido y devolver foco al buscador
    - Al cancelar: no agregar, limpiar búsqueda y devolver foco
    - _Requirements: 3.4, 3.6, 3.7, 4.3_

  - [ ]* 5.3 Prueba de propiedad: líneas independientes
    - **Property 6: Agregados del mismo producto generan líneas independientes**
    - **Validates: Requirements 4.3**
    - Secuencia de N agregados con precios arbitrarios `> 0`; carrito con N líneas, cada una qty 1
    - Comentario: `Feature: precio-abierto, Property 6`

  - [ ]* 5.4 Pruebas de ejemplo (UI) del modal de precio
    - Modal abre con solo campo precio en blanco, sin cantidad; cancelar restaura foco; precio inválido no agrega
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6_

- [x] 6. Comportamiento del carrito (web)
  - [x] 6.1 Ocultar controles de cantidad para Precio Abierto en el carrito
    - En el render del carrito de `salesPage.tsx`, no mostrar botones `+/−` cuando la línea es Precio Abierto (mismo tratamiento que Granel); mostrar cantidad fija 1
    - Asegurar que `handleUpdateQuantity` no modifique líneas Precio Abierto (usar `tryUpdateQuantity`)
    - _Requirements: 4.1, 4.2_

  - [ ]* 6.2 Pruebas de ejemplo (UI) del carrito
    - Verificar ausencia de `+/−` y cantidad fija 1 para líneas Precio Abierto
    - _Requirements: 4.1, 4.2_

- [x] 7. Checkpoint — Verificar flujo de venta y carrito (web)
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Ventas pendientes (web)
  - [x] 8.1 Serializar/restaurar línea Precio Abierto en pendientes
    - Agregar a `openPrice.ts`: `toPendingDetail(line)` (`saleType="PrecioAbierto"`, `price=basePrice=precio`, `quantity=1`, `subTotal=precio`, `productName` real, `productId` real) y `fromPendingDetail(detail)` (`price = basePrice ?? price`, `quantity=1`, `saleType="PrecioAbierto"`; fallback defensivo si `<=0`)
    - Integrar en el guardado/carga de pendientes (`salesPage.tsx` + `src/api/pendingSales.ts`): al cargar, no reabrir el modal de precio
    - _Requirements: 5.1, 5.2_

  - [ ]* 8.2 Prueba de propiedad: round-trip de pendientes
    - **Property 7: Round-trip de ventas pendientes**
    - **Validates: Requirements 5.1, 5.2**
    - `fromPendingDetail(toPendingDetail(line))` equivalente a `line` (precio, qty 1, saleType)
    - Comentario: `Feature: precio-abierto, Property 7`

- [x] 9. Persistencia en venta y nombre para reportes (web)
  - [x] 9.1 Propagar saleType y nombre real al detalle de venta
    - En `confirmPayment` (`salesPage.tsx`), agregar `buildSaleDetail(item)` en `openPrice.ts` que para Precio Abierto produce `subTotal=price*1`, `unitPrice=price`, `productName=item.name` (nombre real), `productId=item.id`, `saleType="PrecioAbierto"`
    - Enviar al backend vía `src/api/sales.ts` (campo `SaleItem.saleType` ya existe)
    - _Requirements: 6.3_

  - [ ]* 9.2 Prueba de propiedad: nombre persistido para reportes
    - **Property 8: El nombre persistido para reportes es el nombre real del producto**
    - **Validates: Requirements 6.3**
    - `buildSaleDetail(item).productName === item.name` y no inicia con "Producto no registrado"
    - Comentario: `Feature: precio-abierto, Property 8`

- [x] 10. Flujo móvil completo (React Native)
  - [x] 10.1 Utilidades puras de Precio Abierto (móvil) y normalización de saleType
    - Crear `mariam-pos-app/utils/openPrice.ts` con equivalentes móviles: `isOpenPrice`, `buildOpenPriceCartItem(product, precio)`, `isValidOpenPrice`, `tryUpdateQuantity`, `toPendingDetail`/`fromPendingDetail`
    - Ampliar la normalización de `saleType` en `app/products.tsx`, `app/search.tsx`, `app/scanner.tsx` para mapear `"precioabierto" → "PrecioAbierto"`
    - _Requirements: 3.4, 4.2, 4.3_

  - [x] 10.2 Modal de precio (RN) y agregado al carrito como línea independiente
    - Reutilizar el patrón del modal granel pero pidiendo **solo** precio (sin cantidad); con precio `>0` llamar `addToCart({ quantity:1, unitPrice:precio, saleType:"PrecioAbierto", basePrice:precio })`
    - En `mariam-pos-app/contexts/CartContext.tsx`, agregar rama explícita: si `saleType==="PrecioAbierto"`, siempre `push` (no fusionar por `productId+presentationId`)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.3_

  - [x] 10.3 Ocultar controles de cantidad en el carrito móvil
    - En `mariam-pos-app/app/cart.tsx`, ampliar la condición `isGranel` para también ocultar `+/−` cuando `item.saleType==="PrecioAbierto"`, mostrando cantidad fija 1
    - _Requirements: 4.1, 4.2_

  - [ ]* 10.4 Pruebas de propiedad (móvil): línea, inmutabilidad y round-trip
    - Reutilizar las propiedades aplicables sobre las utilidades móviles: **Property 3** (línea qty 1/subtotal), **Property 5** (cantidad inmutable), **Property 6** (líneas independientes), **Property 7** (round-trip pendientes)
    - **Validates: Requirements 3.4, 3.7, 4.2, 4.3, 5.1, 5.2**
    - Comentarios: `Feature: precio-abierto, Property 3/5/6/7`

  - [ ]* 10.5 Pruebas de ejemplo (UI móvil)
    - Modal con solo precio en blanco sin cantidad; carrito sin `+/−` para Precio Abierto
    - _Requirements: 3.1, 3.2, 3.3, 4.1_

- [ ] 11. Verificación de reportes (integración)
  - [ ]* 11.1 Pruebas de integración de reportes por categoría/departamento y top productos
    - Sembrar ventas de productos Precio Abierto con categoría/departamento conocidos y verificar que `getSalesByCategory`, `getSalesByDepartment` suman en la categoría/departamento correctos y `getTopProducts` lista el nombre real (no "Producto no registrado") en `mariam-pos-backend/src/.../salesController` tests
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 12. Checkpoint final — Verificar web, móvil y reportes
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Las tareas marcadas con `*` son opcionales (pruebas unitarias, de propiedad e integración) y pueden omitirse para un MVP más rápido; las tareas de implementación nunca se marcan como opcionales.
- Cada propiedad de corrección (1–9) se implementa con **una sola** prueba de propiedad, etiquetada con `Feature: precio-abierto, Property {n}` y mínimo 100 iteraciones (fast-check).
- No se modifica el esquema Prisma: `saleType` es `String?` libre y `price=0` es válido; los reportes funcionan por el `productId`/categoría reales.
- El Producto Común (código `000000`) y los tipos "Pieza"/"Granel" conservan su comportamiento (Property 9 + ejemplos de no regresión).
- El reemplazo del botón "Sin código" queda fuera de alcance (Req 7.2), documentado como paso posterior.
- Prerrequisito de las tareas 2.2–2.7, 5.3, 8.2, 9.2 y 10.4: completar 1.1/1.2 (instalación de runner + fast-check), ya que los proyectos no tienen framework de pruebas configurado.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "10.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "4.1", "10.2"] },
    { "id": 3, "tasks": ["4.2", "5.1", "10.3"] },
    { "id": 4, "tasks": ["4.3", "10.4", "10.5"] },
    { "id": 5, "tasks": ["5.2", "6.2"] },
    { "id": 6, "tasks": ["5.3", "5.4", "6.1"] },
    { "id": 7, "tasks": ["8.1"] },
    { "id": 8, "tasks": ["8.2", "9.1"] },
    { "id": 9, "tasks": ["9.2", "11.1"] }
  ]
}
```
