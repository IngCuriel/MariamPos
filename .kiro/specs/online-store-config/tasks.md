# Plan de Implementación: Online Store Config

## Overview

Este plan convierte el diseño en pasos de código incrementales. El trabajo avanza de abajo hacia arriba: primero el esquema de datos (Prisma), luego el servicio de cifrado AES del backend, después el controlador (consulta, upsert y el helper interno de descifrado) y sus rutas, y finalmente el frontend (API tipada, hook de lectura, modal de configuración y la integración de visibilidad que reemplaza los valores fijos de URL y credenciales). Cada paso se apoya en los anteriores y termina conectando los componentes entre sí, sin dejar código huérfano.

El proyecto ya cuenta con `vitest` y `fast-check` como dependencias de desarrollo en ambos paquetes (`mariam-pos-backend` y `mariam-pos-front`), y ambos exponen el script `test: vitest run`. No se requiere instalar ni configurar un framework de pruebas nuevo.

Lenguaje de implementación: **JavaScript (ESM)** en el backend (Node/Express/Prisma) y **TypeScript/React** en el frontend, tal como define el diseño. No se usa pseudocódigo.

## Tasks

- [x] 1. Añadir el modelo `OnlineStoreConfig` al esquema de Prisma
  - Definir el modelo con `id Int @id @default(autoincrement())`, `branch String @unique`, `enabled Boolean @default(false)`, `apiUrl String?`, `storeName String?`, `username String?`, `password String?`, `productsEndpoint String?`, `salesEndpoint String?`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt` y el índice `@@index([branch])`
  - `branch` como clave única (a lo sumo una config por sucursal); `enabled` con default `false`; `password` solo almacena el texto cifrado `iv:authTag:data`
  - El modelo es nuevo y no altera tablas existentes (no requiere migración de datos)
  - Archivo: `mariam-pos-backend/prisma/schema.prisma`
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Servicio de cifrado AES-256-GCM (backend)
  - [x] 2.1 Implementar `cryptoService` con `encrypt` / `decrypt`
    - Crear el servicio ESM con `ALGORITHM = "aes-256-gcm"`, `IV_BYTES = 12` y `getKey()` que lee `process.env.ONLINE_STORE_CRYPTO_KEY`, lanza error 500 descriptivo si está ausente/vacía, y deriva 32 bytes con `sha256`
    - `encrypt(plain)` genera IV aleatorio por operación y devuelve `iv:authTag:data` en base64
    - `decrypt(cipherText)` valida el formato de tres segmentos, aplica `setAuthTag` y descifra; lanza si el formato o la autenticación GCM fallan
    - `getKey()` se evalúa en cada operación (la ausencia de clave se detecta en el momento de uso, no al cargar el módulo)
    - Archivo: `mariam-pos-backend/src/services/cryptoService.js` (nuevo)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 2.2 Prueba de propiedad del round-trip de cifrado
    - **Property 1: Round-trip de cifrado**
    - **Validates: Requirements 2.1, 2.2**
    - Generador de strings arbitrarios (vacíos, no ASCII, largos) con `ONLINE_STORE_CRYPTO_KEY` definida; verifica `decrypt(encrypt(p)) === p`; `fc.assert(..., { numRuns: 100 })`
    - Etiqueta: `// Feature: online-store-config, Property 1: Round-trip de cifrado`
    - Archivo: `mariam-pos-backend/src/services/__tests__/cryptoService.roundtrip.pbt.test.js`

  - [ ]* 2.3 Prueba de propiedad: el cifrado no está definido sin clave
    - **Property 3: El cifrado no está definido sin clave**
    - **Validates: Requirements 2.4**
    - Con `ONLINE_STORE_CRYPTO_KEY` ausente/vacía, toda llamada a `encrypt`/`decrypt` lanza un error descriptivo y no produce resultado utilizable; `fc.assert(..., { numRuns: 100 })`
    - Etiqueta: `// Feature: online-store-config, Property 3: El cifrado no está definido sin clave`
    - Archivo: `mariam-pos-backend/src/services/__tests__/cryptoService.nokey.pbt.test.js`

