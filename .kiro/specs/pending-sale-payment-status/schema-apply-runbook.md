# Runbook: Aplicación del esquema de Prisma

Feature: `pending-sale-payment-status` · Requisito: 10.5

Este runbook describe el procedimiento manual para aplicar los cambios de esquema
de esta feature a la base de datos SQLite del backend. El procedimiento es manual
y controlado: **no se automatiza y se ejecuta únicamente tras confirmación explícita
del usuario**.

## 1. Propósito y cuándo ejecutarlo

Los modelos `PendingSale` y `Sale` se extienden con campos de estado y trazabilidad
(ver tarea 1 del plan y la sección "Data Models" del diseño):

- `PendingSale`: `status` (`@default("PENDING")`), `createdBy`, `paidAt`, `paidSaleId`,
  `paidCashRegister`, `paidBy`, más los índices `@@index([status])` y `@@index([cashRegister])`.
- `Sale`: `origin` (`@default("DIRECT")`), `sourceCashRegister`, `onlineOrderId`,
  más el índice `@@index([origin])`.

**Cuándo ejecutarlo:** una vez aprobada esta feature y **antes** de usar en producción
cualquier funcionalidad que dependa de los nuevos campos de estado/origen (marcado de
folios como `PAID`, filtrado por estado/caja, origen de venta).

Todos los campos nuevos son **opcionales o tienen `@default`**, por lo que la aplicación
del esquema **no requiere migración de datos** (Req 10.1–10.4). Los registros existentes
quedan válidos: un `PendingSale` previo sin `status` se interpreta como `PENDING` y un
`Sale` previo sin `origin` se interpreta como `DIRECT`, gracias a los valores por defecto.

## 2. Prerrequisitos

- Node.js y las dependencias del backend instaladas (`npm install` en `mariam-pos-backend`).
- Ubicar el archivo de base de datos SQLite:
  - La fuente de verdad es `datasource db` en `mariam-pos-backend/prisma/schema.prisma`,
    cuyo `url` es `env("DATABASE_URL")`.
  - En `mariam-pos-backend/.env`: `DATABASE_URL="file:./database.db"`. La ruta es relativa
    al directorio `prisma/`, por lo que el archivo real es:
    **`mariam-pos-backend/prisma/database.db`**.
  - Verificar el valor real en el entorno donde se vaya a aplicar antes de continuar
    (puede diferir en despliegues empaquetados).
- **Detener el backend** y cualquier proceso que tenga abierta la base de datos antes de
  respaldar y aplicar, para evitar copias inconsistentes o bloqueos del archivo.
- Contar con la **confirmación explícita del usuario** para ejecutar el push.

## 3. Respaldo previo (obligatorio)

Copiar el archivo SQLite a un respaldo con marca de tiempo **antes** de aplicar el esquema.
Ejecutar desde el directorio `mariam-pos-backend/prisma/`.

PowerShell (Windows):

```powershell
Copy-Item .\database.db ".\database.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss').db"
```

Bash (Linux/macOS):

```bash
cp ./database.db "./database.backup.$(date +%Y%m%d-%H%M%S).db"
```

Si existen archivos auxiliares de SQLite (`database.db-wal`, `database.db-shm`), respaldarlos
también junto con el archivo principal.

## 4. Aplicación del esquema

Ejecutar desde el directorio del paquete backend (`mariam-pos-backend`):

```bash
npx prisma db push
```

Si el cliente de Prisma no se regenera automáticamente, generarlo:

```bash
npx prisma generate
```

`db push` sincroniza el esquema declarado en `schema.prisma` con la base de datos:
agrega las columnas e índices nuevos con sus valores por defecto, sin borrar datos
existentes (al tratarse de campos opcionales o con `@default`).

## 5. Nota importante sobre el método

- **Usar `npx prisma db push`.**
- **NO usar `npx prisma migrate dev`.** El proyecto no mantiene un historial de migraciones
  reproducible, por lo que `migrate dev` podría intentar reconstruir el estado y generar
  resultados no deseados. `db push` es el método correcto para este esquema.
- Ejecutar el push **solo tras confirmación explícita del usuario**. No forma parte de
  ningún script automático ni de los checkpoints de pruebas.

## 6. Verificación posterior

1. **Conteos antes/después:** registrar el número de filas de `PendingSale` y `Sale` antes
   de aplicar y confirmar que coinciden después (ningún dato debe perderse).

   ```bash
   # Ejemplo con el cliente sqlite3 (desde mariam-pos-backend/prisma)
   sqlite3 database.db "SELECT COUNT(*) FROM PendingSale; SELECT COUNT(*) FROM Sale;"
   ```

2. **Columnas nuevas presentes:** confirmar que existen las columnas agregadas.

   ```bash
   sqlite3 database.db "PRAGMA table_info(PendingSale);"
   sqlite3 database.db "PRAGMA table_info(Sale);"
   ```

3. **Valores por defecto en registros heredados:** confirmar que los registros previos sin
   valor explícito se interpretan como `PENDING` / `DIRECT`. En SQLite, las filas existentes
   reciben el valor por defecto de la columna nueva al aplicarse el esquema.

   ```bash
   sqlite3 database.db "SELECT DISTINCT status FROM PendingSale;"  # esperado: PENDING (y PAID si aplica)
   sqlite3 database.db "SELECT DISTINCT origin FROM Sale;"         # esperado: DIRECT (y otros si aplica)
   ```

4. **Prueba funcional mínima:** iniciar el backend y confirmar que `getPendingSales` responde
   e incluye las claves de estado/trazabilidad, y que una lectura de ventas funciona sin error.

> Nota: la verificación automatizada de preservación de datos se cubre en la prueba de
> integración de la tarea 13.1 (`schema.compat.integration.test.js`), que compara conteos y
> valores antes/después sobre una copia sembrada de la base.

## 7. Rollback

Si algo sale mal (error al aplicar, verificación fallida o comportamiento inesperado):

1. Detener el backend.
2. Restaurar el respaldo creado en el paso 3, sobrescribiendo el archivo actual.

   PowerShell (Windows):

   ```powershell
   Copy-Item ".\database.backup.<marca-de-tiempo>.db" .\database.db -Force
   ```

   Bash (Linux/macOS):

   ```bash
   cp "./database.backup.<marca-de-tiempo>.db" ./database.db
   ```

3. Restaurar también los archivos auxiliares (`-wal`, `-shm`) si se respaldaron.
4. Reiniciar el backend y verificar que la aplicación opera con el esquema anterior.

Conservar el respaldo hasta confirmar que el nuevo esquema funciona de forma estable.
