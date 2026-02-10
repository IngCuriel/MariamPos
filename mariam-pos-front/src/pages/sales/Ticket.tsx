import React from "react";

import type {Sale} from '../../types/index'

interface TicketProps { 
    sale:Sale
}

const Ticket: React.FC<TicketProps> = ({sale}) => {
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
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Header fijo */}
      <div style={{ flexShrink: 0 }}>
        <h3 style={{ textAlign: "center", margin: 0 }}>{sale.branch}</h3>
        <p style={{ textAlign: "center", margin: "4px 0" }}>Cliente: {sale.clientName}</p>
        {/*<p style={{ textAlign: "center", margin: "4px 0" }}>Progreso 10, entro, Yutanduchi de Guerrero, Oax.</p>*/}
        <hr />
        <p style={{ textAlign: "left" }}>Folio: {sale.id}</p>
        {sale.shift?.shiftNumber && (
          <p style={{ textAlign: "left" }}>Turno: {sale.shift.shiftNumber}</p>
        )}
        <p style={{ textAlign: "left" }}>Fecha: {dateFormat(sale.createdAt)}</p>
        <hr />
      </div>

      {/* Lista de productos con scroll */}
      <div style={{ 
        flex: 1, 
        overflowY: "auto", 
        overflowX: "hidden",
        minHeight: 0,
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

      {/* Footer fijo */}
      <div style={{ flexShrink: 0, marginTop: "8px" }}>
        <hr />
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
          <span style={{ fontWeight: "600" }}>Total de productos:</span>
          <span style={{ fontWeight: "600" }}>{totalProducts}</span>
        </div>
        <p style={{ textAlign: "right", fontWeight: "bold", marginTop: "8px" }}>
          Total: ${sale.total.toFixed(2)}
        </p>
        <p style={{ textAlign: "right", fontWeight: "bold" }}>
          {sale.paymentMethod}
        </p>
        <hr />
        <p style={{ textAlign: "center" }}>¡Gracias por su compra!</p>
        <p style={{ textAlign: "center" }}>Vuelva pronto</p>
      </div>
    </div>
  );
};

export default Ticket;