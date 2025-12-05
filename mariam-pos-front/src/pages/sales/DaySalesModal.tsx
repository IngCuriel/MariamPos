import  { useEffect, useState, useCallback } from "react";
import "../../styles/pages/sales/daySalesModal.css";
import type {Sale, ClientCredit, CreditPayment, CashMovement} from '../../types/index'
import { getSalesByDateRange} from '../../api/sales'
import { getCreditsByDateRange, getCreditPaymentsByDateRange } from '../../api/credits'
import { getCashMovementsByDateRange } from '../../api/cashRegister'
import DatePicker, { registerLocale } from "react-datepicker";
import {es} from "date-fns/locale/es";

import "react-datepicker/dist/react-datepicker.css";

import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import Ticket from "./Ticket";
import Swal from "sweetalert2";

registerLocale("es", es); // ✅ registra el idioma español

interface DaySalesModalProps {
  onClose?: () => void;
}

export default function DaySalesModal({ onClose }: DaySalesModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [sales, setSales] = useState<Sale[]>([])
  const [dateToday, setDateToday] = useState<Date>(new Date())
  const [credits, setCredits] = useState<ClientCredit[]>([])
  const [creditPayments, setCreditPayments] = useState<CreditPayment[]>([])
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([])
  const [selectedCashRegister, setSelectedCashRegister] = useState<string>(() => {
    return localStorage.getItem('caja') || 'all';
  });
  const [availableCashRegisters, setAvailableCashRegisters] = useState<string[]>([]);

  const loadCashRegisters = async (startDate: string, endDate: string) => {
    try {
      const allSales = await getSalesByDateRange(startDate, endDate);
      // Obtener cajas únicas de las ventas
      const uniqueCashRegisters = Array.from(
        new Set(allSales.map(sale => sale.cashRegister).filter(Boolean))
      ).sort() as string[];
      setAvailableCashRegisters(uniqueCashRegisters);
    } catch (error) {
      console.error("Error al cargar cajas:", error);
    }
  };

  const fetchSalesByDateRange = useCallback(async(startDate:string, endDate:string ) =>{
     try {
        const cashRegisterFilter = selectedCashRegister !== "all" ? selectedCashRegister : undefined;
        const fetchSales = await getSalesByDateRange(startDate, endDate, cashRegisterFilter)
        setSales(fetchSales);
     } catch (error) {
      console.log('Error', error);
     }
  }, [selectedCashRegister]);

   useEffect(() => { 
    if(isOpen) {
      /*const localDate = new Date(dateToday.getTime() - dateToday.getTimezoneOffset() * 60000)
      .toISOString()
      .split("T")[0];*/
      const localDate = dateToday.toLocaleDateString('en-CA'); // YYYY-MM-DD en hora local
      const start = localDate;
      const end = localDate;
      fetchSalesByDateRange(start, end);
      fetchCreditsByDateRange(start, end);
      fetchCreditPaymentsByDateRange(start, end);
      fetchCashMovementsByDateRange(start, end);
      loadCashRegisters(start, end);
    }
  }, [dateToday, isOpen, fetchSalesByDateRange]);

  const openModal = async () => {
       setIsOpen(true)
  };
  
  // Calcular resumen separando Efectivo, Tarjeta y Regalo
  const resumen = sales.reduce(
    (acc, sale) => {
      const metodo = sale.paymentMethod?.toLowerCase() || "desconocido";
      const total = sale.total || 0;

      // Suma total general
      acc.totalGeneral += total;

      // Detectar método de pago
      if (metodo.includes("regalo")) {
        // Regalo tiene prioridad
        acc.totalRegalo += total;
      } else if (metodo.includes("mixto")) {
        // Para pagos mixtos, extraer efectivo y tarjeta del string
        // Formato: "Mixto (Efectivo: $X.XX, Tarjeta: $Y.YY)"
        const efectivoMatch = metodo.match(/efectivo:\s*\$?([\d,]+\.?\d*)/i);
        const tarjetaMatch = metodo.match(/tarjeta:\s*\$?([\d,]+\.?\d*)/i);
        
        if (efectivoMatch && efectivoMatch[1]) {
          const efectivoAmount = parseFloat(efectivoMatch[1].replace(/,/g, '')) || 0;
          if (!isNaN(efectivoAmount)) {
            acc.totalEfectivo += efectivoAmount;
          }
        }
        
        if (tarjetaMatch && tarjetaMatch[1]) {
          const tarjetaAmount = parseFloat(tarjetaMatch[1].replace(/,/g, '')) || 0;
          if (!isNaN(tarjetaAmount)) {
            acc.totalTarjeta += tarjetaAmount;
          }
        }
      } else if (metodo.includes("efectivo") && !metodo.includes("mixto")) {
        acc.totalEfectivo += total;
      } else if (metodo.includes("tarjeta") && !metodo.includes("mixto")) {
        acc.totalTarjeta += total;
      } else {
        // Otros métodos de pago
        acc.totalOtros += total;
      }

      return acc;
    },
    {
      totalEfectivo: 0,
      totalTarjeta: 0,
      totalRegalo: 0,
      totalOtros: 0,
      totalGeneral: 0,
    }
  );

  // Calcular resumen de créditos y abonos
  const resumenCreditos = {
    totalCreditsGenerated: credits.reduce((sum, credit) => sum + (credit.originalAmount || 0), 0),
    creditsCount: credits.length,
    totalPaymentsCash: creditPayments
      .filter(p => p.paymentMethod?.toLowerCase().includes("efectivo"))
      .reduce((sum, p) => sum + (p.amount || 0), 0),
    totalPaymentsCard: creditPayments
      .filter(p => p.paymentMethod?.toLowerCase().includes("tarjeta"))
      .reduce((sum, p) => sum + (p.amount || 0), 0),
    totalPaymentsOther: creditPayments
      .filter(p => {
        const method = p.paymentMethod?.toLowerCase() || "";
        return !method.includes("efectivo") && !method.includes("tarjeta");
      })
      .reduce((sum, p) => sum + (p.amount || 0), 0),
    paymentsCount: creditPayments.length,
  };

  // Calcular resumen de movimientos de efectivo
  const resumenMovimientos = {
    totalEntradas: cashMovements
      .filter(m => m.type === "ENTRADA")
      .reduce((sum, m) => sum + (m.amount || 0), 0),
    totalSalidas: cashMovements
      .filter(m => m.type === "SALIDA")
      .reduce((sum, m) => sum + (m.amount || 0), 0),
    neto: cashMovements.reduce((sum, m) => {
      return sum + (m.type === "ENTRADA" ? (m.amount || 0) : -(m.amount || 0));
    }, 0),
    movementsCount: cashMovements.length,
  };

  const fetchCreditsByDateRange = async(startDate:string, endDate:string ) =>{
     try {
        const fetchCredits = await getCreditsByDateRange(startDate, endDate)
        setCredits(fetchCredits);
     } catch (error) {
      console.log('Error al obtener créditos:', error);
     }
  }

  const fetchCreditPaymentsByDateRange = async(startDate:string, endDate:string ) =>{
     try {
        const fetchPayments = await getCreditPaymentsByDateRange(startDate, endDate)
        setCreditPayments(fetchPayments);
     } catch (error) {
      console.log('Error al obtener abonos:', error);
     }
  }

  const fetchCashMovementsByDateRange = async(_startDate:string, _endDate:string ) =>{
     try {
        const fetchMovements = await getCashMovementsByDateRange(_startDate, _endDate)
        setCashMovements(fetchMovements);
     } catch (error) {
      console.log('Error al obtener movimientos:', error);
     }
  }

  const closeModal = () => {
    setSelectedSale(null);
    setIsOpen(false);
    // Ejecutar callback si existe
    if (onClose) {
      setTimeout(() => {
        onClose();
      }, 100);
    }
  };

  // Función auxiliar para obtener la clase CSS del método de pago
  const getMethodClass = (method?: string): string => {
    if (!method) return "otros";
    const metodo = method.toLowerCase();
    if (metodo.includes("regalo")) return "regalo";
    if (metodo.includes("efectivo") && !metodo.includes("mixto")) return "efectivo";
    if (metodo.includes("tarjeta") && !metodo.includes("mixto")) return "tarjeta";
    if (metodo.includes("mixto")) return "mixto";
    return "otros";
  };

  // Función auxiliar para obtener el ícono del método de pago
  const getMethodIcon = (method?: string): string => {
    if (!method) return "📋";
    const metodo = method.toLowerCase();
    if (metodo.includes("regalo")) return "🎁";
    if (metodo.includes("efectivo") && !metodo.includes("mixto")) return "💵";
    if (metodo.includes("tarjeta") && !metodo.includes("mixto")) return "💳";
    if (metodo.includes("mixto")) return "💵💳";
    return "📋";
  };

  // Función auxiliar para obtener la etiqueta del método de pago
  const getMethodLabel = (method?: string): string => {
    if (!method) return "Desconocido";
    const metodo = method.toLowerCase();
    if (metodo.includes("regalo")) return "Regalo";
    if (metodo.includes("efectivo") && !metodo.includes("mixto")) return "Efectivo";
    if (metodo.includes("tarjeta") && !metodo.includes("mixto")) return "Tarjeta";
    if (metodo.includes("mixto")) return "Mixto";
    return method.length > 20 ? method.substring(0, 20) + "..." : method;
  };

  // Función para generar PDF en tamaño carta con marca de agua
  const generateInvoicePDF = async (sale: Sale): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      try {
        // Crear un contenedor temporal con el ticket mejorado para tamaño carta
        const tempContainer = document.createElement("div");
        tempContainer.style.width = "210mm"; // Ancho carta
        tempContainer.style.minHeight = "279mm"; // Alto carta
        tempContainer.style.padding = "20mm";
        tempContainer.style.fontFamily = "Arial, sans-serif";
        tempContainer.style.background = "white";
        tempContainer.style.color = "#000";
        tempContainer.style.position = "absolute";
        tempContainer.style.left = "-9999px";
        tempContainer.style.top = "0";
        tempContainer.style.zIndex = "-1";
        document.body.appendChild(tempContainer);

        // Crear el contenido de la nota de venta
        const dateFormat = (date: Date) => {
          const fecha = new Date(date);
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

        // Escapar HTML para prevenir problemas
        const escapeHtml = (text: string) => {
          const div = document.createElement("div");
          div.textContent = text;
          return div.innerHTML;
        };

        tempContainer.innerHTML = `
          <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 20px;">
            <h1 style="margin: 0; font-size: 28px; font-weight: bold;">${escapeHtml(sale.branch || "Sucursal")}</h1>
            <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">NOTA DE VENTA</p>
          </div>
          
          <div style="margin-bottom: 25px;">
            <p style="margin: 5px 0; font-size: 14px;"><strong>Cliente:</strong> ${escapeHtml(sale.clientName || "Cliente General")}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Folio:</strong> ${sale.id}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Fecha:</strong> ${dateFormat(sale.createdAt)}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <thead>
              <tr style="background-color: #f3f4f6; border-bottom: 2px solid #000;">
                <th style="padding: 12px; text-align: left; font-size: 14px; font-weight: bold;">Producto</th>
                <th style="padding: 12px; text-align: center; font-size: 14px; font-weight: bold;">Cantidad</th>
                <th style="padding: 12px; text-align: right; font-size: 14px; font-weight: bold;">Precio Unit.</th>
                <th style="padding: 12px; text-align: right; font-size: 14px; font-weight: bold;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${sale.details?.map((item) => `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 10px; font-size: 13px;">${escapeHtml(item.productName || "Producto")}</td>
                  <td style="padding: 10px; text-align: center; font-size: 13px;">${item.quantity}</td>
                  <td style="padding: 10px; text-align: right; font-size: 13px;">$${item.price.toFixed(2)}</td>
                  <td style="padding: 10px; text-align: right; font-size: 13px;">$${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
              `).join("") || ""}
            </tbody>
          </table>

          <div style="margin-top: 30px; border-top: 2px solid #000; padding-top: 20px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span style="font-size: 16px; font-weight: bold;">Total:</span>
              <span style="font-size: 18px; font-weight: bold;">${sale.total.toLocaleString("es-MX", {
                style: "currency",
                currency: "MXN",
              })}</span>
            </div>
            <div style="margin-top: 15px;">
              <p style="margin: 5px 0; font-size: 14px;"><strong>Método de Pago:</strong> ${escapeHtml(sale.paymentMethod || "No especificado")}</p>
              <p style="margin: 5px 0; font-size: 14px;"><strong>Estado:</strong> ${escapeHtml(sale.status || "Pagado")}</p>
            </div>
          </div>

          <div style="margin-top: 40px; text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 5px 0; font-size: 12px; color: #666;">¡Gracias por su compra!</p>
            <p style="margin: 5px 0; font-size: 12px; color: #666;">Vuelva pronto</p>
          </div>
        `;

        // Esperar a que el contenido se renderice completamente
        setTimeout(async () => {
          try {
            const canvas = await html2canvas(tempContainer, {
              scale: 2,
              useCORS: true,
              logging: false,
              backgroundColor: "#ffffff",
              allowTaint: true,
            });

            document.body.removeChild(tempContainer);

            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF({
              orientation: "portrait",
              unit: "mm",
              format: "letter", // Tamaño carta (216 x 279 mm)
            });

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = pageWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            // Agregar la imagen del ticket
            pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);

            // Agregar marca de agua "PAGADO" en todas las páginas
            const totalPages = pdf.internal.pages.length - 1;
            for (let i = 1; i <= totalPages; i++) {
              pdf.setPage(i);
              
              // Crear marca de agua "PAGADO" usando texto con opacidad
              // Usar un canvas temporal para crear la marca de agua como imagen
              const watermarkCanvas = document.createElement("canvas");
              watermarkCanvas.width = 400;
              watermarkCanvas.height = 100;
              const ctx = watermarkCanvas.getContext("2d");
              
              if (ctx) {
                // Configurar el contexto para texto rotado
                ctx.save();
                ctx.translate(200, 50);
                ctx.rotate(-Math.PI / 4); // Rotar 45 grados
                ctx.globalAlpha = 0.15; // Opacidad
                ctx.fillStyle = "#c8c8c8"; // Gris claro
                ctx.font = "bold 60px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("PAGADO", 0, 0);
                ctx.restore();
                
                // Convertir canvas a imagen y agregar al PDF
                const watermarkData = watermarkCanvas.toDataURL("image/png");
                const watermarkWidth = pageWidth * 0.8;
                const watermarkHeight = (watermarkCanvas.height * watermarkWidth) / watermarkCanvas.width;
                const watermarkX = (pageWidth - watermarkWidth) / 2;
                const watermarkY = (pageHeight - watermarkHeight) / 2;
                
                pdf.addImage(watermarkData, "PNG", watermarkX, watermarkY, watermarkWidth, watermarkHeight);
              }
            }

            resolve(pdf.output("blob"));
          } catch (error) {
            if (document.body.contains(tempContainer)) {
              document.body.removeChild(tempContainer);
            }
            reject(error);
          }
        }, 500); // Esperar 500ms para que se renderice
      } catch (error) {
        reject(error);
      }
    });
  };

  const handlePrint = async() => {
    if(selectedSale) { 
      try {
        const pdfBlob = await generateInvoicePDF(selectedSale);
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `ticket-${selectedSale.id}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Error al generar PDF:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se pudo generar el PDF",
        });
      }
    }
  };
  
  // Función para abrir WhatsApp Web en nueva ventana
  const handleSendWhatsApp = async () => {
    if (!selectedSale) return;

    const { value: phoneNumber } = await Swal.fire({
      title: "Enviar Ticket por WhatsApp",
      html: `
        <input 
          id="swal-phone" 
          class="swal2-input" 
          type="tel" 
          placeholder="521234567890 (con código de país)"
          required
        >
        <small style="display: block; margin-top: 10px; color: #666;">
          Ejemplo: 521234567890 (52 para México + número sin espacios)
        </small>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Abrir WhatsApp",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#25D366",
      preConfirm: () => {
        const phoneInput = document.getElementById("swal-phone") as HTMLInputElement;
        const phone = phoneInput?.value?.replace(/\s/g, ""); // Eliminar espacios
        if (!phone) {
          Swal.showValidationMessage("Por favor ingresa un número de teléfono");
          return false;
        }
        // Validar que sea numérico
        if (!/^\d+$/.test(phone)) {
          Swal.showValidationMessage("El número debe contener solo dígitos");
          return false;
        }
        return phone;
      },
    });

    if (phoneNumber) {
      try {
        // Generar PDF primero
        const pdfBlob = await generateInvoicePDF(selectedSale);
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        // Descargar el PDF para que el usuario lo pueda compartir
        const link = document.createElement("a");
        link.href = pdfUrl;
        link.download = `ticket-${selectedSale.id}.pdf`;
        link.click();
        
        // Crear mensaje para WhatsApp
        const message = encodeURIComponent(
          `*Ticket de Venta*\n\n` +
          `Folio: ${selectedSale.id}\n` +
          `Total: ${selectedSale.total.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}\n` +
          `Fecha: ${new Date(selectedSale.createdAt).toLocaleDateString("es-MX")}\n\n` +
          `El PDF del ticket se ha descargado. Por favor compártelo aquí.`
        );
        
        // Abrir WhatsApp Web en nueva ventana
        const whatsappUrl = `https://web.whatsapp.com/send?phone=${phoneNumber}&text=${message}`;
        const whatsappWindow = window.open(
          whatsappUrl,
          "_blank",
          "width=1200,height=800,scrollbars=yes,resizable=yes"
        );
        
        if (whatsappWindow) {
          Swal.fire({
            icon: "success",
            title: "WhatsApp Web Abierto",
            html: `
              <p>Se ha abierto WhatsApp Web en una nueva ventana.</p>
              <p style="margin-top: 10px;"><strong>El PDF se ha descargado automáticamente.</strong></p>
              <p style="margin-top: 10px; color: #666; font-size: 0.9rem;">
                Por favor comparte el PDF desde WhatsApp Web.
              </p>
            `,
            timer: 5000,
            showConfirmButton: true,
          });
        } else {
          // Si el popup fue bloqueado, mostrar instrucciones
          Swal.fire({
            icon: "warning",
            title: "Popup Bloqueado",
            html: `
              <p>Tu navegador bloqueó la ventana de WhatsApp Web.</p>
              <p style="margin-top: 10px;">Por favor:</p>
              <ol style="text-align: left; margin-top: 10px;">
                <li>Permite popups para este sitio</li>
                <li>O copia este enlace y ábrelo manualmente:</li>
              </ol>
              <input 
                type="text" 
                id="whatsapp-link" 
                value="${whatsappUrl}" 
                readonly 
                style="width: 100%; padding: 8px; margin-top: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85rem;"
                onclick="this.select()"
              />
            `,
            confirmButtonText: "Entendido",
          });
        }
        
        // Limpiar URL después de un tiempo
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 10000);
      } catch (error) {
        console.error("Error al generar PDF:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: `No se pudo generar el PDF: ${error instanceof Error ? error.message : "Error desconocido"}`,
        });
      }
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
            <h2 className="modal-title">Resumen de Ventas del Día</h2>
            <div className="modal-content-day-sales">
              {/* Left column - Summary totals */}
              <div className="summary-column">
                <div className="summary-totals">
                  <div className="summary-item efectivo">
                    <span className="summary-icon">💵</span>
                    <span className="summary-label">Efectivo:</span>
                    <span className="summary-amount">
                      {resumen.totalEfectivo.toLocaleString("es-MX", {
                        style: "currency",
                        currency: "MXN",
                      })}
                    </span>
                  </div>
                  <div className="summary-item tarjeta">
                    <span className="summary-icon">💳</span>
                    <span className="summary-label">Tarjeta:</span>
                    <span className="summary-amount">
                      {resumen.totalTarjeta.toLocaleString("es-MX", {
                        style: "currency",
                        currency: "MXN",
                      })}
                    </span>
                  </div>
                  <div className="summary-item regalo">
                    <span className="summary-icon">🎁</span>
                    <span className="summary-label">Regalo:</span>
                    <span className="summary-amount">
                      {resumen.totalRegalo.toLocaleString("es-MX", {
                        style: "currency",
                        currency: "MXN",
                      })}
                    </span>
                  </div>
                  {resumen.totalOtros > 0 && (
                    <div className="summary-item otros">
                      <span className="summary-icon">📋</span>
                      <span className="summary-label">Otros:</span>
                      <span className="summary-amount">
                        {resumen.totalOtros.toLocaleString("es-MX", {
                          style: "currency",
                          currency: "MXN",
                        })}
                      </span>
                    </div>
                  )}
                  <div className="summary-item total">
                    <span className="summary-icon">💰</span>
                    <span className="summary-label">Total General:</span>
                    <span className="summary-amount total-amount">
                      {resumen.totalGeneral.toLocaleString("es-MX", {
                        style: "currency",
                        currency: "MXN",
                      })}
                    </span>
                  </div>
                </div>
                
                {/* Resumen de Créditos y Abonos */}
                {(resumenCreditos.creditsCount > 0 || resumenCreditos.paymentsCount > 0) && (
                  <div className="summary-totals credits-section">
                    <div className="summary-item credit-generated">
                      <span className="summary-icon">💳</span>
                      <span className="summary-label">Créditos Generados:</span>
                      <span className="summary-amount" style={{ color: "#dc2626" }}>
                        {resumenCreditos.creditsCount} - {resumenCreditos.totalCreditsGenerated.toLocaleString("es-MX", {
                          style: "currency",
                          currency: "MXN",
                        })}
                      </span>
                    </div>
                    {resumenCreditos.paymentsCount > 0 && (
                      <>
                        {resumenCreditos.totalPaymentsCash > 0 && (
                          <div className="summary-item credit-payment-cash">
                            <span className="summary-icon">💵</span>
                            <span className="summary-label">Abonos Efectivo:</span>
                            <span className="summary-amount" style={{ color: "#059669" }}>
                              +{resumenCreditos.totalPaymentsCash.toLocaleString("es-MX", {
                                style: "currency",
                                currency: "MXN",
                              })}
                            </span>
                          </div>
                        )}
                        {resumenCreditos.totalPaymentsCard > 0 && (
                          <div className="summary-item credit-payment-card">
                            <span className="summary-icon">💳</span>
                            <span className="summary-label">Abonos Tarjeta:</span>
                            <span className="summary-amount" style={{ color: "#3b82f6" }}>
                              {resumenCreditos.totalPaymentsCard.toLocaleString("es-MX", {
                                style: "currency",
                                currency: "MXN",
                              })}
                            </span>
                          </div>
                        )}
                        {resumenCreditos.totalPaymentsOther > 0 && (
                          <div className="summary-item credit-payment-other">
                            <span className="summary-icon">📋</span>
                            <span className="summary-label">Abonos Otros:</span>
                            <span className="summary-amount">
                              {resumenCreditos.totalPaymentsOther.toLocaleString("es-MX", {
                                style: "currency",
                                currency: "MXN",
                              })}
                            </span>
                          </div>
                        )}
                        <div className="summary-item credit-payment-total">
                          <span className="summary-icon">📊</span>
                          <span className="summary-label">Total Abonos:</span>
                          <span className="summary-amount" style={{ fontWeight: "600" }}>
                            {resumenCreditos.paymentsCount} - {(resumenCreditos.totalPaymentsCash + resumenCreditos.totalPaymentsCard + resumenCreditos.totalPaymentsOther).toLocaleString("es-MX", {
                              style: "currency",
                              currency: "MXN",
                            })}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Resumen de Movimientos de Efectivo*/}
                {resumenMovimientos.movementsCount > 0 && (
                  <div className="summary-totals movements-section">
                    <div className="summary-item movement-entrada">
                      <span className="summary-icon">💰</span>
                      <span className="summary-label">Entradas:</span>
                      <span className="summary-amount" style={{ color: "#059669" }}>
                        +{resumenMovimientos.totalEntradas.toLocaleString("es-MX", {
                          style: "currency",
                          currency: "MXN",
                        })}
                      </span>
                    </div>
                    <div className="summary-item movement-salida">
                      <span className="summary-icon">💸</span>
                      <span className="summary-label">Salidas:</span>
                      <span className="summary-amount" style={{ color: "#dc2626" }}>
                        -{resumenMovimientos.totalSalidas.toLocaleString("es-MX", {
                          style: "currency",
                          currency: "MXN",
                        })}
                      </span>
                    </div>
                    <div className="summary-item movement-neto">
                      <span className="summary-icon">📊</span>
                      <span className="summary-label">Neto Movimientos:</span>
                      <span className="summary-amount" style={{ 
                        color: resumenMovimientos.neto >= 0 ? "#059669" : "#dc2626",
                        fontWeight: "600"
                      }}>
                        {resumenMovimientos.neto >= 0 ? "+" : ""}{resumenMovimientos.neto.toLocaleString("es-MX", {
                          style: "currency",
                          currency: "MXN",
                        })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Right column - Sales list and details */}
              <div className="sales-details-column">
                {/* Left sub-column - Sales list */}
                <div className="sales-list">
                  <div className="date-filter-section">
                    <label className="datepicker-label">Del día:</label>
                    <DatePicker
                      selected={dateToday}
                      onChange={(date)=> setDateToday(date || new Date())}
                      locale="es"
                      dateFormat="yyyy-MM-dd"
                      className="datepicker-input"
                      />
                    <label className="datepicker-label" style={{ marginTop: '0.5rem' }}>🏪 Caja:</label>
                    <select
                      value={selectedCashRegister}
                      onChange={(e) => setSelectedCashRegister(e.target.value)}
                      className="datepicker-input"
                      style={{ marginTop: '0.25rem' }}
                    >
                      <option value="all">Todas las cajas</option>
                      {availableCashRegisters.map((cashRegister) => (
                        <option key={cashRegister} value={cashRegister}>
                          {cashRegister}
                        </option>
                      ))}
                    </select>
                    <div className="folio-count">
                      <span className="folio-label">Total de folios:</span>
                      <span className="folio-number">{sales.length}</span>
                    </div>
                  </div>
                  { sales.length > 0 ? (
                    <div className="table-container">
                      <table className="sales-table">
                        <thead>
                          <tr>
                            <th>Folio</th>
                            <th>Total</th>
                            <th>Método</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sales.map((sale) => (
                            <tr
                              key={sale.id}
                              className={selectedSale?.id === sale.id ? "selected" : ""}
                              onClick={() => setSelectedSale(sale)}
                            >
                              <td className="folio-cell">{sale.id}</td>
                              <td className="total-cell">
                                {sale.total.toLocaleString("es-MX", {
                                  style: "currency",
                                  currency: "MXN",
                                })}
                              </td>
                              <td className="method-cell">
                                <span className={`method-badge ${getMethodClass(sale.paymentMethod)}`}>
                                  {getMethodIcon(sale.paymentMethod)} {getMethodLabel(sale.paymentMethod)}
                                </span>
                              </td>
                              <td className="status-cell">
                                <span className={`status-badge ${sale.status?.toLowerCase() === 'pagado' ? 'pagado' : 'pendiente'}`}>
                                  {sale.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="no-sales-message">
                      <p className="no-selection">No se encontraron ventas en la fecha seleccionada</p>
                    </div>
                  )}
                </div>
                
                {/* Right sub-column - Sale details */}
                <div className="sale-details-wrapper">
                  {selectedSale!==null ? 
                    <div className="sale-details">
                      <Ticket sale={selectedSale}/>
                    </div>  
                    : (
                      <div className="no-selection-container">
                        <p className="no-selection">Selecciona una venta</p>
                      </div>
                    )
                  }
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="modal-footer">
              <button className="btn touch-btn close-btn-day-sales" onClick={closeModal}>
                ↩️ Regresar
              </button>
              <div className="footer-actions-group">
                {/*<button
                  className="btn touch-btn email-btn"
                  onClick={handleSendEmail}
                  disabled={!selectedSale}
                  title="Enviar por correo electrónico"
                >
                  📧 Enviar por Email
                </button>*/}
                <button
                  className="btn touch-btn whatsapp-btn"
                  onClick={handleSendWhatsApp}
                  disabled={!selectedSale}
                  title="Enviar por WhatsApp"
                >
                  💬 Enviar por WhatsApp
                </button>
                <button
                  className="btn touch-btn print-btn"
                  onClick={handlePrint}
                  disabled={!selectedSale}
                  title="Descargar PDF"
                >
                  🖨 Descargar PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 