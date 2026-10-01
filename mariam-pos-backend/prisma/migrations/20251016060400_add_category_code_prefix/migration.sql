-- Migración: catálogo de prefijos de código por categoría
-- Crea la tabla CategoryCodePrefix (1:1 con Category).
-- El consecutivo (lastNumber) se reserva al guardar un producto.

CREATE TABLE "CategoryCodePrefix" (
    "id"         INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoryId" TEXT    NOT NULL,
    "prefix"     TEXT    NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "padding"    INTEGER NOT NULL DEFAULT 3,
    "syncStatus" TEXT    NOT NULL DEFAULT 'pendiente',
    "branch"     TEXT    DEFAULT 'Sucursal Default',
    "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  DATETIME NOT NULL,
    CONSTRAINT "CategoryCodePrefix_categoryId_fkey"
        FOREIGN KEY ("categoryId") REFERENCES "Category" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Una categoría solo puede tener un prefijo.
CREATE UNIQUE INDEX "CategoryCodePrefix_categoryId_key" ON "CategoryCodePrefix"("categoryId");

CREATE INDEX "CategoryCodePrefix_prefix_idx"     ON "CategoryCodePrefix"("prefix");
CREATE INDEX "CategoryCodePrefix_syncStatus_idx" ON "CategoryCodePrefix"("syncStatus");
