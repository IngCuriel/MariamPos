-- Migración: precio escalonado por cantidad (tiered pricing)
-- Agrega Product.pricingMode y crea la tabla ProductPriceTier.

-- Modo de precio del producto: "simple" (default) o "tiered".
ALTER TABLE "Product" ADD COLUMN "pricingMode" TEXT NOT NULL DEFAULT 'simple';

-- Tramos de precio por cantidad (ej: 1-10 => $5, 11-20 => $4, 21+ => $3).
CREATE TABLE "ProductPriceTier" (
    "id"         INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId"  INTEGER  NOT NULL,
    "minQty"     INTEGER  NOT NULL,
    "maxQty"     INTEGER,
    "unitPrice"  REAL     NOT NULL,
    "syncStatus" TEXT     NOT NULL DEFAULT 'pendiente',
    "branch"     TEXT     DEFAULT 'Sucursal Default',
    "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  DATETIME NOT NULL,
    CONSTRAINT "ProductPriceTier_productId_fkey"
        FOREIGN KEY ("productId") REFERENCES "Product" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ProductPriceTier_productId_idx"  ON "ProductPriceTier"("productId");
CREATE INDEX "ProductPriceTier_syncStatus_idx" ON "ProductPriceTier"("syncStatus");
