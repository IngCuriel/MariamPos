# Migración: add_product_promo

Agrega promociones a los productos (precio promocional fijo, con fecha fin opcional).

## Qué agrega

- `Product.isPromo` (BOOLEAN, default false): si el producto está en promoción.
- `Product.promoPrice` (REAL, opcional): precio promocional (debe ser menor al precio real).
- `Product.promoEndsAt` (DATETIME, opcional): hasta cuándo aplica. null = sin vencimiento (manual).

## Cómo funciona

- Un producto en promoción VIGENTE (isPromo true, promoPrice válido, y sin fecha fin
  o fecha fin en el futuro) se vende automáticamente al precio promocional.
- El botón "Promociones" en la venta lista estos productos (endpoint GET /api/products/promotions).
- Los productos existentes quedan con isPromo = false (sin promoción). No truena nada.

## Cómo aplicar

Desde `mariam-pos-backend`, con el backend DETENIDO:

```bash
npx prisma migrate deploy
npx prisma generate
```

Reiniciar backend. Si hay varias cajas, aplicar en cada una.

## Alternativa

Ejecutar `migration.sql` directo sobre `database.db` con un cliente SQLite y luego `npx prisma generate`.
