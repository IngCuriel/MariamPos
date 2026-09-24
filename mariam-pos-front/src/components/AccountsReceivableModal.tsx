import React, { useState, useCallback, useEffect } from "react";
import { IoClose } from "react-icons/io5";
import Swal from "sweetalert2";
import {
  getCreditsByDateRangePaginated,
  getCreditPaymentsByDateRangePaginated,
} from "../api/credits";
import { getActiveShift } from "../api/cashRegister";
import type { ClientCredit, CreditPayment, Client } from "../types/index";
import ClientSelectionModal from "../pages/sales/ClientSelectionModal";
import CreditPaymentModal from "../pages/client/CreditPaymentModal";
import CreditPaymentsHistoryModal from "./CreditPaymentsHistoryModal";
import "../styles/components/accountsReceivableModal.css";

interface AccountsReceivableModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PAGE_SIZE = 7;

const mxn = (n: number) =>
  (n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const dateTime = (v?: string | Date) => {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

// Fecha local (YYYY-MM-DD) para los inputs date.
const toInputDate = (d: Date) => {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
};

const statusLabel = (status: string) => {
  switch (status) {
    case "PAID":
      return "Pagado";
    case "PARTIALLY_PAID":
      return "Parcial";
    case "PENDING":
      return "Pendiente";
    default:
      return status;
  }
};

type Tab = "credits" | "payments";
type StatusFilter = "ALL" | "PENDING" | "PARTIALLY_PAID" | "PAID";

const AccountsReceivableModal: React.FC<AccountsReceivableModalProps> = ({
  isOpen,
  onClose,
}) => {
  const today = toInputDate(new Date());
  const weekAgo = toInputDate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));

  const [tab, setTab] = useState<Tab>("credits");

  // --- Pestaña Créditos ---
  const [cStart, setCStart] = useState<string>(weekAgo);
  const [cEnd, setCEnd] = useState<string>(today);
  const [cPage, setCPage] = useState(1);
  const [cStatus, setCStatus] = useState<StatusFilter>("ALL");
  const [cClientId, setCClientId] = useState<string>("");
  const [cClientName, setCClientName] = useState<string>("");
  const [showClientPicker, setShowClientPicker] = useState(false);
  // Acciones por fila: abonar / ver historial de abonos de un crédito.
  const [payCredit, setPayCredit] = useState<ClientCredit | null>(null);
  const [historyCredit, setHistoryCredit] = useState<ClientCredit | null>(null);
  const [credits, setCredits] = useState<ClientCredit[]>([]);
  const [cTotal, setCTotal] = useState(0);
  const [cPendingCount, setCPendingCount] = useState(0);
  const [cLoading, setCLoading] = useState(false);
  const [cError, setCError] = useState<string | null>(null);

  // --- Pestaña Abonos ---
  const [pStart, setPStart] = useState<string>(weekAgo);
  const [pEnd, setPEnd] = useState<string>(today);
  const [pPage, setPPage] = useState(1);
  const [payments, setPayments] = useState<CreditPayment[]>([]);
  const [pTotal, setPTotal] = useState(0);
  const [pLoading, setPLoading] = useState(false);
  const [pError, setPError] = useState<string | null>(null);

  const loadCredits = useCallback(
    async (page: number, override?: { status?: StatusFilter; clientId?: string }) => {
      setCLoading(true);
      setCError(null);
      try {
        const effStatus = override?.status ?? cStatus;
        const effClientId =
          override?.clientId !== undefined ? override.clientId : cClientId;
        const res = await getCreditsByDateRangePaginated(
          cStart,
          cEnd,
          page,
          PAGE_SIZE,
          { status: effStatus, clientId: effClientId || undefined }
        );
        setCredits(res.data);
        setCTotal(res.total);
        setCPendingCount(res.pendingCount ?? 0);
        setCPage(res.page);
      } catch (e) {
        console.error("Error al cargar créditos:", e);
        setCError("No se pudieron cargar los créditos.");
        setCredits([]);
        setCTotal(0);
        setCPendingCount(0);
      } finally {
        setCLoading(false);
      }
    },
    [cStart, cEnd, cStatus, cClientId]
  );

  const loadPayments = useCallback(
    async (page: number) => {
      setPLoading(true);
      setPError(null);
      try {
        const res = await getCreditPaymentsByDateRangePaginated(
          pStart,
          pEnd,
          page,
          PAGE_SIZE
        );
        setPayments(res.data);
        setPTotal(res.total);
        setPPage(res.page);
      } catch (e) {
        console.error("Error al cargar abonos:", e);
        setPError("No se pudieron cargar los abonos.");
        setPayments([]);
        setPTotal(0);
      } finally {
        setPLoading(false);
      }
    },
    [pStart, pEnd]
  );

  // Abrir el modal de abono solo si hay un turno de caja abierto.
  const handleAbonar = useCallback(async (credit: ClientCredit) => {
    const branch = localStorage.getItem("sucursal") || "Sucursal Principal";
    const cashRegister = localStorage.getItem("caja") || "Caja 1";
    try {
      const shift = await getActiveShift(branch, cashRegister);
      if (!shift) {
        Swal.fire({
          icon: "warning",
          title: "Turno no activo",
          text: "Debe abrir un turno de caja antes de registrar un abono.",
          confirmButtonText: "Entendido",
          confirmButtonColor: "#f59e0b",
        });
        return;
      }
      setPayCredit(credit);
    } catch (e) {
      console.error("Error al verificar turno activo:", e);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo verificar el turno de caja. Intente de nuevo.",
        confirmButtonText: "Entendido",
      });
    }
  }, []);

  // Cargar la pestaña activa al abrir o cambiar de pestaña.
  useEffect(() => {
    if (!isOpen) return;
    if (tab === "credits") loadCredits(1);
    else loadPayments(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, tab]);

  if (!isOpen) return null;

  const cTotalPages = Math.max(1, Math.ceil(cTotal / PAGE_SIZE));
  const pTotalPages = Math.max(1, Math.ceil(pTotal / PAGE_SIZE));

  return (
    <>
    <div className="arc-overlay" onClick={onClose} role="presentation">
      <div
        className="arc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="arc-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="arc-header">
          <h2 id="arc-title" className="arc-title">
            💳 Créditos por Cobrar
          </h2>
          <button className="arc-close" onClick={onClose} aria-label="Cerrar">
            <IoClose size={24} />
          </button>
        </div>

        {/* Pestañas */}
        <div className="arc-tabs">
          <button
            type="button"
            className={`arc-tab ${tab === "credits" ? "arc-tab--active" : ""}`}
            onClick={() => setTab("credits")}
          >
            Créditos
            {cPendingCount > 0 && (
              <span
                className="arc-tab-count arc-tab-count--due"
                title="Créditos por cobrar (pendientes + parciales)"
              >
                {cPendingCount}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`arc-tab ${tab === "payments" ? "arc-tab--active" : ""}`}
            onClick={() => setTab("payments")}
          >
            Abonos
          </button>
        </div>

        <div className="arc-body">
          {tab === "credits" ? (
            <>
              {/* Filtros créditos */}
              <div className="arc-filters">
                <div className="arc-field">
                  <label htmlFor="c-start">Desde</label>
                  <input
                    id="c-start"
                    type="date"
                    value={cStart}
                    max={cEnd}
                    onChange={(e) => setCStart(e.target.value)}
                  />
                </div>
                <div className="arc-field">
                  <label htmlFor="c-end">Hasta</label>
                  <input
                    id="c-end"
                    type="date"
                    value={cEnd}
                    min={cStart}
                    onChange={(e) => setCEnd(e.target.value)}
                  />
                </div>
                <div className="arc-field">
                  <label htmlFor="c-status">Estado</label>
                  <select
                    id="c-status"
                    value={cStatus}
                    onChange={(e) => setCStatus(e.target.value as StatusFilter)}
                  >
                    <option value="ALL">Todos</option>
                    <option value="PENDING">Pendientes</option>
                    <option value="PARTIALLY_PAID">Parciales</option>
                    <option value="PAID">Pagados</option>
                  </select>
                </div>
                <div className="arc-field arc-field--client">
                  <label>Cliente</label>
                  <div className="arc-client-picker">
                    <button
                      type="button"
                      className="arc-client-btn"
                      onClick={() => setShowClientPicker(true)}
                      title="Seleccionar cliente"
                    >
                      👤 {cClientName || "Todos los clientes"}
                    </button>
                    {cClientId && (
                      <button
                        type="button"
                        className="arc-client-clear"
                        onClick={() => {
                          setCClientId("");
                          setCClientName("");
                          loadCredits(1, { clientId: "" });
                        }}
                        title="Quitar filtro de cliente"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="arc-search"
                  onClick={() => loadCredits(1)}
                  disabled={cLoading}
                >
                  {cLoading ? "Buscando..." : "🔍 Buscar"}
                </button>
              </div>

              {/* Tabla créditos */}
              {cError ? (
                <div className="arc-empty arc-error">{cError}</div>
              ) : cLoading ? (
                <div className="arc-empty">Cargando créditos...</div>
              ) : credits.length === 0 ? (
                <div className="arc-empty">
                  No hay créditos en el rango seleccionado.
                </div>
              ) : (
                <div className="arc-table-wrap">
                  <table className="arc-table">
                    <thead>
                      <tr>
                        <th>Folio</th>
                        <th>Venta</th>
                        <th>Turno</th>
                        <th>Fecha</th>
                        <th>Cliente</th>
                        <th>Cajero</th>
                        <th className="arc-th-right">Total</th>
                        <th className="arc-th-right">Pagado</th>
                        <th className="arc-th-right">Pendiente</th>
                        <th>Estado</th>
                        <th className="arc-th-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {credits.map((c) => (
                        <tr key={c.id}>
                          <td className="arc-td-folio">#{c.id}</td>
                          <td className="arc-td-muted">
                            {c.sale?.folio ? `#${c.sale.folio}` : `#${c.saleId}`}
                          </td>
                          <td className="arc-td-muted">
                            {c.sale?.shiftId ? `#${c.sale.shiftId}` : "—"}
                          </td>
                          <td>{dateTime(c.createdAt)}</td>
                          <td className="arc-td-client">
                            {c.client?.name || "Cliente General"}
                          </td>
                          <td className="arc-td-muted">{c.createdBy || "—"}</td>
                          <td className="arc-th-right">{mxn(c.originalAmount)}</td>
                          <td className="arc-th-right arc-paid">
                            {mxn(c.paidAmount)}
                          </td>
                          <td className="arc-th-right arc-due">
                            {mxn(c.remainingAmount)}
                          </td>
                          <td>
                            <span className={`arc-badge arc-badge--${c.status}`}>
                              {statusLabel(c.status)}
                            </span>
                          </td>
                          <td>
                            <div className="arc-actions">
                              {(c.status === "PENDING" ||
                                c.status === "PARTIALLY_PAID") && (
                                <button
                                  type="button"
                                  className="arc-action arc-action--pay"
                                  title="Registrar abono"
                                  onClick={() => handleAbonar(c)}
                                >
                                  💵 Abonar
                                </button>
                              )}
                              <button
                                type="button"
                                className="arc-action arc-action--history"
                                title="Ver historial de abonos"
                                onClick={() => setHistoryCredit(c)}
                              >
                                🧾 Historial
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Paginación créditos */}
              {!cLoading && !cError && cTotal > 0 && (
                <div className="arc-pagination">
                  <button
                    type="button"
                    className="arc-page-btn"
                    disabled={cPage <= 1}
                    onClick={() => loadCredits(cPage - 1)}
                  >
                    ‹ Anterior
                  </button>
                  <span className="arc-page-info">
                    Página {cPage} de {cTotalPages}
                  </span>
                  <button
                    type="button"
                    className="arc-page-btn"
                    disabled={cPage >= cTotalPages}
                    onClick={() => loadCredits(cPage + 1)}
                  >
                    Siguiente ›
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Filtros abonos */}
              <div className="arc-filters">
                <div className="arc-field">
                  <label htmlFor="p-start">Desde</label>
                  <input
                    id="p-start"
                    type="date"
                    value={pStart}
                    max={pEnd}
                    onChange={(e) => setPStart(e.target.value)}
                  />
                </div>
                <div className="arc-field">
                  <label htmlFor="p-end">Hasta</label>
                  <input
                    id="p-end"
                    type="date"
                    value={pEnd}
                    min={pStart}
                    onChange={(e) => setPEnd(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="arc-search"
                  onClick={() => loadPayments(1)}
                  disabled={pLoading}
                >
                  {pLoading ? "Buscando..." : "🔍 Buscar"}
                </button>
              </div>

              {/* Tabla abonos */}
              {pError ? (
                <div className="arc-empty arc-error">{pError}</div>
              ) : pLoading ? (
                <div className="arc-empty">Cargando abonos...</div>
              ) : payments.length === 0 ? (
                <div className="arc-empty">
                  No hay abonos en el rango seleccionado.
                </div>
              ) : (
                <div className="arc-table-wrap">
                  <table className="arc-table">
                    <thead>
                      <tr>
                        <th>Folio</th>
                        <th>Crédito</th>
                        <th>Venta</th>
                        <th>Turno</th>
                        <th>Fecha</th>
                        <th>Cliente</th>
                        <th>Cajero</th>
                        <th>Método</th>
                        <th className="arc-th-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td className="arc-td-folio">#{p.id}</td>
                          <td className="arc-td-muted">
                            #{p.creditId}
                          </td>
                          <td className="arc-td-muted">
                            {p.credit?.sale?.folio
                              ? `#${p.credit.sale.folio}`
                              : p.credit?.saleId
                              ? `#${p.credit.saleId}`
                              : "—"}
                          </td>
                          <td className="arc-td-muted">
                            {p.shiftId ? `#${p.shiftId}` : "—"}
                          </td>
                          <td>{dateTime(p.createdAt)}</td>
                          <td className="arc-td-client">
                            {p.credit?.client?.name || "Cliente General"}
                          </td>
                          <td className="arc-td-muted">{p.createdBy || "—"}</td>
                          <td className="arc-td-muted">
                            {p.paymentMethod || "Efectivo"}
                          </td>
                          <td className="arc-th-right arc-paid">
                            {mxn(p.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Paginación abonos */}
              {!pLoading && !pError && pTotal > 0 && (
                <div className="arc-pagination">
                  <button
                    type="button"
                    className="arc-page-btn"
                    disabled={pPage <= 1}
                    onClick={() => loadPayments(pPage - 1)}
                  >
                    ‹ Anterior
                  </button>
                  <span className="arc-page-info">
                    Página {pPage} de {pTotalPages}
                  </span>
                  <button
                    type="button"
                    className="arc-page-btn"
                    disabled={pPage >= pTotalPages}
                    onClick={() => loadPayments(pPage + 1)}
                  >
                    Siguiente ›
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="arc-footer">
          <button type="button" className="arc-btn-close" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>

    {/* Selector de cliente (reutiliza el de Venta). Se renderiza FUERA del
        overlay de créditos para que su click no burbujee al onClose del padre.
        El wrapper eleva su z-index por encima del overlay de créditos (1300). */}
    <div className="arc-client-portal">
      <ClientSelectionModal
        isOpen={showClientPicker}
        currentClient={cClientName}
        onClose={() => setShowClientPicker(false)}
        onSelect={(clientName: string, client?: Client) => {
          const id = client?.id || "";
          setCClientName(clientName);
          setCClientId(id);
          setShowClientPicker(false);
          // Recargar de inmediato con el cliente elegido (sin esperar a Buscar).
          loadCredits(1, { clientId: id });
        }}
      />
    </div>

    {/* Registrar abono al crédito de la fila. Al éxito, recarga la lista.
        Wrapper eleva el z-index del overlay por encima del de créditos (1300). */}
    {payCredit && (
      <div className="arc-client-portal">
        <CreditPaymentModal
          isOpen={!!payCredit}
          credit={payCredit}
          onClose={() => setPayCredit(null)}
          onPaymentSuccess={() => {
            setPayCredit(null);
            loadCredits(cPage);
          }}
        />
      </div>
    )}

    {/* Historial de abonos del crédito de la fila. */}
    <CreditPaymentsHistoryModal
      isOpen={!!historyCredit}
      credit={historyCredit}
      onClose={() => setHistoryCredit(null)}
    />
    </>
  );
};

export default AccountsReceivableModal;