- [x] 3. Controlador de configuración de tienda online (backend)
  - [x] 3.1 Implementar `getOnlineStoreConfig` con contraseña enmascarada
    - Leer `branch` de `req.params.branch ?? req.query.branch`; responder 400 si falta
    - `findUnique({ where: { branch } })`; si no existe, responder 404 `{ exists: false, branch, message }`
    - Si existe, devolver `{ exists: true, ...PUBLIC_FIELDS, hasPassword }` mediante `toPublicConfig`; nunca incluir la contraseña en claro
    - `PUBLIC_FIELDS = ["branch","enabled","apiUrl","storeName","username","productsEndpoint","salesEndpoint","createdAt","updatedAt"]`
    - Archivo: `mariam-pos-backend/src/controllers/onlineStoreConfigController.js` (nuevo)
    - _Requirements: 2.5, 3.1, 3.2, 3.3, 3.4_

  - [ ]* 3.2 Prueba de propiedad: la consulta nunca expone la contraseña en claro
    - **Property 4: La respuesta de consulta nunca expone la contraseña en claro**
    - **Validates: Requirements 2.5, 3.2**
    - Para cualquier contraseña almacenada, la respuesta de `get` y de `upsert` no contiene el valor en claro (solo `hasPassword`); `fc.assert(..., { numRuns: 100 })`
    - Etiqueta: `// Feature: online-store-config, Property 4: La respuesta de consulta nunca expone la contraseña en claro`
    - Archivo: `mariam-pos-backend/src/controllers/__tests__/onlineStoreConfigController.mask.pbt.test.js`

  - [ ]* 3.3 Prueba de propiedad: la consulta expone los campos no sensibles
    - **Property 5: La respuesta de consulta expone los campos no sensibles**
    - **Validates: Requirements 3.1**
    - Para toda config existente, la respuesta expone `branch`, `enabled`, `apiUrl`, `storeName`, `username`, `productsEndpoint`, `salesEndpoint`; `fc.assert(..., { numRuns: 100 })`
    - Etiqueta: `// Feature: online-store-config, Property 5: La respuesta de consulta expone los campos no sensibles`
    - Archivo: `mariam-pos-backend/src/controllers/__tests__/onlineStoreConfigController.mask.pbt.test.js`

  - [ ]* 3.4 Prueba de propiedad: la consulta filtra exactamente por sucursal
    - **Property 6: La consulta filtra exactamente por sucursal**
    - **Validates: Requirements 3.3, 3.4**
    - Generador de conjuntos de configs con `branch` distintos; la respuesta corresponde al `branch` solicitado o indica ausencia; `fc.assert(..., { numRuns: 100 })`
    - Etiqueta: `// Feature: online-store-config, Property 6: La consulta filtra exactamente por sucursal`
    - Archivo: `mariam-pos-backend/src/controllers/__tests__/onlineStoreConfigController.filter.pbt.test.js`

  - [x] 3.5 Implementar `upsertOnlineStoreConfig` (crear/actualizar por branch)
    - Leer del body `branch, enabled, apiUrl, storeName, username, password, productsEndpoint, salesEndpoint`; responder 400 si falta `branch`
    - Construir `data` con `enabled` solo si es booleano; cifrar `password` con `cryptoService.encrypt` solo cuando viene no vacía; dejar `data.password` `undefined` en caso contrario (Prisma conserva la previa en `update`)
    - `prisma.onlineStoreConfig.upsert({ where: { branch }, update: data, create: { branch, ...data } })`
    - Responder `{ exists: true, ...toPublicConfig(record) }`; nunca la contraseña en claro
    - Archivo: `mariam-pos-backend/src/controllers/onlineStoreConfigController.js`
    - _Requirements: 1.2, 1.3, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 3.6 Prueba de propiedad: la persistencia nunca guarda la contraseña en claro
    - **Property 2: La persistencia nunca guarda la contraseña en claro**
    - **Validates: Requirements 1.4, 2.1, 4.3**
    - Para todo payload con contraseña no vacía `p`, el valor persistido es distinto de `p`, tiene formato `iv:authTag:data`, y `decrypt` devuelve `p`; `fc.assert(..., { numRuns: 100 })`
    - Etiqueta: `// Feature: online-store-config, Property 2: La persistencia nunca guarda la contraseña en claro`
    - Archivo: `mariam-pos-backend/src/controllers/__tests__/onlineStoreConfigController.upsert.pbt.test.js`

  - [ ]* 3.7 Prueba de propiedad: el upsert crea o actualiza manteniendo unicidad
    - **Property 7: El upsert crea o actualiza manteniendo unicidad por sucursal**
    - **Validates: Requirements 1.2, 4.1, 4.2**
    - Para toda secuencia de guardados sobre una misma sucursal, queda exactamente una config cuyos campos no sensibles coinciden con el último guardado; `fc.assert(..., { numRuns: 100 })`
    - Etiqueta: `// Feature: online-store-config, Property 7: El upsert crea o actualiza manteniendo unicidad por sucursal`
    - Archivo: `mariam-pos-backend/src/controllers/__tests__/onlineStoreConfigController.upsert.pbt.test.js`

  - [ ]* 3.8 Prueba de propiedad: el guardado por defecto deja la tienda deshabilitada
    - **Property 8: El guardado por defecto deja la tienda deshabilitada**
    - **Validates: Requirements 1.3**
    - Para todo guardado de creación sin `enabled`, la config resultante tiene `enabled === false`; `fc.assert(..., { numRuns: 100 })`
    - Etiqueta: `// Feature: online-store-config, Property 8: El guardado por defecto deja la tienda deshabilitada`
    - Archivo: `mariam-pos-backend/src/controllers/__tests__/onlineStoreConfigController.upsert.pbt.test.js`

  - [x] 3.9 Implementar el helper interno `getDecryptedConfig(branch)`
    - `findUnique({ where: { branch } })`; devolver `null` si no existe; si existe, devolver la config con `password` descifrada mediante `cryptoService.decrypt` (o `null` si no hay)
    - No se enruta: es un import interno para uso del propio backend
    - Archivo: `mariam-pos-backend/src/controllers/onlineStoreConfigController.js`
    - _Requirements: 2.2_

  - [ ]* 3.10 Prueba de propiedad: un guardado sin contraseña conserva la previa
    - **Property 9: Un guardado sin contraseña conserva la contraseña previa**
    - **Validates: Requirements 4.4, 5.6**
    - Sobre una config con contraseña `p`, un guardado posterior sin contraseña deja intacta la `Password_Cifrada`, y `getDecryptedConfig` sigue devolviendo `p`; `fc.assert(..., { numRuns: 100 })`
    - Etiqueta: `// Feature: online-store-config, Property 9: Un guardado sin contraseña conserva la contraseña previa`
    - Archivo: `mariam-pos-backend/src/controllers/__tests__/onlineStoreConfigController.preserve.pbt.test.js`

