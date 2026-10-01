# Migración: auditoría de cajeros en depósitos de envases

## Qué hace
Agrega dos columnas opcionales a la tabla `ClientContainerDeposit`:
- `createdBy` (TEXT / String?) — **cajero que registró/dio el envase**.
- `returnedBy` (TEXT / String?) — **cajero que regresó el importe**.

Migración **aditiva y segura**:
- Columnas nullable, sin valor por defecto obligatorio.
- No modifica ni borra datos existentes.
- Los depósitos creados **antes** de esta migración quedan con `NULL` en ambas.

## Por qué
En la pantalla "Recuperar Envases" se necesita ver quién dio el envase y quién
regresó el importe. Antes solo se guardaba el turno (`shiftId`), no el cajero
que realizó cada acción.

## Cómo aplicar la migración

La base del POS es **SQLite** (`provider = "sqlite"`), local por caja/servidor
según `DATABASE_URL` en el `.env`.

### Opción recomendada (Prisma)
Desde `mariam-pos-backend`:

```bash
npx prisma migrate deploy
npx prisma generate
```

### Alternativa manual (SQL directo)
```sql
ALTER TABLE "ClientContainerDeposit" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "ClientContainerDeposit" ADD COLUMN "returnedBy" TEXT;
```
Si una columna ya existe, SQLite devuelve "duplicate column"; ignorar en ese caso.

## Importante en despliegue con varias cajas
Si cada caja/servidor tiene su **propia base SQLite local**, aplicar la
migración en **cada equipo** tras actualizar el backend.

## Verificación
```sql
PRAGMA table_info("ClientContainerDeposit"); -- debe listar createdBy y returnedBy
```

## Nota
Aplica solo a depósitos **nuevos**. Los históricos (`createdBy`/`returnedBy` NULL)
mostrarán "—" en la pantalla.
