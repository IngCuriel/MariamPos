import React, { useState, useCallback, useEffect } from "react";
import { IoClose } from "react-icons/io5";
import Swal from "sweetalert2";
import {
  getContainerDepositsFiltered,
  returnClientContainerDeposit,
} from "../api/clientContainerDeposits";
import type { ClientContainerDeposit } from "../api/clientContainerDeposits";
import { getActiveShift, createCashMovement } from "../api/cashRegister";
import type { CreateCashMovementInput } from "../types";
import { useCashier } from "../contexts/CashierContext";
import RecoverContainerDetailModal from "./RecoverContainerDetailModal";
import ReturnContainerConfirmModal from "./ReturnContainerConfirmModal";
import "../styles/components/recoverContainersModal.css";

interface RecoverContainersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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

const toInputDate = (d: Date) => {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
};

const RecoverContainersModal: React.FC<RecoverContainersModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { selectedCashier } = useCashier();
  const today = toInputDate(new Date());
  const monthAgo = toInputDate(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));

  const [startDate, setStartDate] = useState(monthAgo);
  const [endDate, setEndDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "RETURNED" | "ALL">("PENDING");
  const [deposits, setDeposits] = useState<ClientContainerDeposit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returningId, setReturningId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [detailDeposit, setDetailDeposit] = useState<ClientContainerDeposit | null>(null);
  // Depósito cuyo regreso se está confirmando en el modal pro.
  const [confirmDeposit, setConfirmDeposit] = useState<ClientContainerDeposit | null>(null);
  const PAGE_SIZE = 10;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getContainerDepositsFiltered(
        startDate,
        endDate,
        statusFilter === "ALL" ? undefined : statusFilter
      );
      setDeposits(data);
      setPage(1); // reiniciar a la primera página con cada búsqueda
    } catch (e) {
      console.error("Error al cargar envases:", e);
      setError("No se pudieron cargar los envases. Intente de nuevo.");
      setDeposits([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, statusFilter]);

  useEffect(() => {
    if (isOpen) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Ejecuta el regreso del importe: valida turno, registra la salida de
  // efectivo en la caja activa y marca el depósito como devuelto.
  const executeReturn = async (deposit: ClientContainerDeposit) => {
    const clientName = deposit.client?.name || "Cliente General";
    setReturningId(deposit.id);
    try {
      const branch = localStorage.getItem("sucursal") || "Sucursal Principal";
      const cashRegister = localStorage.getItem("caja") || "Caja 1";

      const activeShift = await getActiveShift(branch, cashRegister);
      if (!activeShift) {
        Swal.fire({
          icon: "warning",
          title: "Turno no activo",
          text: "Debe abrir un turno de caja antes de regresar el importe.",
          confirmButtonText: "Entendido",
          confirmButtonColor: "#f59e0b",
        });
        return;
      }

      // Salida de efectivo por el importe del envase.
      const movement: CreateCashMovementInput = {
        shiftId: activeShift.id,
        type: "SALIDA",
        amount: deposit.importAmount,
        reason: `Regreso importe de envase - ${clientName}`,
        notes: `${deposit.containerName} (${deposit.quantity}) - ${mxn(deposit.importAmount)}`,
      };
      const createdMovement = await createCashMovement(movement);

      // Marcar el depósito como devuelto (todo), registrando el cajero que
      // regresa y el id del movimiento de SALIDA para trazabilidad.
      await returnClientContainerDeposit(
        deposit.id,
        undefined,
        selectedCashier?.name || undefined,
        createdMovement?.id
      );

      setConfirmDeposit(null);
      Swal.fire({
        icon: "success",
        title: "✅ Importe regresado",
        text: `Se registró la salida de efectivo por ${mxn(deposit.importAmount)}.`,
        timer: 2200,
        showConfirmButton: false,
      });

      await load();
    } catch (e: any) {
      console.error("Error al regresar importe:", e);
      Swal.fire({
        icon: "error",
        title: "Error",
        text:
          e?.response?.data?.error ||
          e?.message ||
          "No se pudo regresar el importe.",
        confirmButtonText: "Entendido",
      });
    } finally {
      setReturningId(null);
    }
  };

  if (!isOpen) return null;

  const sorted = deposits
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalContainers = sorted.reduce((s, d) => s + (d.quantity || 0), 0);
  const totalAmount = sorted.reduce((s, d) => s + (d.importAmount || 0), 0);

  // Paginación en cliente (la API devuelve la lista completa).
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageRows = sorted.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <div className="rec-overlay" onClick={onClose} role="presentation">
      <div
        className="rec-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rec-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rec-header">
          <h2 id="rec-title" className="rec-title">
            🍺 Recuperar Envases
          </h2>
          <button className="rec-close" onClick={onClose} aria-label="Cerrar">
            <IoClose size={24} />
          </button>
        </div>

        <div className="rec-body">
          {/* Filtros */}
          <div className="rec-filters">
            <div className="rec-field">
              <label htmlFor="rec-start">Desde</label>
              <input
                id="rec-start"
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="rec-field">
              <label htmlFor="rec-end">Hasta</label>
              <input
                id="rec-end"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="rec-field">
              <label htmlFor="rec-status">Estado</label>
              <select
                id="rec-status"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "PENDING" | "RETURNED" | "ALL")
                }
              >
                <option value="PENDING">Por recuperar</option>
                <option value="RETURNED">Devueltos</option>
                <option value="ALL">Todos</option>
              </select>
            </div>
            <button
              type="button"
              className="rec-search"
              onClick={load}
              disabled={loading}
            >
              {loading ? "Buscando..." : "🔍 Buscar"}
            </button>
          </div>

          {/* Totales */}
          <div className="rec-totals">
            <div className="rec-total">
              <span className="rec-total-label">Registros</span>
              <span className="rec-total-value">{sorted.length}</span>
            </div>
            <div className="rec-total">
              <span className="rec-total-label">Envases</span>
              <span className="rec-total-value">{totalContainers}</span>
            </div>
            <div className="rec-total">
              <span className="rec-total-label">Importe por recuperar</span>
              <span className="rec-total-value rec-due">{mxn(totalAmount)}</span>
            </div>
          </div>

          {/* Tabla */}
          {error ? (
            <div className="rec-empty rec-error">{error}</div>
          ) : loading ? (
            <div className="rec-empty">Cargando envases...</div>
          ) : sorted.length === 0 ? (
            <div className="rec-empty">
              No hay envases por recuperar en el rango seleccionado.
            </div>
          ) : (
            <>
            <div className="rec-table-wrap">
              <table className="rec-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Venta</th>
                    <th>Envase</th>
                    <th className="rec-th-right">Cant.</th>
                    <th className="rec-th-right">Importe</th>
                    <th>Dio envase</th>
                    <th className="rec-th-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((d) => (
                    <tr key={d.id}>
                      <td>{dateTime(d.createdAt)}</td>
                      <td className="rec-td-client">
                        {d.client?.name || "Cliente General"}
                      </td>
                      <td className="rec-td-muted">
                        {d.saleId ? `#${d.saleId}` : "—"}
                      </td>
                      <td>{d.containerName}</td>
                      <td className="rec-th-right">{d.quantity}</td>
                      <td className="rec-th-right rec-due">{mxn(d.importAmount)}</td>
                      <td className="rec-td-muted" title={d.createdBy || ""}>
                        {d.createdBy
                          ? d.createdBy.length > 10
                            ? `${d.createdBy.slice(0, 10)}…`
                            : d.createdBy
                          : "—"}
                      </td>
                      <td className="rec-td-action">
                        <div className="rec-row-actions">
                          <button
                            type="button"
                            className="rec-detail-btn"
                            onClick={() => setDetailDeposit(d)}
                          >
                            👁️ Detalle
                          </button>
                          {d.status === "PENDING" ? (
                            <button
                              type="button"
                              className="rec-return-btn"
                              disabled={returningId === d.id}
                              onClick={() => setConfirmDeposit(d)}
                            >
                              {returningId === d.id ? "⏳..." : "💰 Regresar"}
                            </button>
                          ) : (
                            <span className="rec-returned-tag">✅ Devuelto</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="rec-th-right">
                      Totales
                    </td>
                    <td className="rec-th-right">{totalContainers}</td>
                    <td className="rec-th-right rec-due">{mxn(totalAmount)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Paginación en cliente */}
            {totalPages > 1 && (
              <div className="rec-pagination">
                <button
                  type="button"
                  className="rec-page-btn"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ‹ Anterior
                </button>
                <span className="rec-page-info">
                  Página {safePage} de {totalPages} · {sorted.length} registro(s)
                </span>
                <button
                  type="button"
                  className="rec-page-btn"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Siguiente ›
                </button>
              </div>
            )}
            </>
          )}
        </div>

        <div className="rec-footer">
          <button type="button" className="rec-btn-close" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>

      {/* Modal de detalle/seguimiento del envase */}
      <RecoverContainerDetailModal
        isOpen={detailDeposit !== null}
        deposit={detailDeposit}
        onClose={() => setDetailDeposit(null)}
      />

      {/* Confirmación pro de regreso de importe (con desglose del cliente) */}
      <ReturnContainerConfirmModal
        isOpen={confirmDeposit !== null}
        deposit={confirmDeposit}
        otherPending={
          confirmDeposit
            ? deposits.filter(
                (d) =>
                  d.status === "PENDING" &&
                  d.clientId === confirmDeposit.clientId &&
                  d.id !== confirmDeposit.id
              )
            : []
        }
        loading={returningId !== null}
        onConfirm={() => confirmDeposit && executeReturn(confirmDeposit)}
        onClose={() => setConfirmDeposit(null)}
      />
    </div>
  );
};

export default RecoverContainersModal;
