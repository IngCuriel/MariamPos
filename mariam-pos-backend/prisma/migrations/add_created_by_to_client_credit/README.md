# Migración: agregar `createdBy` a `ClientCredit`

## Qué hace
Agrega la columna opcional `createdBy` (TEXT / String?) a la tabla `ClientCredit`.
Guarda el **nombre del cajero que registró el crédito** (la venta que lo generó).

Es una migración **aditiva y segura**:
- Columna nullable, sin valor por defecto obligatorio.
- No modifica ni borra datos existentes.
- Los créditos creados **antes** de esta migración quedan con `createdBy = NULL`
  y se muestran como "Cajero no registrado" en la UI.

## Cómo aplicar la migración

La base del POS es **SQLite** (`provider = "sqlite"`), y el archivo de base
suele ser local por caja/servidor (según `DATABASE_URL` en el `.env`).

### Opción recomendada (Prisma)
Desde la carpeta del backend (`mariam-pos-backend`), con el `.env` apuntando
a la base correcta:

```bash
# 1. Aplica las migraciones pendientes a la base productiva
npx prisma migrate deploy

# 2. Regenera el cliente Prisma (para que el código conozca la columna nueva)
npx prisma generate
```

`migrate deploy` aplica únicamente las migraciones que falten, sin recrear
la base ni tocar datos. Es el comando correcto para entornos ya en uso.

### Alternativa manual (si no se usa el flujo de migraciones)
Si preferís correr el SQL directo sobre el archivo `.db` (por ejemplo con la
CLI de sqlite3 o un cliente gráfico):

```sql
ALTER TABLE "ClientCredit" ADD COLUMN "createdBy" TEXT;
```

Es idempotente en la práctica: si la columna ya existe, SQLite devuelve un
error de "duplicate column" y no cambia nada. En ese caso, ignorar el error.

## Importante en despliegue con varias cajas
Si cada caja/servidor tiene su **propia base SQLite local**, hay que aplicar la
migración en **cada una** (no hay una base central). Repetir `npx prisma migrate
deploy` en cada equipo tras actualizar el backend.

## Verificación
Después de aplicar:

```sql
-- Debe listar la columna createdBy
PRAGMA table_info("ClientCredit");
```

En la app: registrar una venta a crédito con un cajero seleccionado y abrir el
modal "Registrar Abono" de ese crédito. Debe mostrar el cajero en
"Registrado por". Los créditos viejos mostrarán "Cajero no registrado".

## Rollback (si fuera necesario)
SQLite no soporta `DROP COLUMN` en versiones viejas. Si necesitás revertir en
una versión que sí lo soporte:

```sql
ALTER TABLE "ClientCredit" DROP COLUMN "createdBy";
```

En versiones sin `DROP COLUMN`, la columna puede dejarse (es nullable y no
afecta el funcionamiento anterior).
