-- Migración: catálogo de unidades de medida (informativo)
-- Crea la tabla UnitOfMeasure, agrega Product.unitId y SaleDetail.unitAbbrev.
-- No afecta inventario ni cálculos; la unidad es solo descriptiva.

CREATE TABLE "UnitOfMeasure" (
    "id"           INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name"         TEXT     NOT NULL,
    "abbreviation" TEXT     NOT NULL,
    "status"       INTEGER,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    DATETIME NOT NULL,
    "syncStatus"   TEXT     NOT NULL DEFAULT 'pendiente',
    "branch"       TEXT     DEFAULT 'Sucursal Default'
);

CREATE INDEX "UnitOfMeasure_abbreviation_idx" ON "UnitOfMeasure"("abbreviation");
CREATE INDEX "UnitOfMeasure_status_idx"       ON "UnitOfMeasure"("status");
CREATE INDEX "UnitOfMeasure_syncStatus_idx"   ON "UnitOfMeasure"("syncStatus");

-- Product.unitId (opcional, FK a UnitOfMeasure)
ALTER TABLE "Product" ADD COLUMN "unitId" INTEGER REFERENCES "UnitOfMeasure" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Product_unitId_idx" ON "Product"("unitId");

-- SaleDetail.unitAbbrev (unidad congelada al momento de la venta)
ALTER TABLE "SaleDetail" ADD COLUMN "unitAbbrev" TEXT;
