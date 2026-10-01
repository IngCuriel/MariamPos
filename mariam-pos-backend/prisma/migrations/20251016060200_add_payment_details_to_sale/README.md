# Migración: agregar detalle de cobro a `Sale`

## Qué hace
Agrega dos columnas opcionales a la tabla `Sale`:
- `amountReceived` (REAL / Float?) — **monto recibido en efectivo** (para arqueo y cálculo de cambio).
- `paymentReference` (TEXT / String?) — **folio/referencia del comprobante** cuando el pago es con tarjeta.

Migración **aditiva y segura**:
- Columnas nullable, sin valor por defecto obligatorio.
- No modifica ni borra datos existentes.
- Las ventas creadas **antes** de esta migración quedan con `NULL` en ambas.

## Cómo aplicar la migración

La base del POS es **SQLite** (`provider = "sqlite"`), local por caja/servidor
según `DATABASE_URL` en el `.env`.

### Opción recomendada (Prisma)
Desde `mariam-pos-backend`:

```bash
npx prisma migrate deploy
npx prisma generate
```

`migrate deploy` aplica solo lo pendiente, sin recrear la base ni tocar datos.

### Alternativa manual (SQL directo)
```sql
ALTER TABLE "Sale" ADD COLUMN "amountReceived" REAL;
ALTER TABLE "Sale" ADD COLUMN "paymentReference" TEXT;
```
Si una columna ya existe, SQLite devuelve "duplicate column"; ignorar en ese caso.

## Importante en despliegue con varias cajas
Si cada caja/servidor tiene su **propia base SQLite local**, aplicar la
migración en **cada equipo** tras actualizar el backend.

## Verificación
```sql
PRAGMA table_info("Sale"); -- debe listar amountReceived y paymentReference
```
En la app: cobrar una venta en efectivo (guarda `amountReceived`) y otra con
tarjeta ingresando el folio (guarda `paymentReference`).

## Nota
Aplica solo a ventas **nuevas**.
