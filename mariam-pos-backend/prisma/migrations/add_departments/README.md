# Migración: catálogo de Departamentos

## Qué hace
- Crea la tabla `Department` (agrupa categorías: Papelería, Abarrotes, etc.).
- Agrega la columna opcional `departmentId` a `Category` para relacionar una
  categoría con su departamento.

Estructura: **Departamento → Categoría → Producto**. El producto no cambia:
sigue apuntando a su categoría; el departamento se deduce por la categoría.

Migración **aditiva y segura**:
- La tabla `Department` es nueva.
- `Category.departmentId` es nullable: las categorías existentes quedan con
  `NULL` (sin departamento). No se migra ni se borra ningún dato.
- No afecta ventas, productos, inventario ni ningún otro módulo.

## Cómo aplicar la migración

La base del POS es **SQLite** (`provider = "sqlite"`), local por caja/servidor.

### Opción recomendada (Prisma)
Desde `mariam-pos-backend`:

```bash
npx prisma migrate deploy
npx prisma generate
```

### Alternativa manual (SQL directo)
Ejecutar el contenido de `migration.sql`. Si una columna/tabla ya existe,
SQLite devuelve "duplicate"; ignorar en ese caso.

## Importante en despliegue con varias cajas
Si cada caja/servidor tiene su **propia base SQLite local**, aplicar la
migración en **cada equipo** tras actualizar el backend.

## Verificación
```sql
SELECT name FROM sqlite_master WHERE type='table' AND name='Department';
PRAGMA table_info("Category"); -- debe listar departmentId
```
