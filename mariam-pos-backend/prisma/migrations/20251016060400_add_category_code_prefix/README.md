# Migración: add_category_code_prefix

Crea la tabla `CategoryCodePrefix` para el catálogo de prefijos de código por categoría.

## Qué agrega

- Tabla `CategoryCodePrefix` con relación 1:1 a `Category` (`categoryId` único).
- Campos: `prefix`, `lastNumber` (consecutivo), `padding` (ceros a la izquierda), sync/branch.

## Cómo funciona

- Cada categoría puede tener un prefijo (ej: `ABA-REF`).
- Al crear un producto SIN código manual, el backend genera `PREFIX-001`, `PREFIX-002`…
- El consecutivo (`lastNumber`) se **reserva al guardar** el producto (dentro de la transacción),
  no al generarlo en pantalla. Así no quedan huecos si el usuario cancela.

## Cómo aplicar

Desde `mariam-pos-backend`, con el backend DETENIDO (el lock del query engine hace fallar `generate`):

```bash
npx prisma migrate deploy
npx prisma generate
```

Luego reiniciar el backend.

> Si hay varias cajas, aplicar en CADA una (cada caja tiene su propia base SQLite local).

## Alternativa (aplicar el SQL directo)

Si `migrate deploy` no toma esta carpeta manual, ejecutar el contenido de `migration.sql`
directamente sobre la base `database.db` con un cliente SQLite, y luego `npx prisma generate`.
