import React, { useState, useEffect, useCallback } from "react";
import { IoClose } from "react-icons/io5";
import { getCreditById } from "../api/credits";
import type { ClientCredit } from "../types/index";
import "../styles/components/creditPaymentsHistoryModal.css";

interface CreditPaymentsHistoryModalProps {
  isOpen: boolean;
  credit: ClientCredit | null;
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

const statusLabel = (status?: string) => {
  switch (status) {
    case "PAID":
      return "Pagado";
    case "PARTIALLY_PAID":
      return "Parcial";
    case "PENDING":
      return "Pendiente";
    default:
      return status || "—";
  }
};

const CreditPaymentsHistoryModal: React.FC<CreditPaymentsHistoryModalProps> = ({
  isOpen,
  credit,
  onClose,
}) => {
  const [detail, setDetail] = useState<ClientCredit | null>(credit);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async (creditId: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCreditById(creditId);
      setDetail(data);
    } catch (e) {
      console.error("Error al cargar el historial del crédito:", e);
      setError("No se pudo cargar el historial de abonos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && credit) {
      setDetail(credit);
      loadDetail(credit.id);
    }
  }, [isOpen, credit, loadDetail]);

  if (!isOpen || !credit) return null;

  const c = detail ?? credit;
  const payments = (c.payments ?? [])
    .slice()
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  return (
    <div className="cph-overlay" onClick={onClose} role="presentation">
      <div
        className="cph-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cph-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cph-header">
          <div>
            <h2 id="cph-title" className="cph-title">
              🧾 Historial de abonos
            </h2>
            <span className="cph-subtitle">
              Crédito #{c.id}
              {c.sale?.folio ? ` · Venta #${c.sale.folio}` : ""}
              {c.client?.name ? ` · ${c.client.name}` : ""}
            </span>
          </div>
          <button className="cph-close" onClick={onClose} aria-label="Cerrar">
            <IoClose size={24} />
          </button>
        </div>

        <div className="cph-body">
          {/* Resumen del crédito */}
          <div className="cph-summary">
            <div className="cph-sum">
              <span className="cph-sum-label">Total del crédito</span>
              <span className="cph-sum-value">{mxn(c.originalAmount)}</span>
            </div>
            <div className="cph-sum">
              <span className="cph-sum-label">Pagado</span>
              <span className="cph-sum-value cph-paid">{mxn(c.paidAmount)}</span>
            </div>
            <div className="cph-sum">
              <span className="cph-sum-label">Pendiente</span>
              <span className="cph-sum-value cph-due">
                {mxn(c.remainingAmount)}
              </span>
            </div>
            <div className="cph-sum">
              <span className="cph-sum-label">Estado</span>
              <span className={`cph-badge cph-badge--${c.status}`}>
                {statusLabel(c.status)}
              </span>
            </div>
          </div>

          {/* Lista de abonos */}
          {error ? (
            <div className="cph-empty cph-error">{error}</div>
          ) : loading ? (
            <div className="cph-empty">Cargando abonos...</div>
          ) : payments.length === 0 ? (
            <div className="cph-empty">
              Este crédito todavía no tiene abonos registrados.
            </div>
          ) : (
            <div className="cph-table-wrap">
              <table className="cph-table">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Fecha</th>
                    <th>Turno</th>
                    <th>Cajero</th>
                    <th>Método</th>
                    <th className="cph-th-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="cph-td-folio">#{p.id}</td>
                      <td>{dateTime(p.createdAt)}</td>
                      <td className="cph-td-muted">
                        {p.shiftId ? `#${p.shiftId}` : "—"}
                      </td>
                      <td className="cph-td-muted">{p.createdBy || "—"}</td>
                      <td className="cph-td-muted">
                        {p.paymentMethod || "Efectivo"}
                      </td>
                      <td className="cph-th-right cph-td-amount">
                        {mxn(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} className="cph-th-right">
                      Total abonado
                    </td>
                    <td className="cph-th-right cph-td-amount">
                      {mxn(c.paidAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <div className="cph-footer">
          <button type="button" className="cph-btn-close" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreditPaymentsHistoryModal;
