import React from "react";
import { IoClose } from "react-icons/io5";
import type { ClientContainerDeposit } from "../api/clientContainerDeposits";
import "../styles/components/recoverContainerDetail.css";

interface RecoverContainerDetailModalProps {
  isOpen: boolean;
  deposit: ClientContainerDeposit | null;
  onClose: () => void;
}

const mxn = (n: number) =>
  (n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const dateTime = (v?: string | Date | null) => {
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

const RecoverContainerDetailModal: React.FC<RecoverContainerDetailModalProps> = ({
  isOpen,
  deposit,
  onClose,
}) => {
  if (!isOpen || !deposit) return null;

  const returned = deposit.status === "RETURNED";

  return (
    <div
      className="rcd-overlay"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      role="presentation"
    >
      <div
        className="rcd-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rcd-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rcd-header">
          <h2 id="rcd-title" className="rcd-title">
            🍺 Detalle del envase · #{deposit.id}
          </h2>
          <button className="rcd-close" onClick={onClose} aria-label="Cerrar">
            <IoClose size={22} />
          </button>
        </div>

        <div className="rcd-body">
          {/* Estado + resumen */}
          <div className="rcd-summary">
            <div className="rcd-summary-main">
              <span className="rcd-container-name">{deposit.containerName}</span>
              <span className="rcd-container-sub">
                {deposit.quantity} {deposit.quantity === 1 ? "envase" : "envases"} ·{" "}
                {mxn(deposit.unitPrice)} c/u
              </span>
            </div>
            <div className="rcd-summary-right">
              <span className="rcd-amount">{mxn(deposit.importAmount)}</span>
              <span className={`rcd-status ${returned ? "rcd-status--ok" : "rcd-status--pending"}`}>
                {returned ? "✅ Devuelto" : "⏳ Por recuperar"}
              </span>
            </div>
          </div>

          {/* Datos generales */}
          <div className="rcd-section-title">Datos generales</div>
          <div className="rcd-grid">
            <div className="rcd-field">
              <span className="rcd-label">Cliente</span>
              <span className="rcd-value">{deposit.client?.name || "Cliente General"}</span>
            </div>
            <div className="rcd-field">
              <span className="rcd-label">Folio venta</span>
              <span className="rcd-value">{deposit.saleId ? `#${deposit.saleId}` : "—"}</span>
            </div>
            <div className="rcd-field">
              <span className="rcd-label">Turno</span>
              <span className="rcd-value">{deposit.shiftId ? `#${deposit.shiftId}` : "—"}</span>
            </div>
          </div>

          {/* Línea de tiempo del seguimiento */}
          <div className="rcd-section-title">Seguimiento</div>
          <ul className="rcd-timeline">
            {/* Entrega del envase (entrada) */}
            <li className="rcd-tl-item rcd-tl-item--in">
              <span className="rcd-tl-dot" />
              <div className="rcd-tl-content">
                <div className="rcd-tl-head">
                  <span className="rcd-tl-title">📥 Se dío envase al cliente</span>
                  <span className="rcd-tl-date">{dateTime(deposit.createdAt)}</span>
                </div>
                <div className="rcd-tl-meta">
                  <span>Cajero: <strong>{deposit.createdBy || "—"}</strong></span>
                  <span>
                    Mov. entrada:{" "}
                    <strong>{deposit.cashMovementId ? `#${deposit.cashMovementId}` : "—"}</strong>
                  </span>
                  <span>Importe cobrado: <strong>{mxn(deposit.importAmount)}</strong></span>
                </div>
              </div>
            </li>

            {/* Regreso del importe (salida) */}
            {returned ? (
              <li className="rcd-tl-item rcd-tl-item--out">
                <span className="rcd-tl-dot" />
                <div className="rcd-tl-content">
                  <div className="rcd-tl-head">
                    <span className="rcd-tl-title">📤 Se regresó el importe</span>
                    <span className="rcd-tl-date">{dateTime(deposit.returnedAt)}</span>
                  </div>
                  <div className="rcd-tl-meta">
                    <span>Cajero: <strong>{deposit.returnedBy || "—"}</strong></span>
                    <span>
                      Mov. salida:{" "}
                      <strong>
                        {deposit.returnCashMovementId ? `#${deposit.returnCashMovementId}` : "—"}
                      </strong>
                    </span>
                    <span>Importe regresado: <strong>{mxn(deposit.importAmount)}</strong></span>
                  </div>
                </div>
              </li>
            ) : (
              <li className="rcd-tl-item rcd-tl-item--waiting">
                <span className="rcd-tl-dot" />
                <div className="rcd-tl-content">
                  <div className="rcd-tl-head">
                    <span className="rcd-tl-title">⏳ Pendiente de regresar</span>
                  </div>
                  <div className="rcd-tl-meta">
                    <span>El importe aún no se ha regresado al cliente.</span>
                  </div>
                </div>
              </li>
            )}
          </ul>

          {deposit.notes && (
            <>
              <div className="rcd-section-title">Notas</div>
              <p className="rcd-notes">{deposit.notes}</p>
            </>
          )}
        </div>

        <div className="rcd-footer">
          <button type="button" className="rcd-btn-close" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecoverContainerDetailModal;
