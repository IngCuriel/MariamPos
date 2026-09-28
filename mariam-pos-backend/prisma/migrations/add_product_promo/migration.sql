-- Migración: promociones de producto (precio promocional fijo con fecha fin opcional)
-- Agrega isPromo, promoPrice y promoEndsAt a Product.

ALTER TABLE "Product" ADD COLUMN "isPromo"     BOOLEAN  NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "promoPrice"  REAL;
ALTER TABLE "Product" ADD COLUMN "promoEndsAt" DATETIME;
