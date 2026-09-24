import React from "react";

import type {Sale} from '../../types/index'

interface TicketProps { 
    sale:Sale
    /** Monto que quedó a crédito en esta venta (si aplica). */
    creditAmount?: number
    /** Importe de depósito de envases generado en esta venta (si aplica). */
    containerAmount?: number
}

const Ticket: React.FC<TicketProps> = ({sale, creditAmount = 0, containerAmount = 0}) => {
  console.log('sale ticker', sale)
  const dateFormat = (date: Date)=> {
    const fecha = new Date(date);
    // Ejemplo: "28/10/2025 11:19 p.m."
    const fechaFormateada = fecha.toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    return fechaFormateada;
  }

  // Calcular total de productos (suma de todas las cantidades)
  const totalProducts = sale?.details?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
  return (
    <div
      id="ticket-content"
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
      {/* Encabezado */}
      <div>
        <h3 style={{ textAlign: "center", margin: 0 }}>{sale.branch}</h3>
        <p style={{ textAlign: "center", margin: "4px 0" }}>Cliente: {sale.clientName}</p>
        {/*<p style={{ textAlign: "center", margin: "4px 0" }}>Progreso 10, entro, Yutanduchi de Guerrero, Oax.</p>*/}
        <hr />
        <p style={{ display: "flex", justifyContent: "space-between", gap: "12px", margin: "4px 0" }}>
          <span>Folio: {sale.id}</span>
          <span>Fecha: {dateFormat(sale.createdAt)}</span>
        </p>
        <hr />
      </div>

      {/* Lista de productos (crece para empujar el pie abajo; el scroll es del contenedor) */}
      <div style={{ 
        flex: 1,
        overflowX: "hidden",
        margin: "8px 0",
      }}>
        <div style={{ 
          margin: 0, 
          paddingLeft: "0",
        }}>
          {sale?.details?.map((item, index) => (
            <div key={item.id} style={{ 
              marginBottom: "8px",
              paddingBottom: "8px",
              paddingLeft: "24px",
              borderBottom: "1px solid #eee",
              position: "relative",
            }}>
              {/* Número de lista manual */}
              <span style={{
                position: "absolute",
                left: "0",
                fontWeight: "600",
                color: "#666",
              }}>
                {index + 1}.
              </span>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <span style={{ fontWeight: "500" }}>{item.productName}</span>
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
                   Cantidad: {item.quantity} x  Precio U: ${item.price.toFixed(2)}
                  </div>
                </div>
                <div style={{ textAlign: "right", whiteSpace: "nowrap", fontWeight: "600" }}>
                  ${(item.price * item.quantity).toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pie del ticket */}
      <div style={{ marginTop: "8px" }}>
        <hr />
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
          <span style={{ fontWeight: "600" }}>Total de productos:</span>
          <span style={{ fontWeight: "600" }}>{totalProducts}</span>
        </div>
        <p style={{ textAlign: "right", fontWeight: "bold", marginTop: "8px" }}>
          Total: ${sale.total.toFixed(2)}
        </p>
        {creditAmount > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Pagado:</span>
              <span>${Math.max(sale.total - creditAmount, 0).toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
              <span>A crédito:</span>
              <span>${creditAmount.toFixed(2)}</span>
            </div>
          </>
        )}
        {containerAmount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>🍺 Depósito de envases:</span>
            <span>${containerAmount.toFixed(2)}</span>
          </div>
        )}
        <p style={{ textAlign: "right", fontWeight: "bold" }}>
          {sale.paymentMethod}
        </p>
        {sale.amountReceived != null && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Recibido:</span>
              <span>${sale.amountReceived.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Cambio:</span>
              <span>${Math.max(sale.amountReceived - sale.total - containerAmount, 0).toFixed(2)}</span>
            </div>
          </>
        )}
        {sale.paymentReference && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Ref. comprobante:</span>
            <span>{sale.paymentReference}</span>
          </div>
        )}
        <hr />
        {sale.shift?.shiftNumber && (
          <p style={{ textAlign: "center", margin: "4px 0" }}>Turno: {sale.shift.shiftNumber}</p>
        )}
        <p style={{ textAlign: "center" }}>¡Gracias por su compra!</p>
        {sale.createdBy && (
          <p style={{ textAlign: "center", margin: "4px 0" }}>Te atendió: {sale.createdBy}</p>
        )}
        <p style={{ textAlign: "center" }}>Vuelva pronto</p>
      </div>
    </div>
  );
};

export default Ticket;