-- Detalle de cobro en la venta:
--   amountReceived   = monto recibido en efectivo (para arqueo/cambio)
--   paymentReference = folio/referencia del comprobante (pago con tarjeta)
-- Columnas opcionales; las ventas existentes quedan con NULL.
ALTER TABLE "Sale" ADD COLUMN "amountReceived" REAL;
ALTER TABLE "Sale" ADD COLUMN "paymentReference" TEXT;
