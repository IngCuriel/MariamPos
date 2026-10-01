# Migración: agregar `createdBy` a `Sale`

## Qué hace
Agrega la columna opcional `createdBy` (TEXT / String?) a la tabla `Sale`.
Guarda el **nombre del cajero que registró la venta** (todas las ventas, no solo las de crédito).

Migración **aditiva y segura**:
- Columna nullable, sin valor por defecto obligatorio.
- No modifica ni borra datos existentes.
- Las ventas creadas **antes** de esta migración quedan con `createdBy = NULL`.

## Cómo aplicar la migración

La base del POS es **SQLite** (`provider = "sqlite"`), y el archivo de base
suele ser local por caja/servidor (según `DATABASE_URL` en el `.env`).

### Opción recomendada (Prisma)
Desde `mariam-pos-backend`, con el `.env` apuntando a la base correcta:

```bash
# 1. Aplica las migraciones pendientes
npx prisma migrate deploy

# 2. Regenera el cliente Prisma
npx prisma generate
```

`migrate deploy` aplica solo lo que falte, sin recrear la base ni tocar datos.

### Alternativa manual (SQL directo)
```sql
ALTER TABLE "Sale" ADD COLUMN "createdBy" TEXT;
```
Si la columna ya existe, SQLite devuelve "duplicate column"; ignorar en ese caso.

## Importante en despliegue con varias cajas
Si cada caja/servidor tiene su **propia base SQLite local**, aplicar la
migración en **cada equipo** tras actualizar el backend.

## Verificación
```sql
PRAGMA table_info("Sale"); -- debe listar createdBy
```
En la app: registrar una venta con un cajero seleccionado y revisar en la base
(o en reportes) que `createdBy` quede con el nombre del cajero.

## Nota
Aplica solo a ventas **nuevas**. Las ventas históricas tendrán `createdBy = NULL`.
Estas dos migraciones (`add_created_by_to_client_credit` y `add_created_by_to_sale`)
se aplican juntas con un solo `npx prisma migrate deploy`.
