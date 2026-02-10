import { useEffect, useState } from "react";
import Header from "../../components/Header";
import type { CashRegisterShift, ShiftSummary, CashMovement } from "../../types/index";
import { getShiftsByDateRange, getShiftSummary, getCashMovementsByShift } from "../../api/cashRegister";
import DatePicker, { registerLocale } from "react-datepicker";
import { es } from "date-fns/locale/es";
import "react-datepicker/dist/react-datepicker.css";
import Swal from "sweetalert2";
import "../../styles/pages/sales/shiftHistoryPage.css";

registerLocale("es", es);

interface ShiftHistoryPageProps {
  onBack: () => void;
}

export default function ShiftHistoryPage({
  onBack,
}: ShiftHistoryPageProps) {
  const [selectedShift, setSelectedShift] = useState<CashRegisterShift | null>(null);
  const [shiftSummary, setShiftSummary] = useState<ShiftSummary | null>(null);
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [shifts, setShifts] = useState<CashRegisterShift[]>([]);
  const [startDate, setStartDate] = useState<Date>(
    new Date(new Date().setDate(new Date().getDate() /*- 7*/))
  );
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [filterStatus, _setFilterStatus] = useState<string>("");

  useEffect(() => {
    fetchShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, filterStatus]);

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const start = startDate.toLocaleDateString("en-CA");
      const end = endDate.toLocaleDateString("en-CA");

      // Obtener sucursal desde localStorage (siempre el valor más reciente)
      const branch = localStorage.getItem('sucursal') || undefined;

      const params: Record<string, string> = {
        startDate: start,
        endDate: end,
      };

      // Solo filtrar por sucursal (desde localStorage), no por caja para mostrar todas las cajas
      if (branch) params.branch = branch;
      // No incluir cashRegister para mostrar todas las cajas
      if (filterStatus) params.status = filterStatus;

      const data = await getShiftsByDateRange(params);
      setShifts(data);
    } catch (error) {
      console.error("Error al cargar turnos:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar los turnos",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectShift = async (shift: CashRegisterShift) => {
    setSelectedShift(shift);
    
    // Cargar movimientos de efectivo siempre
    try {
      const movements = await getCashMovementsByShift(shift.id);
      setCashMovements(movements);
    } catch (error) {
      console.error("Error al cargar movimientos:", error);
      setCashMovements([]);
    }
    
    // Si el turno está abierto, no intentar cargar el resumen completo
    if (shift.status === "OPEN") {
      setShiftSummary(null);
      return;
    }
    
    try {
      const summary = await getShiftSummary(shift.id);
      setShiftSummary(summary);
      if (summary.cashMovements) {
        setCashMovements(summary.cashMovements);
      }
    } catch (error) {
      console.error("Error al cargar resumen:", error);
      setShiftSummary(null);
    }
  };

  // Calcular totales generales
  const totals = shifts.reduce(
    (acc, shift) => {
      acc.totalCash += shift.totalCash || 0;
      acc.totalCard += shift.totalCard || 0;
      acc.totalTransfer += shift.totalTransfer || 0;
      acc.totalOther += shift.totalOther || 0;
      acc.totalShifts += 1;
      return acc;
    },
    {
      totalCash: 0,
      totalCard: 0,
      totalTransfer: 0,
      totalOther: 0,
      totalShifts: 0,
    }
  );

  const getStatusBadge = (status: string) => {
    const badges = {
      OPEN: { text: "🟢 Abierto", color: "#059669" },
      CLOSED: { text: "✅ Cerrado", color: "#3b82f6" },
      CANCELLED: { text: "❌ Cancelado", color: "#dc2626" },
    };
    const badge = badges[status as keyof typeof badges] || badges.CLOSED;
    return (
      <span
        style={{
          color: badge.color,
          fontWeight: "700",
          fontSize: "1rem",
          padding: "4px 12px",
          borderRadius: "6px",
          backgroundColor: `${badge.color}15`,
        }}
      >
        {badge.text}
      </span>
    );
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString("es-MX", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Calcular regalos desde las ventas
  const calculateRegalo = (shift: CashRegisterShift) => {
    if (!shift.sales || !Array.isArray(shift.sales)) return 0;
    return shift.sales
      .filter((sale) => sale.paymentMethod && sale.paymentMethod.toLowerCase().includes("regalo"))
      .reduce((sum, sale) => sum + (sale.total || 0), 0);
  };

  // Función para mostrar modal con folios del turno
  const showFoliosModal = (shift: CashRegisterShift, summary: ShiftSummary | null) => {
    const sales = summary?.sales || [];
    
    if (sales.length === 0) {
      Swal.fire({
        icon: "info",
        title: "Sin ventas",
        text: "Este turno no tiene ventas registradas",
        confirmButtonText: "Cerrar",
        confirmButtonColor: "#3b82f6",
      });
      return;
    }

    const isMobile = window.innerWidth < 768;

    Swal.fire({
      title: `📋 Folios del Turno ${shift.shiftNumber}`,
      html: `
        <div style="text-align: left; margin-top: 15px; font-size: 1.05rem; max-width: 100%;">
          <p style="font-weight: 600; margin-bottom: 12px; font-size: 1rem; color: #1f2937;">
            Total: ${sales.length} ${sales.length === 1 ? 'venta' : 'ventas'}
          </p>
          <div style="max-height: 500px; overflow-y: auto; overflow-x: auto; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
              <thead style="position: sticky; top: 0; background: #f3f4f6; z-index: 10;">
                <tr style="border-bottom: 2px solid #d1d5db;">
                  <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #374151; white-space: nowrap;">Folio</th>
                  <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #374151; white-space: nowrap;">Fecha/Hora</th>
                  <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #374151; white-space: nowrap;">Cliente</th>
                  <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #374151; white-space: nowrap;">Método Pago</th>
                  <th style="padding: 12px 8px; text-align: right; font-weight: 600; color: #374151; white-space: nowrap;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${sales
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((sale) => {
                    const saleDate = new Date(sale.createdAt);
                    const dateStr = saleDate.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const timeStr = saleDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                    const paymentMethod = sale.paymentMethod || 'No especificado';
                    const methodLower = paymentMethod.toLowerCase();
                    const clientName = sale.clientName || 'Cliente General';
                    const folio = sale.folio || sale.id.toString();
                    
                    // Determinar método de pago y color
                    let methodDisplay = '';
                    let methodColor = '#6b7280';
                    
                    if (methodLower.includes('mixto')) {
                      const cashMatch = paymentMethod.match(/efectivo[:\s]*\$?([\d.]+)/i);
                      const cardMatch = paymentMethod.match(/tarjeta[:\s]*\$?([\d.]+)/i);
                      const cashAmount = cashMatch ? parseFloat(cashMatch[1]) : 0;
                      const cardAmount = cardMatch ? parseFloat(cardMatch[1]) : 0;
                      methodDisplay = '💵 Efectivo: $' + cashAmount.toFixed(2) + '<br>💳 Tarjeta: $' + cardAmount.toFixed(2);
                      methodColor = '#8b5cf6';
                    } else if (methodLower.includes('efectivo') || methodLower === 'cash') {
                      methodDisplay = '💵 Efectivo';
                      methodColor = '#059669';
                    } else if (methodLower.includes('tarjeta') || methodLower.includes('card')) {
                      methodDisplay = '💳 Tarjeta';
                      methodColor = '#3b82f6';
                    } else if (methodLower.includes('transferencia') || methodLower.includes('transfer')) {
                      methodDisplay = '🏦 Transferencia';
                      methodColor = '#8b5cf6';
                    } else if (methodLower.includes('regalo')) {
                      methodDisplay = '🎁 Regalo';
                      methodColor = '#f59e0b';
                    } else {
                      const shortMethod = paymentMethod.length > 25 ? paymentMethod.substring(0, 25) + '...' : paymentMethod;
                      methodDisplay = '📝 ' + shortMethod;
                    }
                    
                    return `
                      <tr style="border-bottom: 1px solid #e5e7eb; transition: background-color 0.2s;" 
                          onmouseover="this.style.backgroundColor='#f3f4f6'" 
                          onmouseout="this.style.backgroundColor='transparent'">
                        <td style="padding: 10px 8px; color: #1f2937; font-weight: 600;">${folio}</td>
                        <td style="padding: 10px 8px; color: #6b7280; white-space: nowrap;">
                          <div style="font-size: 0.85rem;">${dateStr}</div>
                          <div style="font-size: 0.8rem; color: #9ca3af;">${timeStr}</div>
                        </td>
                        <td style="padding: 10px 8px; color: #374151; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${clientName}">${clientName}</td>
                        <td style="padding: 10px 8px; color: ${methodColor}; font-size: 0.85rem; font-weight: 500; line-height: 1.4;">
                          ${methodDisplay}
                        </td>
                        <td style="padding: 10px 8px; text-align: right; color: #059669; font-weight: 600; white-space: nowrap;">
                          $${sale.total.toFixed(2)}
                        </td>
                      </tr>
                    `;
                  }).join('')}
              </tbody>
              <tfoot style="background: #f3f4f6; border-top: 2px solid #d1d5db;">
                <tr>
                  <td colspan="4" style="padding: 12px 8px; text-align: right; font-weight: 700; color: #1f2937;">
                    Total General:
                  </td>
                  <td style="padding: 12px 8px; text-align: right; font-weight: 700; color: #059669; font-size: 1rem;">
                    $${summary?.statistics?.totalAmount?.toFixed(2) || sales.reduce((sum, s) => sum + s.total, 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <style>
            /* Scrollbar personalizado para la tabla */
            div[style*="max-height: 500px"]::-webkit-scrollbar {
              width: 8px;
              height: 8px;
            }
            div[style*="max-height: 500px"]::-webkit-scrollbar-track {
              background: #f1f1f1;
              border-radius: 4px;
            }
            div[style*="max-height: 500px"]::-webkit-scrollbar-thumb {
              background: #888;
              border-radius: 4px;
            }
            div[style*="max-height: 500px"]::-webkit-scrollbar-thumb:hover {
              background: #555;
            }
          </style>
        </div>
      `,
      width: isMobile ? "95%" : "900px",
      showConfirmButton: false,
      showCloseButton: true,
      allowOutsideClick: true,
      allowEscapeKey: true,
    });
  };

  return (
    <div className="shift-history-page">
      <Header
        title="📊 Historial de Turnos"
        onBack={onBack}
        backText="← Volver al Menu Principal"
        className="shift-history-header"
      />
      
      <div className="shift-history-container">
        <div className="shift-history-content">
          {/* Columna izquierda - Lista de turnos */}
          <div className="shifts-list-section">
            {/* Resumen de totales */}
            <div className="totals-summary">
              <div className="total-item">
                <span className="total-label">💵 Efectivo Total:</span>
                <span className="total-value cash">
                  {totals.totalCash.toLocaleString("es-MX", {
                    style: "currency",
                    currency: "MXN",
                  })}
                </span>
              </div>
              <div className="total-item">
                <span className="total-label">💳 Tarjeta Total:</span>
                <span className="total-value cards">
                  {totals.totalCard.toLocaleString("es-MX", {
                    style: "currency",
                    currency: "MXN",
                  })}
                </span>
              </div>
              <div className="total-item">
                <span className="total-label">🎁 Regalo Total:</span>
                <span className="total-value regalo">
                  {shifts.reduce((sum, shift) => {
                    const regalo = calculateRegalo(shift);
                    return sum + regalo;
                  }, 0).toLocaleString("es-MX", {
                    style: "currency",
                    currency: "MXN",
                  })}
                </span>
              </div>
              <div className="total-item">
                <span className="total-label">📦 Total Turnos:</span>
                <span className="total-value shifts">
                  {totals.totalShifts}
                </span>
              </div>
            </div>

            <div className="filters-section">
              <div className="filter-group">
                <label className="filter-label">Desde:</label>
                <DatePicker
                  selected={startDate}
                  onChange={(date) => setStartDate(date || new Date())}
                  locale="es"
                  dateFormat="yyyy-MM-dd"
                  className="datepicker-input-large"
                />
              </div>
              <div className="filter-group">
                <label className="filter-label">Hasta:</label>
                <DatePicker
                  selected={endDate}
                  onChange={(date) => setEndDate(date || new Date())}
                  locale="es"
                  dateFormat="yyyy-MM-dd"
                  className="datepicker-input-large"
                />
              </div>
              {/*<div className="filter-group">
                <label className="filter-label">Estado:</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="datepicker-input-large"
                >
                  <option value="">Todos</option>
                  <option value="OPEN">Abiertos</option>
                  <option value="CLOSED">Cerrados</option>
                  <option value="CANCELLED">Cancelados</option>
                </select>
              </div> */}
            </div>

            {loading ? (
              <div className="loading-state">
                <p>Cargando turnos...</p>
              </div>
            ) : shifts.length > 0 ? (
              <div className="table-wrapper">
                <table className="shifts-table">
                  <thead>
                    <tr>
                      {/*<th>Folio</th>*/}
                      <th>Fecha Inicio</th>
                      <th>Caja</th>
                      <th>Cajero</th>
                      <th>Estado</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((shift) => (
                      <tr
                        key={shift.id}
                        className={selectedShift?.id === shift.id ? "selected" : ""}
                        onClick={() => handleSelectShift(shift)}
                      >
                        {/*<td className="folio-cell">{shift.shiftNumber}</td>*/}
                        <td className="date-cell">{formatDate(shift.startTime)}</td>
                        <td className="cash-register-cell">{shift.cashRegister}</td>
                        <td className="cashier-cell">{shift.cashierName || "Anónimo"}</td>
                        <td className="status-cell">{getStatusBadge(shift.status)}</td>
                        <td className="total-cell">
                          {(
                            (shift.totalCash || 0) +
                            (shift.totalCard || 0) +
                            (shift.totalTransfer || 0) +
                            (shift.totalOther || 0)
                          ).toLocaleString("es-MX", {
                            style: "currency",
                            currency: "MXN",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <p>No se encontraron turnos en el rango de fechas seleccionado</p>
              </div>
            )}
          </div>

          {/* Columna derecha - Detalles del turno */}
          {selectedShift ? (
            <div className="shift-details-section">
              <h2 className="details-title">Detalles del Turno</h2>
              
              {/* Información básica */}
              <div className="details-card">
                <h3 className="card-title">Información General</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Folio:</span>
                    <span className="info-value">{selectedShift.shiftNumber}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Estado:</span>
                    <span className="info-value">{getStatusBadge(selectedShift.status)}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Cajero:</span>
                    <span className="info-value">{selectedShift.cashierName || "Anónimo"}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Sucursal:</span>
                    <span className="info-value">{selectedShift.branch}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Caja:</span>
                    <span className="info-value">{selectedShift.cashRegister}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Fecha Inicio:</span>
                    <span className="info-value">{formatDate(selectedShift.startTime)}</span>
                  </div>
                  {selectedShift.endTime && (
                    <div className="info-item">
                      <span className="info-label">Fecha Cierre:</span>
                      <span className="info-value">{formatDate(selectedShift.endTime)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Totales por método de pago */}
              <div className="details-card">
                <h3 className="card-title">Totales por Método de Pago</h3>
                <div className="payment-methods-grid">
                  <div className="payment-method-item">
                    <span className="payment-label">💵 Efectivo:</span>
                    <span className="payment-value cash">
                      ${selectedShift.totalCash.toFixed(2)}
                    </span>
                  </div>
                  <div className="payment-method-item">
                    <span className="payment-label">💳 Tarjeta:</span>
                    <span className="payment-value card">
                      ${selectedShift.totalCard.toFixed(2)}
                    </span>
                  </div>
                  <div className="payment-method-item">
                    <span className="payment-label">📱 Transferencia:</span>
                    <span className="payment-value transfer">
                      ${selectedShift.totalTransfer.toFixed(2)}
                    </span>
                  </div>
                  {(() => {
                    const totalRegalo = calculateRegalo(selectedShift);
                    const totalOtros = selectedShift.totalOther - totalRegalo;
                    return (
                      <>
                        {totalRegalo > 0 && (
                          <div className="payment-method-item">
                            <span className="payment-label">🎁 Regalo:</span>
                            <span className="payment-value regalo">
                              ${totalRegalo.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {totalOtros > 0 && (
                          <div className="payment-method-item">
                            <span className="payment-label">📦 Otros:</span>
                            <span className="payment-value other">
                              ${totalOtros.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Créditos y Abonos - Solo si hay información disponible */}
              {shiftSummary?.creditsInfo && shiftSummary.creditsInfo.creditsCount > 0 && (
                <div className="details-card">
                  <h3 className="card-title">💳 Créditos y Abonos</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Créditos Generados:</span>
                      <span className="info-value" style={{ color: "#dc2626" }}>
                        {shiftSummary.creditsInfo.creditsCount} crédito(s) - ${shiftSummary.creditsInfo.totalCreditsGenerated.toFixed(2)}
                      </span>
                    </div>
                    {shiftSummary.creditsInfo.paymentsCount > 0 && (
                      <>
                        <div className="info-item">
                          <span className="info-label">Abonos en Efectivo:</span>
                          <span className="info-value" style={{ color: "#059669" }}>
                            +${shiftSummary.creditsInfo.totalCreditPaymentsCash.toFixed(2)}
                          </span>
                        </div>
                        {shiftSummary.creditsInfo.totalCreditPaymentsCard > 0 && (
                          <div className="info-item">
                            <span className="info-label">Abonos en Tarjeta:</span>
                            <span className="info-value" style={{ color: "#3b82f6" }}>
                              ${shiftSummary.creditsInfo.totalCreditPaymentsCard.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {shiftSummary.creditsInfo.totalCreditPaymentsOther > 0 && (
                          <div className="info-item">
                            <span className="info-label">Abonos Otros:</span>
                            <span className="info-value">
                              ${shiftSummary.creditsInfo.totalCreditPaymentsOther.toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div className="info-item">
                          <span className="info-label">Total Abonos:</span>
                          <span className="info-value" style={{ fontWeight: "600" }}>
                            {shiftSummary.creditsInfo.paymentsCount} abono(s) - ${(
                              shiftSummary.creditsInfo.totalCreditPaymentsCash +
                              shiftSummary.creditsInfo.totalCreditPaymentsCard +
                              shiftSummary.creditsInfo.totalCreditPaymentsOther
                            ).toFixed(2)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Cierre de turno - Solo si está cerrado */}
              {selectedShift.status === "CLOSED" && (
                <div className="details-card closing-card">
                  <h3 className="card-title closing-title">💰 Cierre de Turno</h3>
                  <div className="closing-details">
                    <div className="closing-item">
                      <span className="closing-label">Fondo Inicial:</span>
                      <span className="closing-value">
                        ${selectedShift.initialCash.toFixed(2)}
                      </span>
                    </div>
                    <div className="closing-item">
                      <span className="closing-label">Ventas en Efectivo:</span>
                      <span className="closing-value cash">
                        ${selectedShift.totalCash.toFixed(2)}
                      </span>
                    </div>
                    {shiftSummary?.creditsInfo && shiftSummary.creditsInfo.totalCreditPaymentsCash > 0 && (
                      <div className="closing-item">
                        <span className="closing-label">Abonos en Efectivo:</span>
                        <span className="closing-value" style={{ color: "#059669" }}>
                          +${shiftSummary.creditsInfo.totalCreditPaymentsCash.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {cashMovements.length > 0 && (
                      <div className="closing-item">
                        <span className="closing-label">Movimientos Netos:</span>
                        <span className="closing-value">
                          {(() => {
                            const neto = cashMovements.reduce((sum, m) => {
                              return sum + (m.type === "ENTRADA" ? m.amount : -m.amount);
                            }, 0);
                            return (
                              <span style={{ color: neto >= 0 ? "#059669" : "#dc2626" }}>
                                {neto >= 0 ? "+" : ""}${neto.toFixed(2)}
                              </span>
                            );
                          })()}
                        </span>
                      </div>
                    )}
                    <div className="closing-item highlight">
                      <span className="closing-label">Total Esperado en Efectivo:</span>
                      <span className="closing-value expected">
                        ${selectedShift.expectedCash?.toFixed(2) || "0.00"}
                      </span>
                    </div>
                    <div className="closing-item highlight">
                      <span className="closing-label">Efectivo Contado:</span>
                      <span className="closing-value final">
                        ${selectedShift.finalCash?.toFixed(2) || "0.00"}
                      </span>
                    </div>
                    <div className="closing-item highlight difference">
                      <span className="closing-label">Diferencia:</span>
                      <span
                        className="closing-value"
                        style={{
                          color:
                            (selectedShift.difference || 0) >= 0 ? "#059669" : "#dc2626",
                          fontWeight: "700",
                          fontSize: "1.3rem",
                        }}
                      >
                        {(selectedShift.difference || 0) >= 0 ? "+" : ""}
                        ${(selectedShift.difference || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Movimientos de efectivo */}
              {cashMovements.length > 0 && (
                <div className="details-card">
                  <h3 className="card-title">Movimientos de Efectivo</h3>
                  <div className="movements-list">
                    {cashMovements.map((movement) => (
                      <div key={movement.id} className="movement-item">
                        <div className="movement-type">
                          <span
                            style={{
                              color: movement.type === "ENTRADA" ? "#059669" : "#dc2626",
                              fontWeight: "700",
                              fontSize: "1.1rem",
                            }}
                          >
                            {movement.type === "ENTRADA" ? "💰 +" : "💸 -"}
                            ${movement.amount.toFixed(2)}
                          </span>
                        </div>
                        <div className="movement-details">
                          <span className="movement-reason">{movement.reason || "Sin razón"}</span>
                          <span className="movement-date">
                            {formatDate(movement.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resumen completo si está disponible */}
              {shiftSummary && selectedShift.status === "CLOSED" && (
                <div className="details-card">
                  <h3 className="card-title">Resumen Completo</h3>
                  <div className="summary-grid">
                    <div className="summary-item">
                      <span className="summary-label">Total de Ventas:</span>
                      <span className="summary-value">
                        {shiftSummary.statistics.totalSales}
                      </span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Monto Total:</span>
                      <span className="summary-value">
                        ${shiftSummary.statistics.totalAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Ticket Promedio:</span>
                      <span className="summary-value">
                        ${shiftSummary.statistics.averageTicket.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Notas si existen */}
              {selectedShift.notes && (
                <div className="details-card">
                  <h3 className="card-title">Notas</h3>
                  <p className="notes-text">{selectedShift.notes}</p>
                </div>
              )}

              {/* Botón para ver folios del turno */}
              <div className="details-card" style={{ marginTop: "20px" }}>
                <button
                  onClick={() => showFoliosModal(selectedShift, shiftSummary)}
                  style={{
                    width: "100%",
                    padding: "14px 20px",
                    backgroundColor: "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "1rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#2563eb";
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#3b82f6";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";
                  }}
                >
                  📋 Ver Folios del Turno
                </button>
              </div>
            </div>
          ) : (
            <div className="no-selection">
              <p>Selecciona un turno para ver sus detalles</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

