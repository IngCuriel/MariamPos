# Migración: add_unit_of_measure

Agrega el catálogo de unidades de medida (informativo) y lo liga a productos y ventas.

## Qué agrega

- Tabla `UnitOfMeasure` (id, name, abbreviation, status, sync/branch).
- `Product.unitId` (INTEGER, opcional, FK a UnitOfMeasure con ON DELETE SET NULL).
- `SaleDetail.unitAbbrev` (TEXT, opcional): la unidad se congela al momento de la venta,
  para que el ticket histórico la conserve aunque el producto cambie después.

## Alcance

- Es solo **informativa**: no afecta inventario ni cálculos de precio.
- La venta a granel (decimales) sigue funcionando igual que antes.

## Cómo aplicar

Desde `mariam-pos-backend`, con el backend DETENIDO (el lock del query engine hace fallar `generate`):

```bash
npx prisma migrate deploy
npx prisma generate
```

Luego reiniciar el backend.

> Si hay varias cajas, aplicar en CADA una (cada caja tiene su propia base SQLite local).

## Alternativa (aplicar el SQL directo)

Si `migrate deploy` no toma esta carpeta manual, ejecutar `migration.sql` directamente
sobre `database.db` con un cliente SQLite y luego `npx prisma generate`.
