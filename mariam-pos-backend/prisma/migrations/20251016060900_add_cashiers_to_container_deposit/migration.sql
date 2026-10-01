-- Auditoría de cajeros en depósitos de envases:
--   createdBy  = cajero que registró/dio el envase
--   returnedBy = cajero que regresó el importe
-- Columnas opcionales; los depósitos existentes quedan con NULL.
ALTER TABLE "ClientContainerDeposit" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "ClientContainerDeposit" ADD COLUMN "returnedBy" TEXT;
