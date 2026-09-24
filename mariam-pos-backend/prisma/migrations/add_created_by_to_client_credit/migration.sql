-- Cajero que registró el crédito (la venta que lo generó).
-- Columna opcional; los créditos existentes quedan con NULL.
ALTER TABLE "ClientCredit" ADD COLUMN "createdBy" TEXT;
