import React from "react";

import type { ReversalReceipt } from "../../types/index";

interface CancellationReturnReceiptProps {
  receipt: ReversalReceipt;
}

/**
 * Comprobante imprimible de una cancelación o devolución (Req 10).
 * Reutiliza el patrón/estilo de `Ticket.tsx`: contenedor monospace #ticket-content,
 * encabezado centrado, separadores <hr /> y pie con el monto devuelto.
 *
 * Se rotula claramente como CANCELACIÓN o DEVOLUCIÓN según `receipt.type` (Req 10.3).
 */
const CancellationReturnReceipt: React.FC<CancellationReturnReceiptProps> = ({ receipt }) => {
  const isReturn = receipt.type === "DEVOLUCION";
  const title = isReturn ? "DEVOLUCIÓN" : "CANCELACIÓN";

  // Formatea la fecha/hora ISO al mismo formato localizado que usa Ticket.tsx.
  const dateFormat = (iso: string) => {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return iso;
    // Ejemplo: "28/10/2025 11:19 p.m."
    return fecha.toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const isMerma = receipt.reasonType === "merma";
  const returnedLines = isReturn ? receipt.lines ?? [] : [];
  const totalReturnedUnits = returnedLines.reduce((sum, line) => sum + (line.quantity || 0), 0);

  return (
    <div
      id="cancellation-return-receipt"
      style={{
        width: "100%",
        padding: "8px",
        fontFamily: "monospace",
        fontSize: "12px",
        background: "white",
        color: "black",
        boxSizing: "border-box",
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Encabezado: rótulo claro de la operación (Req 10.3) */}
      <div>
        <h3 style={{ textAlign: "center", margin: 0, letterSpacing: "1px" }}>{title}</h3>
        <p style={{ textAlign: "center", margin: "4px 0", fontWeight: "bold" }}>
          COMPROBANTE DE {title}
        </p>
        {receipt.branch && (
          <p style={{ textAlign: "center", margin: "4px 0" }}>{receipt.branch}</p>
        )}
        <hr />
        <p style={{ display: "flex", justifyContent: "space-between", gap: "12px", margin: "4px 0" }}>
          <span>Folio venta: {receipt.originalFolio ?? "N/D"}</span>
          <span>Fecha: {dateFormat(receipt.dateTime)}</span>
        </p>
        <hr />
      </div>

      {/* Datos de la operación */}
      <div style={{ margin: "8px 0" }}>
        {receipt.cashier && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span>Cajera:</span>
            <span>{receipt.cashier}</span>
          </div>
        )}
        {receipt.cashRegister && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span>Caja:</span>
            <span>{receipt.cashRegister}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
          <span>Motivo:</span>
          <span style={{ textAlign: "right", flex: 1, marginLeft: "8px" }}>{receipt.reason}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
          <span>Tipo de motivo:</span>
          <span>{isMerma ? "Merma" : "Estándar"}</span>
        </div>
      </div>

      {/* Líneas devueltas (solo en devolución) */}
      {isReturn && (
        <div style={{ flex: 1, overflowX: "hidden", margin: "8px 0" }}>
          <hr />
          <p style={{ fontWeight: "600", margin: "6px 0" }}>Productos devueltos:</p>
          {returnedLines.length === 0 ? (
            <p style={{ textAlign: "center", color: "#666", margin: "8px 0" }}>
              Sin líneas registradas
            </p>
          ) : (
            returnedLines.map((line, index) => (
              <div
                key={`${line.productName}-${index}`}
                style={{
                  marginBottom: "8px",
                  paddingBottom: "8px",
                  paddingLeft: "24px",
                  borderBottom: "1px solid #eee",
                  position: "relative",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: "0",
                    fontWeight: "600",
                    color: "#666",
                  }}
                >
                  {index + 1}.
                </span>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "8px",
                  }}
                >
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <span style={{ fontWeight: "500" }}>{line.productName}</span>
                    <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
                      Cantidad: {line.quantity}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", whiteSpace: "nowrap", fontWeight: "600" }}>
                    ${line.subTotal.toFixed(2)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pie del comprobante */}
      <div style={{ marginTop: "8px" }}>
        <hr />
        {isReturn && returnedLines.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span style={{ fontWeight: "600" }}>Total de productos:</span>
            <span style={{ fontWeight: "600" }}>{totalReturnedUnits}</span>
          </div>
        )}
        <p style={{ textAlign: "right", fontWeight: "bold", marginTop: "8px" }}>
          Monto devuelto: ${receipt.refundedAmount.toFixed(2)}
        </p>
        {receipt.refundedAmount <= 0 && (
          <p style={{ textAlign: "center", color: "#666", margin: "4px 0" }}>
            No se devolvió efectivo
          </p>
        )}
        <hr />
        <p style={{ textAlign: "center" }}>Este comprobante no es una venta.</p>
        <p style={{ textAlign: "center" }}>Conserve este comprobante.</p>
      </div>
    </div>
  );
};

export default CancellationReturnReceipt;
