import { useEffect, useState } from "react";
import "../../styles/pages/sales/daySalesModal.css";
import type { CashRegisterShift, ShiftSummary } from "../../types/index";
import { getShiftsByDateRange, getShiftSummary } from "../../api/cashRegister";
import DatePicker, { registerLocale } from "react-datepicker";
import { es } from "date-fns/locale/es";
import "react-datepicker/dist/react-datepicker.css";
import Swal from "sweetalert2";

registerLocale("es", es);

interface ShiftHistoryModalProps {
  onClose?: () => void;
  branch?: string;
  cashRegister?: string;
}

export default function ShiftHistoryModal({
  onClose,
  branch,
  cashRegister,
}: ShiftHistoryModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<CashRegisterShift | null>(
    null
  );
  const [shiftSummary, setShiftSummary] = useState<ShiftSummary | null>(null);
  const [shifts, setShifts] = useState<CashRegisterShift[]>([]);
  const [startDate, setStartDate] = useState<Date>(
    new Date(new Date().setDate(new Date().getDate() - 7))
  );
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      fetchShifts();
    }
  }, [startDate, endDate, isOpen, filterStatus]);

  const openModal = async () => {
    setIsOpen(true);
    fetchShifts();
  };

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const start = startDate.toLocaleDateString("en-CA");
      const end = endDate.toLocaleDateString("en-CA");

      const params: Record<string, string> = {
        startDate: start,
        endDate: end,
      };

      if (branch) params.branch = branch;
      if (cashRegister) params.cashRegister = cashRegister;
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
    
    // Si el turno está abierto, no intentar cargar el resumen completo
    // ya que no tiene datos de cierre
    if (shift.status === "OPEN") {
      setShiftSummary(null);
      return;
    }
    
    try {
      const summary = await getShiftSummary(shift.id);
      setShiftSummary(summary);
    } catch (error) {
      console.error("Error al cargar resumen:", error);
      setShiftSummary(null);
    }
  };

  const closeModal = () => {
    setSelectedShift(null);
    setShiftSummary(null);
    setIsOpen(false);
    if (onClose) {
      setTimeout(() => {
        onClose();
      }, 100);
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
          fontWeight: "600",
          fontSize: "0.85rem",
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

  return (
    <>
      <button className="btn touch-btn today-sales" onClick={openModal}>
        📊 Historial de Turnos
      </button>

      {isOpen && (
        <div className="modal-overlay">
          <div className="modal-container-day-sales">
            <h2 className="modal-title text-lg font-semibold">
              <span className="text-green-600">
                💵 Efectivo:{" "}
                {totals.totalCash.toLocaleString("es-MX", {
                  style: "currency",
                  currency: "MXN",
                })}
              </span>{" "}
              <span className="text-blue-600 ml-4">
                💳 Tarjeta:{" "}
                {totals.totalCard.toLocaleString("es-MX", {
                  style: "currency",
                  currency: "MXN",
                })}
              </span>
              <span className="text-purple-600 ml-4">
                📱 Transferencia:{" "}
                {totals.totalTransfer.toLocaleString("es-MX", {
                  style: "currency",
                  currency: "MXN",
                })}
              </span>
            </h2>
            <div className="modal-content">
              {/* Left column - shifts list */}
              <div className="sales-list">
                <div style={{ marginBottom: "15px" }}>
                  <div style={{ marginBottom: "10px" }}>
                    <label className="datepicker-label">Desde:</label>
                    <DatePicker
                      selected={startDate}
                      onChange={(date) => setStartDate(date || new Date())}
                      locale="es"
                      dateFormat="yyyy-MM-dd"
                      className="datepicker-input"
                    />
                  </div>
                  <div style={{ marginBottom: "10px" }}>
                    <label className="datepicker-label">Hasta:</label>
                    <DatePicker
                      selected={endDate}
                      onChange={(date) => setEndDate(date || new Date())}
                      locale="es"
                      dateFormat="yyyy-MM-dd"
                      className="datepicker-input"
                    />
                  </div>
                  <div style={{ marginBottom: "10px" }}>
                    <label className="datepicker-label">Estado:</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="datepicker-input"
                      style={{ cursor: "pointer" }}
                    >
                      <option value="">Todos</option>
                      <option value="OPEN">Abiertos</option>
                      <option value="CLOSED">Cerrados</option>
                      <option value="CANCELLED">Cancelados</option>
                    </select>
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>
                    Total de turnos: {shifts.length}
                  </div>
                </div>
                {loading ? (
                  <div style={{ textAlign: "center", padding: "20px" }}>
                    <p>Cargando turnos...</p>
                  </div>
                ) : shifts.length > 0 ? (
                  <div className="table-container">
                    <table className="sales-table">
                      <thead>
                        <tr>
                          <th>Folio</th>
                          <th>Fecha</th>
                          <th>Estado</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shifts.map((shift) => (
                          <tr
                            key={shift.id}
                            className={
                              selectedShift?.id === shift.id ? "selected" : ""
                            }
                            onClick={() => handleSelectShift(shift)}
                          >
                            <td>{shift.shiftNumber}</td>
                            <td style={{ fontSize: "0.85rem" }}>
                              {formatDate(shift.startTime)}
                            </td>
                            <td>{getStatusBadge(shift.status)}</td>
                            <td>
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
                  <p className="no-selection">
                    No se encontraron turnos en el rango de fechas seleccionado
                  </p>
                )}
              </div>
              {/* Right column - shift details */}
              {selectedShift ? (
                <div className="sale-details" style={{ marginTop: "20px" }}>
                  {/* Información básica del turno */}
                  <div
                    style={{
                      backgroundColor: "#f3f4f6",
                      padding: "15px",
                      borderRadius: "8px",
                      marginBottom: "15px",
                    }}
                  >
                    <h3 style={{ marginTop: 0, marginBottom: "10px" }}>
                      {selectedShift.shiftNumber}
                    </h3>
                    <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>
                      <p>
                        <strong>Sucursal:</strong> {selectedShift.branch}
                      </p>
                      <p>
                        <strong>Caja:</strong> {selectedShift.cashRegister}
                      </p>
                      {selectedShift.cashierName && (
                        <p>
                          <strong>Cajero:</strong> {selectedShift.cashierName}
                        </p>
                      )}
                      <p>
                        <strong>Inicio:</strong> {formatDate(selectedShift.startTime)}
                      </p>
                      {selectedShift.endTime && (
                        <p>
                          <strong>Fin:</strong> {formatDate(selectedShift.endTime)}
                        </p>
                      )}
                      <p>{getStatusBadge(selectedShift.status)}</p>
                    </div>
                  </div>

                  {/* Mensaje para turnos abiertos */}
                  {selectedShift.status === "OPEN" && (
                    <div
                      style={{
                        backgroundColor: "#d1fae5",
                        border: "2px solid #059669",
                        padding: "20px",
                        borderRadius: "8px",
                        marginBottom: "15px",
                        textAlign: "center",
                      }}
                    >
                      <h4 style={{ marginTop: 0, marginBottom: "10px", color: "#059669" }}>
                        🟢 Turno en Proceso
                      </h4>
                      <p style={{ fontSize: "0.95rem", color: "#065f46", margin: 0 }}>
                        Este turno está actualmente abierto. Los datos finales estarán disponibles 
                        una vez que se cierre el turno.
                      </p>
                    </div>
                  )}

                  {/* Información de fondos para turnos abiertos */}
                  {selectedShift.status === "OPEN" && (
                    <div
                      style={{
                        backgroundColor: "#f3f4f6",
                        padding: "15px",
                        borderRadius: "8px",
                        marginBottom: "15px",
                      }}
                    >
                      <h4 style={{ marginTop: 0, marginBottom: "10px" }}>
                        Fondos Actuales
                      </h4>
                      <div style={{ fontSize: "0.9rem" }}>
                        <p>
                          <strong>Fondo Inicial:</strong> $
                          {selectedShift.initialCash.toFixed(2)}
                        </p>
                        <p>
                          <strong>Efectivo en Ventas:</strong> $
                          {selectedShift.totalCash.toFixed(2)}
                        </p>
                        <p style={{ 
                          fontWeight: "600", 
                          color: "#059669",
                          marginTop: "10px",
                          paddingTop: "10px",
                          borderTop: "1px solid #d1d5db"
                        }}>
                          <strong>Efectivo Esperado:</strong> $
                          {(selectedShift.initialCash + selectedShift.totalCash).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Información completa para turnos cerrados */}
                  {selectedShift.status !== "OPEN" && shiftSummary && (
                    <>
                      <div
                        style={{
                          backgroundColor: "#f3f4f6",
                          padding: "15px",
                          borderRadius: "8px",
                          marginBottom: "15px",
                        }}
                      >
                        <h4 style={{ marginTop: 0, marginBottom: "10px" }}>
                          Fondos
                        </h4>
                        <div style={{ fontSize: "0.9rem" }}>
                          <p>
                            <strong>Fondo Inicial:</strong> $
                            {shiftSummary.shift.initialCash.toFixed(2)}
                          </p>
                          {shiftSummary.shift.finalCash !== undefined && (
                            <>
                              <p>
                                <strong>Efectivo Esperado:</strong> $
                                {shiftSummary.shift.expectedCash?.toFixed(2)}
                              </p>
                              <p>
                                <strong>Efectivo Contado:</strong> $
                                {shiftSummary.shift.finalCash.toFixed(2)}
                              </p>
                              <p
                                style={{
                                  color:
                                    shiftSummary.shift.difference === 0
                                      ? "#059669"
                                      : shiftSummary.shift.difference! > 0
                                      ? "#dc2626"
                                      : "#3b82f6",
                                  fontWeight: "600",
                                }}
                              >
                                <strong>Diferencia:</strong>{" "}
                                {shiftSummary.shift.difference! >= 0 ? "+" : ""}
                                ${shiftSummary.shift.difference?.toFixed(2)}
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          backgroundColor: "#f3f4f6",
                          padding: "15px",
                          borderRadius: "8px",
                          marginBottom: "15px",
                        }}
                      >
                        <h4 style={{ marginTop: 0, marginBottom: "10px" }}>
                          Estadísticas
                        </h4>
                        <div style={{ fontSize: "0.9rem" }}>
                          <p>
                            <strong>Total de Ventas:</strong>{" "}
                            {shiftSummary.statistics.totalSales}
                          </p>
                          <p>
                            <strong>Monto Total:</strong> $
                            {shiftSummary.statistics.totalAmount.toFixed(2)}
                          </p>
                          <p>
                            <strong>Ticket Promedio:</strong> $
                            {shiftSummary.statistics.averageTicket.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {shiftSummary.shift.notes && (
                        <div
                          style={{
                            backgroundColor: "#fef3c7",
                            padding: "15px",
                            borderRadius: "8px",
                            marginBottom: "15px",
                          }}
                        >
                          <h4 style={{ marginTop: 0, marginBottom: "10px" }}>
                            Observaciones
                          </h4>
                          <p style={{ fontSize: "0.9rem", margin: 0 }}>
                            {shiftSummary.shift.notes}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Totales por método de pago - siempre visible */}
                  <div
                    style={{
                      backgroundColor: "#f3f4f6",
                      padding: "15px",
                      borderRadius: "8px",
                      marginBottom: "15px",
                    }}
                  >
                    <h4 style={{ marginTop: 0, marginBottom: "10px" }}>
                      Totales por Método de Pago
                    </h4>
                    <div style={{ fontSize: "0.9rem" }}>
                      <p>
                        <strong>💵 Efectivo:</strong> $
                        {selectedShift.totalCash.toFixed(2)}
                        {shiftSummary && (
                          <span style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                            {" "}({Object.entries(shiftSummary.paymentMethods)
                              .find(([key]) =>
                                key.toLowerCase().includes("efectivo")
                              )?.[1]?.count || 0} ventas)
                          </span>
                        )}
                      </p>
                      <p>
                        <strong>💳 Tarjeta:</strong> $
                        {selectedShift.totalCard.toFixed(2)}
                        {shiftSummary && (
                          <span style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                            {" "}({Object.entries(shiftSummary.paymentMethods)
                              .find(([key]) => key.toLowerCase().includes("tarjeta"))
                              ?.[1]?.count || 0} ventas)
                          </span>
                        )}
                      </p>
                      <p>
                        <strong>📱 Transferencia:</strong> $
                        {selectedShift.totalTransfer.toFixed(2)}
                        {shiftSummary && (
                          <span style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                            {" "}({Object.entries(shiftSummary.paymentMethods)
                              .find(([key]) =>
                                key.toLowerCase().includes("transferencia")
                              )?.[1]?.count || 0} ventas)
                          </span>
                        )}
                      </p>
                      <p>
                        <strong>📦 Otros:</strong> $
                        {selectedShift.totalOther.toFixed(2)}
                        {shiftSummary && (
                          <span style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                            {" "}({Object.entries(shiftSummary.paymentMethods)
                              .filter(
                                ([key]) =>
                                  !key.toLowerCase().includes("efectivo") &&
                                  !key.toLowerCase().includes("tarjeta") &&
                                  !key.toLowerCase().includes("transferencia")
                              )
                              .reduce((sum, [, val]) => sum + val.count, 0)} ventas)
                          </span>
                        )}
                      </p>
                      <p style={{ 
                        fontWeight: "600", 
                        marginTop: "10px",
                        paddingTop: "10px",
                        borderTop: "1px solid #d1d5db"
                      }}>
                        <strong>Total General:</strong> $
                        {(
                          selectedShift.totalCash +
                          selectedShift.totalCard +
                          selectedShift.totalTransfer +
                          selectedShift.totalOther
                        ).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Estadísticas para turnos cerrados */}
                  {/*selectedShift.status !== "OPEN" && shiftSummary && (
                    <div
                      style={{
                        backgroundColor: "#f3f4f6",
                        padding: "15px",
                        borderRadius: "8px",
                        marginBottom: "15px",
                      }}
                    >
                      <h4 style={{ marginTop: 0, marginBottom: "10px" }}>
                        Estadísticas
                      </h4>
                      <div style={{ fontSize: "0.9rem" }}>
                        <p>
                          <strong>Total de Ventas:</strong>{" "}
                          {shiftSummary.statistics.totalSales}
                        </p>
                        <p>
                          <strong>Monto Total:</strong> $
                          {shiftSummary.statistics.totalAmount.toFixed(2)}
                        </p>
                        <p>
                          <strong>Ticket Promedio:</strong> $
                          {shiftSummary.statistics.averageTicket.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )*/}
                </div>
              ) : (
                <p className="no-selection">Selecciona un turno</p>
              )}
            </div>

            {/* Footer buttons */}
            <div className="modal-footer">
              <button
                className="btn touch-btn close-btn-day-sales"
                onClick={closeModal}
              >
                ↩️ Regresar
              </button>
              <button
                className="btn touch-btn load-btn"
                onClick={fetchShifts}
                disabled={loading}
              >
                🔄 Actualizar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

