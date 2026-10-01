-- Cajero que registró la venta (auditoría).
-- Columna opcional; las ventas existentes quedan con NULL.
ALTER TABLE "Sale" ADD COLUMN "createdBy" TEXT;
