import  { useEffect, useState } from "react";
import "../../styles/pages/sales/daySalesModal.css";
import type {Sale} from '../../types/index'
import { getSalesByDateRange} from '../../api/sales'
import DatePicker, { registerLocale } from "react-datepicker";
import {es} from "date-fns/locale/es";

import "react-datepicker/dist/react-datepicker.css";

import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import Ticket from "./Ticket";

registerLocale("es", es); // ✅ registra el idioma español

export default function DaySalesModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [sales, setSales] = useState<Sale[]>([])
  const [dateToday, setDateToday] = useState<Date>(new Date())

   useEffect(() => { 
    if(isOpen) {
      /*const localDate = new Date(dateToday.getTime() - dateToday.getTimezoneOffset() * 60000)
      .toISOString()
      .split("T")[0];*/
      const localDate = dateToday.toLocaleDateString('en-CA'); // YYYY-MM-DD en hora local
      const start = localDate;
      const end = localDate;
      fetchSalesByDateRange(start, end);
    }
  }, [dateToday, isOpen]);

  const openModal = async () => {
       setIsOpen(true)
  };
  
  const resumen = sales.reduce(
    (acc, sale) => {
      const metodo = sale.paymentMethod?.toLowerCase() || "desconocido";
      const total = sale.total || 0;

      // Suma total general
      acc.totalGeneral += total;

      // Suma por método de pago
      if (metodo.includes("efectivo")) {
        acc.totalEfectivo += total;
      } else if (metodo.includes("tarjeta")) {
        acc.totalTarjeta += total;
      } else {
        acc.totalOtros += total;
      }

      return acc;
    },
    {
      totalEfectivo: 0,
      totalTarjeta: 0,
      totalOtros: 0,
      totalGeneral: 0,
    }
  );
  console.log(resumen);

  const fetchSalesByDateRange = async(startDate:string, endDate:string ) =>{
     try {
        const fetchSales = await getSalesByDateRange(startDate, endDate)
        setSales(fetchSales);
     } catch (error) {
      console.log('Error', error);
     }
  }

  const closeModal = () => {
    setSelectedSale(null);
    setIsOpen(false);
  };

  const handlePrint = async() => {
    if(selectedSale) { 
      const ticket = document.getElementById("ticket-content");
      if (!ticket) return;
      const canvas = await html2canvas(ticket);
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [58, 100], // tamaño ticket térmico
       });

      pdf.addImage(imgData, "PNG", 0, 0, 58, 100);
      pdf.save(`${selectedSale?.id}-ticket.pdf`);
    }
   };
 
  return (
    <>
      <button className="btn touch-btn today-sales" onClick={openModal}>
        📅 Ventas del día
      </button>

      {isOpen && (
        <div className="modal-overlay">
          <div className="modal-container-day-sales">
            <h2 className="modal-title text-lg font-semibold">
              <span className="text-green-600">
                💵 Efectivo:{" "}
                {resumen.totalEfectivo.toLocaleString("es-MX", {
                  style: "currency",
                  currency: "MXN",
                })}
              </span>{" "}
              <span className="text-blue-600 ml-4">
                💳 Tarjeta:{" "}
                {resumen.totalTarjeta.toLocaleString("es-MX", {
                  style: "currency",
                  currency: "MXN",
                })}
              </span>
            </h2>                            
            <div className="modal-content">
              {/* Left column - sales list */}
              <div className="sales-list">
                 <div>
                    <label className="datepicker-label">Del día:</label>
                    <DatePicker
                      selected={dateToday}
                      onChange={(date)=> setDateToday(date || new Date())}
                      locale="es"
                      dateFormat="yyyy-MM-dd"
                      className="datepicker-input"
                      /> 
                      Total de folios:{sales.length}
                 </div>
                { sales.length > 0 ?
                  <div className="table-container">
                  <table className="sales-table">
                    <thead>
                      <tr>
                        <th>Folio</th>
                        <th>Status</th>
                        <th>Check</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((sale) => (
                        <tr
                          key={sale.id}
                          className={selectedSale?.id === sale.id ? "selected" : ""}
                          onClick={() => setSelectedSale(sale)}
                        >
                          <td>{sale.id}</td>
                          <td>{sale.status}</td>
                          <td>✅</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                : <p className="no-selection">No se encontraron ventas en al fecha seleccionada</p>
                }
              </div>
               {/* Right column - sale details */}
               {/* Componente visual del ticket */}
              {selectedSale!==null ? 
                 <div   className="sale-details" style={{ marginTop: "20px" }}>
                      <Ticket sale={selectedSale}/>
                 </div>  
                 : (<p className="no-selection">Selecciona un venta</p>)
              }
            </div>

            {/* Footer buttons */}
            <div className="modal-footer">
              <button className="btn touch-btn close-btn-day-sales" onClick={closeModal}>
                ↩️ Regresar
              </button>
              <button
                className="btn touch-btn print-btn"
                onClick={handlePrint}
                disabled={!selectedSale}
              >
                🖨 Descargar Ticket
              </button> 
            </div>
          </div>
        </div>
      )}
    </>
  );
} 