- [x] 4. Rutas y registro del router (backend)
  - Crear el router con `router.get("/:branch", getOnlineStoreConfig)`, `router.put("/", upsertOnlineStoreConfig)` y `router.post("/", upsertOnlineStoreConfig)` (alias del mismo upsert); `getDecryptedConfig` no se enruta
  - Registrar el router en el agregador de rutas bajo `/online-store-config`, conservando los routers existentes
  - Archivos: `mariam-pos-backend/src/routes/onlineStoreConfig.js` (nuevo), `mariam-pos-backend/src/index.js`
  - _Requirements: 3.1, 4.1, 4.2_

- [x] 5. Checkpoint - Asegurar que las pruebas del backend pasan
  - Ejecutar `vitest run` en `mariam-pos-backend`. Ensure all tests pass, ask the user if questions arise.

- [x] 6. API del frontend para la configuración (`onlineStoreConfig.ts`)
  - Definir las interfaces `OnlineStoreConfig` (sin campo `password`, con `hasPassword`) y `OnlineStoreConfigPayload` (con `password?` write-only)
  - `getOnlineStoreConfig(branch)` llama `GET /online-store-config/:branch` y mapea 404 a `null`
  - `saveOnlineStoreConfig(payload)` llama `PUT /online-store-config` (upsert) y devuelve la config pública
  - Archivo: `mariam-pos-front/src/api/onlineStoreConfig.ts` (nuevo)
  - _Requirements: 3.2, 3.3, 4.1, 4.2_

