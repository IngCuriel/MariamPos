# Migración: add_price_tiers

Agrega precio escalonado por cantidad (tiered pricing).

## Qué agrega

- `Product.pricingMode` (TEXT, default "simple"): "simple" o "tiered".
- Tabla `ProductPriceTier` (productId, minQty, maxQty, unitPrice) con borrado en cascada.

## Cómo funciona

- Un producto "tiered" tiene tramos: ej. 1-10 → $5, 11-20 → $4, 21+ → $3 (maxQty null = "en adelante").
- **Escalón SIMPLE**: toda la cantidad se cobra al precio del tramo donde cae
  (15 piezas en el tramo 11-20 = 15 × $4 = $60).
- Es excluyente con presentaciones y kits: un producto es simple, por presentaciones, o tiered.

## Cómo aplicar

Desde `mariam-pos-backend`, con el backend DETENIDO:

```bash
npx prisma migrate deploy
npx prisma generate
```

Reiniciar el backend. Si hay varias cajas, aplicar en cada una.

## Alternativa

Ejecutar `migration.sql` directo sobre `database.db` con un cliente SQLite y luego `npx prisma generate`.
