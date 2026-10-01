# Migración: asociar abonos a créditos con su turno de caja

## Qué hace
Agrega una columna opcional a la tabla `CreditPayment`:
- `shiftId` (INTEGER / Int?) — **turno de caja en el que se recibió el abono**.

Y crea el índice `CreditPayment_shiftId_idx` para consultas por turno.

Migración **aditiva y segura**:
- Columna nullable, sin valor por defecto obligatorio.
- No modifica ni borra datos existentes.
- Los abonos creados **antes** de esta migración quedan con `shiftId = NULL`.

## Por qué
Antes, el resumen de un turno buscaba los abonos cruzando "abonos del período"
con "créditos generados en ese mismo turno". Eso perdía un caso real:

> El crédito se generó en el **turno A** y el cliente abonó en el **turno B**.

Ese abono entró en efectivo a la caja del turno B, pero no aparecía en su corte
porque el crédito no pertenecía al turno B. Con `shiftId` guardado en el propio
abono, el corte cuenta exactamente los abonos cobrados en ese turno, sin importar
cuándo nació el crédito.

Como puede haber **varias cajas con turnos abiertos a la vez**, no alcanza con
filtrar por fecha (`createdAt`): dos turnos simultáneos comparten franja horaria.
Por eso el turno se guarda de forma explícita.

## Cómo se asigna el turno
El **backend** resuelve el turno activo (status `OPEN`) de la caja
(`branch` + `cashRegister` que envía el front al abonar) y guarda su `id` en
`shiftId`. El front no manda el turno directamente para evitar valores desfasados.

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
ALTER TABLE "CreditPayment" ADD COLUMN "shiftId" INTEGER;
CREATE INDEX "CreditPayment_shiftId_idx" ON "CreditPayment"("shiftId");
```
Si la columna ya existe, SQLite devuelve "duplicate column"; ignorar en ese caso.

## Importante en despliegue con varias cajas
Si cada caja/servidor tiene su **propia base SQLite local**, aplicar la
migración en **cada equipo** tras actualizar el backend.

## Verificación
```sql
PRAGMA table_info("CreditPayment"); -- debe listar shiftId
```
En la app: generar un crédito en un turno, cerrarlo, abrir otro turno en la
misma caja y abonar. El abono debe aparecer en el corte del turno donde se cobró.

## Nota
Aplica solo a abonos **nuevos**. Los abonos históricos (`shiftId = NULL`) siguen
siendo visibles por el fallback de fecha en el resumen (ver `getShiftSummary`).