- [x] 7. Hook de lectura y setter de URL del cliente axios
  - [x] 7.1 Añadir `setOnlineStoreApiBaseUrl` en `onlineStoreOrders.ts`
    - Eliminar la constante fija `ONLINE_STORE_API_URL`; exponer `setOnlineStoreApiBaseUrl(url)` que actualiza `instance.defaults.baseURL` sin recrear la instancia axios
    - Resolver las rutas de productos/ventas leyendo `productsEndpoint`/`salesEndpoint` en el momento de la llamada, no en tiempo de módulo
    - Archivo: `mariam-pos-front/src/api/onlineStoreOrders.ts`
    - _Requirements: 6.1, 6.3_

  - [x] 7.2 Implementar `useOnlineStoreConfig` y el predicado de visibilidad
    - Leer `branch` de `localStorage` clave `sucursal`; cargar la config con `getOnlineStoreConfig(branch)`
    - Exponer `computeOnlineStoreVisible(config) = Boolean(config) && config.enabled === true` y `isOnlineStoreVisible`
    - Al conocer `apiUrl`, invocar `setOnlineStoreApiBaseUrl(config.apiUrl)`; exponer `apiUrl`, `username`, `productsEndpoint`, `salesEndpoint`, `loading`, `reload`
    - Ante error de red o `branch` vacío, `config` queda `null` e `isOnlineStoreVisible = false` (degradación segura)
    - Archivos: `mariam-pos-front/src/hooks/useOnlineStoreConfig.ts` (nuevo)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 7.3 Prueba de propiedad: la resolución usa los valores de la configuración
    - **Property 10: La resolución usa los valores de la configuración, no los fijos**
    - **Validates: Requirements 6.1, 6.2, 6.3**
    - Para toda config existente, los valores resueltos (`apiUrl`, `username`, `productsEndpoint`, `salesEndpoint`) son los de esa config y no constantes del código; `fc.assert(..., { numRuns: 100 })`
    - Etiqueta: `// Feature: online-store-config, Property 10: La resolución usa los valores de la configuración, no los fijos`
    - Archivo: `mariam-pos-front/src/hooks/__tests__/useOnlineStoreConfig.resolve.pbt.test.ts`

  - [ ]* 7.4 Prueba de propiedad: visibilidad bicondicional de las funciones de tienda
    - **Property 11: Visibilidad bicondicional de las funciones de tienda online**
    - **Validates: Requirements 6.4, 7.1, 7.2, 7.3, 7.4, 7.5**
    - Para toda combinación de config (ausente/presente) y `enabled`, `computeOnlineStoreVisible` es `true` si y solo si existe config y `enabled === true`; `fc.assert(..., { numRuns: 100 })`
    - Etiqueta: `// Feature: online-store-config, Property 11: Visibilidad bicondicional de las funciones de tienda online`
    - Archivo: `mariam-pos-front/src/hooks/__tests__/useOnlineStoreConfig.visibility.pbt.test.ts`

- [x] 8. Modal de configuración y su acceso desde el menú de administración
  - [x] 8.1 Crear `OnlineStoreConfigModal`
    - Leer `branch` de `localStorage` clave `sucursal`; al abrir, `getOnlineStoreConfig(branch)` y precargar los campos no sensibles (`enabled`, `apiUrl`, `storeName`, `username`, `productsEndpoint`, `salesEndpoint`)
    - Campo `password` write-only: arranca vacío aunque exista config, con placeholder "Dejar vacío para conservar la actual"; adjuntar `password` al payload solo si el admin la escribió
    - `handleSave` arma `OnlineStoreConfigPayload` y llama `saveOnlineStoreConfig` (upsert de la sucursal actual); usar design tokens (`var(--modal-*)`) en línea con los modales existentes
    - Archivo: `mariam-pos-front/src/pages/.../OnlineStoreConfigModal.tsx` (nuevo)
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 8.2 Añadir el acceso al modal desde el menú de administración del POS
    - Agregar el ítem de acceso al `OnlineStoreConfigModal` en el agrupador de ajustes del POS (p. ej. `POSConfigModal`) o, en su defecto, como ítem de ajustes en `POSPage.tsx`
    - El acceso a la configuración es independiente de la visibilidad del módulo de tienda: el admin siempre puede entrar a configurar, incluso con la tienda deshabilitada o sin configurar
    - Archivo: `mariam-pos-front/src/pages/.../POSPage.tsx`
    - _Requirements: 5.1_

  - [ ]* 8.3 Prueba de ejemplo del render del modal
    - Verifica que precarga los campos no sensibles, que el campo de contraseña arranca vacío, y que al guardar sin contraseña el payload no incluye `password` (React Testing Library)
    - Archivo: `mariam-pos-front/src/pages/.../__tests__/onlineStoreConfigModal.render.test.tsx`
    - _Requirements: 5.3, 5.4, 5.6_

