import React from "react";

import type {Sale} from '../../types/index'

interface TicketProps { 
    sale:Sale
}

const Ticket: React.FC<TicketProps> = ({sale}) => {
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
      }}
    >
      <h3 style={{ textAlign: "center", margin: 0 }}>{sale.branch}</h3>
      <p style={{ textAlign: "center", margin: "4px 0" }}>Cliente: {sale.clientName}</p>
      {/*<p style={{ textAlign: "center", margin: "4px 0" }}>Progreso 10, entro, Yutanduchi de Guerrero, Oax.</p>*/}
      <hr />
      <p style={{ textAlign: "left" }}>Folio: {sale.id}</p>
      <p style={{ textAlign: "left" }}>Fecha: {new Date().toLocaleString()}</p>
      <hr />

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {sale?.details?.map((item) => (
            <tr key={item.id}>
              <td style={{ textAlign: "left" }}>
                {item.productName} 
              </td>
              <td>
                {item.quantity} x ${item.price}
              </td>
              <td style={{ textAlign: "right" }}>
                ${(item.price * item.quantity).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr />
      <p style={{ textAlign: "right", fontWeight: "bold" }}>
        Total: ${sale.total.toFixed(2)}
      </p>
      <p style={{ textAlign: "right", fontWeight: "bold" }}>
        {sale.paymentMethod}
      </p>
      <hr />
      <p style={{ textAlign: "center" }}>¡Gracias por su compra!</p>
      <p style={{ textAlign: "center" }}>Vuelva pronto</p>
    </div>
  );
};

export default Ticket;