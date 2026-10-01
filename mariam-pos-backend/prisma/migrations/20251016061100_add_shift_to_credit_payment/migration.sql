-- Turno de caja en el que se recibió el abono a un crédito.
-- Permite que el corte de un turno cuente los abonos cobrados en ESE turno,
-- aunque el crédito se haya generado en un turno anterior.
-- Columna opcional; los abonos existentes quedan con NULL.
ALTER TABLE "CreditPayment" ADD COLUMN "shiftId" INTEGER;

CREATE INDEX "CreditPayment_shiftId_idx" ON "CreditPayment"("shiftId");