- [x] 9. Integración de visibilidad y reemplazo de credenciales fijas
  - [x] 9.1 Propagar la visibilidad al pie de ventas y al acceso del módulo
    - En `salesPage.tsx`, derivar `showOnlineSales` de `useOnlineStoreConfig().isOnlineStoreVisible` y pasarlo al `Footer`
    - En `Footer.tsx`, ocultar el botón "Cobrar en línea" cuando `showOnlineSales` es `false`
    - En `POSPage.tsx`, renderizar el acceso al módulo de tienda (`OnlineStoreModal`) solo si `isOnlineStoreVisible`
    - Archivos: `mariam-pos-front/src/pages/sales/salesPage.tsx`, `mariam-pos-front/src/pages/sales/Footer.tsx`, `mariam-pos-front/src/pages/.../POSPage.tsx`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 9.2 Reemplazar las credenciales fijas en `OnlineStoreModal`
    - Eliminar los hardcodes `DEFAULT_ONLINE_STORE_EMAIL` y `DEFAULT_ONLINE_STORE_PASSWORD`; tomar `username` de `useOnlineStoreConfig`
    - El login usa el `username` de la config; el front no recibe la contraseña en claro desde el GET
    - Archivo: `mariam-pos-front/src/components/OnlineStoreModal.tsx`
    - _Requirements: 6.2_

  - [ ]* 9.3 Prueba de ejemplo de la visibilidad en el pie de ventas
    - Verifica que el botón "Cobrar en línea" se oculta sin config y con `enabled === false`, y se muestra con config y `enabled === true` (React Testing Library)
    - Archivo: `mariam-pos-front/src/pages/sales/__tests__/footer.onlineVisibility.test.tsx`
    - _Requirements: 7.1, 7.3, 7.5_

- [x] 10. Checkpoint - Asegurar que las pruebas del frontend pasan
  - Ejecutar `vitest run` en `mariam-pos-front`. Ensure all tests pass, ask the user if questions arise.

- [x] 11. Documentar el runbook de aplicación del esquema y la variable de entorno
  - Documentar el procedimiento `npx prisma db push` (no `migrate dev`, por el historial de migraciones no reproducible), con respaldo previo del archivo SQLite y la nota de que se ejecuta solo tras confirmación explícita del usuario; como el modelo `OnlineStoreConfig` es nuevo, solo agrega la tabla sin tocar datos previos
  - Documentar la variable de entorno `ONLINE_STORE_CRYPTO_KEY` (secreto de alta entropía, derivada a 32 bytes para AES-256): su ausencia bloquea cifrado/descifrado con error descriptivo pero no impide consultar la config
  - Archivo: `.kiro/specs/online-store-config/schema-apply-runbook.md` (nuevo)
  - _Requirements: 1.5, 2.3_

- [x] 12. Checkpoint final - Asegurar que toda la suite pasa
  - Ejecutar `vitest run` en `mariam-pos-backend` y en `mariam-pos-front`. Ensure all tests pass, ask the user if questions arise.

## Notes

- Las tareas marcadas con `*` son opcionales (pruebas de propiedad y de ejemplo) y pueden omitirse para un MVP más rápido.
- Cada una de las 11 propiedades de corrección del diseño se implementa como una única prueba de propiedad con `fast-check` y `{ numRuns: 100 }`, etiquetada con `// Feature: online-store-config, Property {n}: ...`.
- Las pruebas de propiedad del backend usan un mock/stub del cliente Prisma; el cifrado real (`cryptoService`) se ejercita directamente en las propiedades 1, 2, 3 y 9.
- Las partes de UI (render del modal, visibilidad del pie de ventas) se cubren con pruebas de ejemplo, no con PBT.
- La aplicación del esquema vía `prisma db push` y la definición de `ONLINE_STORE_CRYPTO_KEY` son procedimientos manuales documentados (tarea 11), no automatizados, y el `db push` requiere confirmación explícita del usuario.
- Cada tarea referencia cláusulas específicas de requisitos para trazabilidad.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2.1"] },
    { "id": 1, "tasks": ["2.2", "2.3", "3.1", "3.5", "3.9", "6", "7.1"] },
    { "id": 2, "tasks": ["3.2", "3.3", "3.4", "3.6", "3.7", "3.8", "3.10", "4", "7.2"] },
    { "id": 3, "tasks": ["7.3", "7.4", "8.1", "9.2"] },
    { "id": 4, "tasks": ["8.2", "9.1"] },
    { "id": 5, "tasks": ["8.3", "9.3"] },
    { "id": 6, "tasks": ["11"] }
  ]
}
```
