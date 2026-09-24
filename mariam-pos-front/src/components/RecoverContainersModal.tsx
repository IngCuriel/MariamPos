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

  // Regresar el importe de un depósito: valida turno, registra la salida de
  // efectivo en la caja activa y marca el depósito como devuelto.
  const handleReturn = async (deposit: ClientContainerDeposit) => {
    const clientName = deposit.client?.name || "Cliente General";
    const result = await Swal.fire({
      icon: "question",
      title: "💰 Regresar importe de envase",
      html: `
        <div style="text-align:left;margin-top:0.5rem;">
          <p>Cliente: <strong>${clientName}</strong></p>
          <p>Envase: <strong>${deposit.containerName}</strong> (${deposit.quantity})</p>
          <p>Importe a regresar:
            <strong style="color:#059669;font-size:1.2rem;">${mxn(deposit.importAmount)}</strong>
          </p>
          <div style="margin-top:0.75rem;padding:0.6rem;background:#f0fdf4;border-radius:6px;font-size:0.85rem;color:#065f46;">
            Se registrará una salida de efectivo en el turno activo.
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "✅ Confirmar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#059669",
      cancelButtonColor: "#6b7280",
    });

    if (!result.isConfirmed) return;

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
      await createCashMovement(movement);

      // Marcar el depósito como devuelto (todo), registrando el cajero que regresa.
      await returnClientContainerDeposit(
        deposit.id,
        undefined,
        selectedCashier?.name || undefined
      );

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
            <div className="rec-table-wrap">
              <table className="rec-table">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Fecha</th>
                    <th>Turno</th>
                    <th>Cliente</th>
                    <th>Envase</th>
                    <th className="rec-th-right">Cant.</th>
                    <th className="rec-th-right">Importe</th>
                    <th>Dio envase</th>
                    <th>Regresó Importe</th>
                    <th className="rec-th-center">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((d) => (
                    <tr key={d.id}>
                      <td className="rec-td-folio">#{d.id}</td>
                      <td>{dateTime(d.createdAt)}</td>
                      <td className="rec-td-muted">
                        {d.shiftId ? `#${d.shiftId}` : "—"}
                      </td>
                      <td className="rec-td-client">
                        {d.client?.name || "Cliente General"}
                      </td>
                      <td>{d.containerName}</td>
                      <td className="rec-th-right">{d.quantity}</td>
                      <td className="rec-th-right rec-due">{mxn(d.importAmount)}</td>
                      <td className="rec-td-muted">{d.createdBy || "—"}</td>
                      <td className="rec-td-muted">{d.returnedBy || "—"}</td>
                      <td className="rec-td-action">
                        {d.status === "PENDING" ? (
                          <button
                            type="button"
                            className="rec-return-btn"
                            disabled={returningId === d.id}
                            onClick={() => handleReturn(d)}
                          >
                            {returningId === d.id ? "⏳..." : "💰 Regresar"}
                          </button>
                        ) : (
                          <span className="rec-returned-tag">✅ Devuelto</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} className="rec-th-right">
                      Totales
                    </td>
                    <td className="rec-th-right">{totalContainers}</td>
                    <td className="rec-th-right rec-due">{mxn(totalAmount)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <div className="rec-footer">
          <button type="button" className="rec-btn-close" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecoverContainersModal;
