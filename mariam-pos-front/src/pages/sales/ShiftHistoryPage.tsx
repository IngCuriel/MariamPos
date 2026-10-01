import { useEffect, useState } from "react";
import Header from "../../components/Header";
import type {
  CashRegisterShift,
  ShiftSummary,
  CashMovement,
  Sale,
  SaleCancellation,
  SaleReturn,
  ReversalReceipt,
  CancelSaleResponse,
  ReturnSaleResponse,
} from "../../types/index";
import { getShiftsByDateRange, getShiftSummary, getCashMovementsByShift, getShiftById } from "../../api/cashRegister";
import { getSaleById, updateSalePaymentMethod } from "../../api/sales";
import { getSaleReversals } from "../../api/returns";
import CancelSaleModal from "./CancelSaleModal";
import ReturnSaleModal from "./ReturnSaleModal";
import CancellationReturnReceipt from "./CancellationReturnReceipt";
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
  // Ventas del turno seleccionado (con sus details), para las acciones de
  // Cancelar / Devolver. Se puebla tanto para turnos ABIERTOS (vía getShiftById)
  // como CERRADOS (vía getShiftSummary), de modo que las acciones estén
  // disponibles sin importar el estado del turno.
  const [shiftSales, setShiftSales] = useState<Sale[]>([]);
  const [shifts, setShifts] = useState<CashRegisterShift[]>([]);
  const [startDate, setStartDate] = useState<Date>(
    new Date(new Date().setDate(new Date().getDate() /*- 7*/))
  );
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [filterStatus, _setFilterStatus] = useState<string>("");

  // --- Cancelaciones / Devoluciones (tarea 12.1) ---
  // Venta completa (con details) cargada vía getSaleById para abrir un modal.
  const [actionSale, setActionSale] = useState<Sale | null>(null);
  // Modal activo para la venta cargada: "cancel" | "return" | null.
  const [activeModal, setActiveModal] = useState<"cancel" | "return" | null>(null);
  // Carga en curso de la venta completa antes de abrir el modal.
  const [loadingSaleId, setLoadingSaleId] = useState<number | null>(null);
  // Comprobante a imprimir tras una cancelación/devolución exitosa (Req 10).
  const [reversalReceipt, setReversalReceipt] = useState<ReversalReceipt | null>(null);

  // Carga la venta completa (con details) y abre el modal indicado.
  // Los listados del resumen de turno son ligeros (sin details), por eso se
  // consulta GET /sales/:id antes de abrir, necesario para la devolución (Req 2.1).
  const openSaleAction = async (saleId: number, modal: "cancel" | "return") => {
    try {
      setLoadingSaleId(saleId);
      // Si la venta del turno ya trae sus details (caso getShiftById), se usa
      // directamente; si no (listados ligeros), se consulta GET /sales/:id.
      const local = shiftSales.find((s) => s.id === saleId);
      const fullSale =
        local && Array.isArray(local.details) && local.details.length > 0
          ? local
          : await getSaleById(saleId);
      if (!fullSale || !fullSale.id) {
        throw new Error("Venta no encontrada");
      }
      setActionSale(fullSale);
      setActiveModal(modal);
    } catch (error) {
      console.error("Error al cargar la venta:", error);
      Swal.fire({
        icon: "error",
        title: "No se pudo cargar la venta",
        text: "Intenta de nuevo.",
        confirmButtonText: "Entendido",
      });
    } finally {
      setLoadingSaleId(null);
    }
  };

  const closeSaleAction = () => {
    setActiveModal(null);
    setActionSale(null);
  };

  // Cerrar el modal de detalle del turno con ESC (solo si no hay otro modal
  // de acción abierto encima).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedShift && !activeModal && !reversalReceipt) {
        setSelectedShift(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedShift, activeModal, reversalReceipt]);

  // Refresca los datos del turno seleccionado tras una reversión exitosa, para
  // que los estados de las ventas (Cancelada / Devuelta) se actualicen en la UI.
  const refreshSelectedShift = async () => {
    if (!selectedShift) return;
    try {
      const movements = await getCashMovementsByShift(selectedShift.id);
      setCashMovements(movements);
    } catch (error) {
      console.error("Error al recargar movimientos:", error);
    }
    if (selectedShift.status !== "OPEN") {
      try {
        const summary = await getShiftSummary(selectedShift.id);
        setShiftSummary(summary);
        setShiftSales((summary.sales as unknown as Sale[]) ?? []);
        if (summary.cashMovements) setCashMovements(summary.cashMovements);
      } catch (error) {
        console.error("Error al recargar resumen:", error);
      }
    } else {
      // Turno abierto: recargar sus ventas para reflejar el nuevo estado
      // (Cancelada / Parcialmente Devuelta / Devuelta) tras la reversión.
      try {
        const fullShift = await getShiftById(selectedShift.id);
        setShiftSales(fullShift.sales ?? []);
      } catch (error) {
        console.error("Error al recargar ventas del turno:", error);
      }
    }
    // Refrescar también el listado de turnos (totales por método de pago).
    fetchShifts();
  };

  // Éxito de cancelación: cierra el modal, muestra el comprobante y refresca.
  const handleCancelSuccess = (response: CancelSaleResponse) => {
    closeSaleAction();
    setReversalReceipt(response.receipt);
    refreshSelectedShift();
  };

  // Éxito de devolución: cierra el modal, muestra el comprobante y refresca.
  const handleReturnSuccess = (response: ReturnSaleResponse) => {
    closeSaleAction();
    setReversalReceipt(response.receipt);
    refreshSelectedShift();
  };

  // Muestra las reversiones (cancelación / devoluciones) asociadas a una venta
  // consultando GET /sales/:id/reversals (Req 9.4).
  const showReversals = async (saleId: number, folio?: string) => {
    // Usar el folio solo si no está vacío; si no, caer al id numérico.
    const saleLabel = folio && folio.trim() ? folio.trim() : `#${saleId}`;
    try {
      setLoadingSaleId(saleId);
      const data = await getSaleReversals(saleId);
      const sale = data as (Sale & {
        cancellation?: SaleCancellation | null;
        returns?: SaleReturn[];
      });
      const cancellation = sale?.cancellation ?? null;
      const returns = sale?.returns ?? [];

      const fmt = (iso?: string | Date) =>
        iso
          ? new Date(iso).toLocaleString("es-MX", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "N/D";

      if (!cancellation && returns.length === 0) {
        Swal.fire({
          icon: "info",
          title: `Reversiones de ${saleLabel}`,
          text: "Esta venta no tiene cancelaciones ni devoluciones registradas.",
          confirmButtonText: "Cerrar",
        });
        return;
      }

      // Infiere cómo se devolvió el dinero a partir de los datos guardados:
      // - con movimiento de efectivo (cashMovementId) → Efectivo (salió de caja)
      // - sin movimiento pero con monto > 0 → Transferencia / por fuera
      // - monto 0 → no se devolvió dinero
      const refundMethodLabel = (rec: {
        cashMovementId?: number | null;
        refundedAmount?: number;
      }) => {
        const amount = rec.refundedAmount ?? 0;
        if (rec.cashMovementId) return "💵 Efectivo (salió de caja)";
        if (amount > 0) return "🏦 Transferencia / por fuera (no afectó caja)";
        return "🚫 No se devolvió dinero";
      };

      // Cómo se aplicó al inventario (clasificación del motivo).
      const inventoryLabel = (reasonType?: string) =>
        reasonType === "merma"
          ? "🗑️ Merma (no regresó a existencias)"
          : "📦 Regresó a existencias";

      const cancelHtml = cancellation
        ? `
          <div style="padding:12px;border:1px solid #fecaca;background:#fef2f2;border-radius:8px;margin-bottom:10px;">
            <p style="margin:2px 0;font-weight:600;color:#b91c1c;">🚫 Cancelación</p>
            <p style="margin:2px 0;">Motivo: ${cancellation.reason ?? "N/D"}</p>
            <p style="margin:2px 0;">Fecha: ${fmt(cancellation.createdAt)}</p>
            <p style="margin:2px 0;">Cajera: ${cancellation.createdBy ?? "N/D"}</p>
            <p style="margin:2px 0;">Devolución del dinero: ${refundMethodLabel(cancellation)}</p>
            <p style="margin:2px 0;">Inventario: ${inventoryLabel(cancellation.reasonType)}</p>
            <p style="margin:2px 0;font-weight:600;">Monto devuelto: $${(cancellation.refundedAmount ?? 0).toFixed(2)}</p>
          </div>`
        : "";

      const returnsHtml = returns.length
        ? returns
            .map((r) => {
              const lines = (r.lines ?? []) as Array<{
                quantity: number;
                subTotal: number;
                saleDetail?: { productName?: string | null };
              }>;
              const linesHtml = lines.length
                ? `<div style="margin:6px 0 2px;padding:8px;background:white;border:1px solid #dbeafe;border-radius:6px;">
                     <p style="margin:0 0 4px;font-weight:600;color:#374151;">Productos devueltos:</p>
                     ${lines
                       .map(
                         (l) =>
                           `<div style="display:flex;justify-content:space-between;gap:8px;margin:1px 0;">
                              <span>${l.saleDetail?.productName ?? "Producto"} × ${l.quantity}</span>
                              <span style="font-weight:600;">$${(l.subTotal ?? 0).toFixed(2)}</span>
                            </div>`
                       )
                       .join("")}
                   </div>`
                : "";
              return `
          <div style="padding:12px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:8px;margin-bottom:10px;">
            <p style="margin:2px 0;font-weight:600;color:#1d4ed8;">↩️ Devolución</p>
            <p style="margin:2px 0;">Motivo: ${r.reason ?? "N/D"}</p>
            <p style="margin:2px 0;">Fecha: ${fmt(r.createdAt)}</p>
            <p style="margin:2px 0;">Cajera: ${r.createdBy ?? "N/D"}</p>
            <p style="margin:2px 0;">Devolución del dinero: ${refundMethodLabel(r)}</p>
            <p style="margin:2px 0;">Inventario: ${inventoryLabel(r.reasonType)}</p>
            ${linesHtml}
            <p style="margin:4px 0 2px;font-weight:600;">Monto devuelto: $${(r.refundedAmount ?? 0).toFixed(2)}</p>
          </div>`;
            })
            .join("")
        : "";

      Swal.fire({
        title: `Reversiones de ${saleLabel}`,
        html: `<div style="text-align:left;font-size:0.9rem;">${cancelHtml}${returnsHtml}</div>`,
        width: "560px",
        showConfirmButton: true,
        confirmButtonText: "Cerrar",
      });
    } catch (error) {
      console.error("Error al cargar reversiones:", error);
      Swal.fire({
        icon: "error",
        title: "No se pudieron cargar las reversiones",
        text: "Intenta de nuevo.",
        confirmButtonText: "Entendido",
      });
    } finally {
      setLoadingSaleId(null);
    }
  };

  // Corregir el método de pago de una venta (solo métodos simples, turno abierto).
  // Útil cuando se cobró con tarjeta/transferencia pero quedó como efectivo.
  const correctPayment = async (saleId: number, folio?: string) => {
    // Usar el folio solo si no está vacío; si no, caer al id numérico.
    const saleLabel = folio && folio.trim() ? folio.trim() : `#${saleId}`;
    const { value: method } = await Swal.fire<string>({
      title: `Corregir método de pago - ${saleLabel}`,
      input: "radio",
      inputOptions: {
        Efectivo: "💵 Efectivo",
        Tarjeta: "💳 Tarjeta",
        Transferencia: "🏦 Transferencia",
        Regalo: "🎁 Regalo",
      },
      inputValidator: (v) => (!v ? "Selecciona un método de pago" : undefined),
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
    });

    if (!method) return;

    try {
      setLoadingSaleId(saleId);
      await updateSalePaymentMethod(saleId, method);
      Swal.fire({
        icon: "success",
        title: "Método actualizado",
        text: `El pago de la venta ${saleLabel} ahora es ${method}.`,
        timer: 1800,
        showConfirmButton: false,
      });
      await refreshSelectedShift();
    } catch (error: any) {
      const data = error?.response?.data;
      Swal.fire({
        icon: "warning",
        title: "No se pudo corregir el pago",
        text:
          data?.error ||
          "Revisa que la venta no esté cancelada y que su turno esté abierto.",
        confirmButtonText: "Entendido",
      });
    } finally {
      setLoadingSaleId(null);
    }
  };

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
    
    // Si el turno está abierto, no se calcula el resumen de cierre (no aplica),
    // pero sí cargamos sus ventas (con details) para habilitar Cancelar/Devolver.
    if (shift.status === "OPEN") {
      setShiftSummary(null);
      try {
        const fullShift = await getShiftById(shift.id);
        setShiftSales(fullShift.sales ?? []);
      } catch (error) {
        console.error("Error al cargar ventas del turno:", error);
        setShiftSales([]);
      }
      return;
    }

    try {
      const summary = await getShiftSummary(shift.id);
      setShiftSummary(summary);
      // Las ventas del summary alimentan las acciones de reversión para turnos
      // cerrados. (Están tipadas de forma ligera en ShiftSummary, por eso el
      // cast; traen al menos id/folio/total/paymentMethod/status/createdAt.)
      setShiftSales((summary.sales as unknown as Sale[]) ?? []);
      if (summary.cashMovements) {
        setCashMovements(summary.cashMovements);
      }
    } catch (error) {
      console.error("Error al cargar resumen:", error);
      setShiftSummary(null);
      setShiftSales([]);
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
                      <th>Turno</th>
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
                        <td className="folio-cell">#{shift.id}</td>
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
        </div>
      </div>

      {/* Modal grande con el detalle del turno seleccionado */}
      {selectedShift && (
        <div
          className="shift-detail-overlay"
          onClick={() => setSelectedShift(null)}
        >
          <div
            className="shift-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shift-detail-modal-header">
              <h2 className="details-title">
                Detalle del Turno #{selectedShift.id}
              </h2>
              <button
                className="shift-detail-close"
                onClick={() => setSelectedShift(null)}
                title="Cerrar (ESC)"
              >
                ✕
              </button>
            </div>

            <div className="shift-detail-modal-body">
              {/* Información básica */}
              <div className="details-card">
                <h3 className="card-title">Información General</h3>
                <div className="info-grid">
                  {/* Fila 1: Estado · Fecha Inicio · Fecha Cierre */}
                  <div className="info-item">
                    <span className="info-label">Estado:</span>
                    <span className="info-value">{getStatusBadge(selectedShift.status)}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Fecha Inicio:</span>
                    <span className="info-value">{formatDate(selectedShift.startTime)}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Fecha Cierre:</span>
                    <span className="info-value">
                      {selectedShift.endTime ? formatDate(selectedShift.endTime) : "—"}
                    </span>
                  </div>
                  {/* Fila 2: Cajero · Caja · Sucursal */}
                  <div className="info-item">
                    <span className="info-label">Cajero:</span>
                    <span className="info-value">{selectedShift.cashierName || "Anónimo"}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Caja:</span>
                    <span className="info-value">{selectedShift.cashRegister}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Sucursal:</span>
                    <span className="info-value">{selectedShift.branch}</span>
                  </div>
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

              {/* Ventas del turno con acciones de Cancelar / Devolver (Req 1.5, 2.1, 9.4).
                  Disponible tanto para turnos abiertos como cerrados. Esta sección
                  unifica el listado de ventas (folio, fecha, cliente, total) con las
                  acciones de reversión; reemplaza al antiguo modal "Ver Folios". */}
              {shiftSales.length > 0 && (
                <div className="details-card">
                  <h3 className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>🧾 Ventas del Turno ({shiftSales.length})</span>
                    <span style={{ color: "#059669", fontWeight: 700 }}>
                      Total: ${shiftSales.reduce((sum, s) => sum + (s.total || 0), 0).toFixed(2)}
                    </span>
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "340px", overflowY: "auto" }}>
                    {[...shiftSales]
                      .sort(
                        (a, b) =>
                          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                      )
                      .map((sale) => {
                        const isCancelled = sale.status === "Cancelada";
                        const isLoadingThis = loadingSaleId === sale.id;
                        const folioLabel = sale.folio || `#${sale.id}`;
                        return (
                          <div
                            key={sale.id}
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "6px",
                              padding: "0.5rem 0.65rem",
                              border: "1px solid #e5e7eb",
                              borderRadius: "7px",
                              backgroundColor: "white",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontWeight: 600,
                                  color: "#1f2937",
                                  fontSize: "0.9rem",
                                }}
                              >
                                {folioLabel} · ${sale.total.toFixed(2)}
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "1px" }}>
                                {formatDate(sale.createdAt)}
                                {sale.clientName ? ` · ${sale.clientName}` : ""}
                              </div>
                              <div style={{ fontSize: "0.78rem", color: "#6b7280" }}>
                                {sale.paymentMethod || "No especificado"}
                                {sale.status ? (
                                  <span
                                    style={{
                                      marginLeft: "8px",
                                      padding: "1px 8px",
                                      borderRadius: "999px",
                                      fontSize: "0.72rem",
                                      fontWeight: 600,
                                      color: isCancelled ? "#b91c1c" : "#047857",
                                      backgroundColor: isCancelled ? "#fee2e2" : "#d1fae5",
                                    }}
                                  >
                                    {sale.status}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                gap: "6px",
                                flexShrink: 0,
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                onClick={() => openSaleAction(sale.id, "cancel")}
                                disabled={isCancelled || isLoadingThis}
                                title={
                                  isCancelled
                                    ? "La venta ya está cancelada"
                                    : "Cancelar venta"
                                }
                                style={{
                                  padding: "6px 12px",
                                  fontSize: "0.8rem",
                                  fontWeight: 600,
                                  borderRadius: "6px",
                                  border: "1px solid #fca5a5",
                                  backgroundColor: isCancelled ? "#f3f4f6" : "#fef2f2",
                                  color: isCancelled ? "#9ca3af" : "#b91c1c",
                                  cursor:
                                    isCancelled || isLoadingThis
                                      ? "not-allowed"
                                      : "pointer",
                                }}
                              >
                                🚫 Cancelar
                              </button>
                              <button
                                onClick={() => openSaleAction(sale.id, "return")}
                                disabled={isCancelled || isLoadingThis}
                                title={
                                  isCancelled
                                    ? "No se puede devolver una venta cancelada"
                                    : "Devolver productos"
                                }
                                style={{
                                  padding: "6px 12px",
                                  fontSize: "0.8rem",
                                  fontWeight: 600,
                                  borderRadius: "6px",
                                  border: "1px solid #93c5fd",
                                  backgroundColor: isCancelled ? "#f3f4f6" : "#eff6ff",
                                  color: isCancelled ? "#9ca3af" : "#1d4ed8",
                                  cursor:
                                    isCancelled || isLoadingThis
                                      ? "not-allowed"
                                      : "pointer",
                                }}
                              >
                                ↩️ Devolver
                              </button>
                              <button
                                onClick={() => showReversals(sale.id, sale.folio)}
                                disabled={isLoadingThis}
                                title="Ver reversiones asociadas"
                                style={{
                                  padding: "6px 12px",
                                  fontSize: "0.8rem",
                                  fontWeight: 600,
                                  borderRadius: "6px",
                                  border: "1px solid #d1d5db",
                                  backgroundColor: "white",
                                  color: "#374151",
                                  cursor: isLoadingThis ? "not-allowed" : "pointer",
                                }}
                              >
                                🔎 Ver reversiones
                              </button>
                              {/* Corregir pago: solo turno abierto, venta no cancelada
                                  y método simple (no mixto). */}
                              {selectedShift?.status === "OPEN" &&
                                !isCancelled &&
                                !(sale.paymentMethod || "")
                                  .toLowerCase()
                                  .includes("mixto") && (
                                  <button
                                    onClick={() => correctPayment(sale.id, sale.folio)}
                                    disabled={isLoadingThis}
                                    title="Corregir método de pago"
                                    style={{
                                      padding: "6px 12px",
                                      fontSize: "0.8rem",
                                      fontWeight: 600,
                                      borderRadius: "6px",
                                      border: "1px solid #fcd34d",
                                      backgroundColor: "#fffbeb",
                                      color: "#b45309",
                                      cursor: isLoadingThis
                                        ? "not-allowed"
                                        : "pointer",
                                    }}
                                  >
                                    ✏️ Corregir pago
                                  </button>
                                )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de cancelación de venta (Req 1.x) */}
      {activeModal === "cancel" && actionSale && (
        <CancelSaleModal
          sale={actionSale}
          onClose={closeSaleAction}
          onSuccess={handleCancelSuccess}
          createdBy={selectedShift?.cashierName ?? actionSale.createdBy}
        />
      )}

      {/* Modal de devolución parcial (Req 2.x) */}
      {activeModal === "return" && actionSale && (
        <ReturnSaleModal
          sale={actionSale}
          onClose={closeSaleAction}
          onSuccess={handleReturnSuccess}
          cashRegister={selectedShift?.cashRegister ?? actionSale.cashRegister}
          createdBy={selectedShift?.cashierName ?? actionSale.createdBy}
        />
      )}

      {/* Comprobante de cancelación / devolución, imprimible (Req 10) */}
      {reversalReceipt && (
        <div className="modal-overlay">
          <div
            className="modal-container"
            style={{
              maxWidth: "420px",
              width: "95%",
              maxHeight: "95vh",
              overflowY: "auto",
              padding: "16px",
            }}
          >
            <div id="reversal-receipt-print">
              <CancellationReturnReceipt receipt={reversalReceipt} />
            </div>
            <div
              className="payment-modal-actions no-print"
              style={{ marginTop: "16px" }}
            >
              <button
                className="cancel-btn-payment"
                onClick={() => setReversalReceipt(null)}
                style={{ fontSize: "0.9rem", padding: "10px 20px" }}
              >
                Cerrar
              </button>
              <button
                className="confirm-btn"
                onClick={() => window.print()}
                style={{ fontSize: "0.9rem", padding: "10px 20px" }}
              >
                🖨 Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

