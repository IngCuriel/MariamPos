import React from "react";
import { IoClose } from "react-icons/io5";
import type { ClientContainerDeposit } from "../api/clientContainerDeposits";
import "../styles/components/returnContainerConfirm.css";

interface ReturnContainerConfirmModalProps {
  isOpen: boolean;
  /** Depósito (tipo de envase) que se va a regresar. */
  deposit: ClientContainerDeposit | null;
  /** Otros depósitos PENDIENTES del mismo cliente (contexto informativo). */
  otherPending: ClientContainerDeposit[];
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const mxn = (n: number) =>
  (n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const ReturnContainerConfirmModal: React.FC<ReturnContainerConfirmModalProps> = ({
  isOpen,
  deposit,
  otherPending,
  loading = false,
  onConfirm,
  onClose,
}) => {
  if (!isOpen || !deposit) return null;

  const clientName = deposit.client?.name || "Cliente General";
  const otherTotal = otherPending.reduce((s, d) => s + (d.importAmount || 0), 0);

  return (
    <div
      className="rcc-overlay"
      onClick={(e) => {
        e.stopPropagation();
        if (!loading) onClose();
      }}
      role="presentation"
    >
      <div
        className="rcc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rcc-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rcc-header">
          <h2 id="rcc-title" className="rcc-title">
            💰 Regresar importe de envase
          </h2>
          <button
            className="rcc-close"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={loading}
          >
            <IoClose size={22} />
          </button>
        </div>

        <div className="rcc-body">
          {/* Cliente */}
          <div className="rcc-client">
            <span className="rcc-client-icon">👤</span>
            <div>
              <span className="rcc-client-name">{clientName}</span>
              <span className="rcc-client-sub">Folio de venta: {deposit.saleId ? `#${deposit.saleId}` : "—"}</span>
            </div>
          </div>

          {/* Envase que se va a regresar — destacado */}
          <div className="rcc-section-title">Envase a regresar</div>
          <div className="rcc-return-card">
            <div className="rcc-return-main">
              <span className="rcc-return-name">{deposit.containerName}</span>
              <span className="rcc-return-detail">
                {deposit.quantity} {deposit.quantity === 1 ? "envase" : "envases"} ×{" "}
                {mxn(deposit.unitPrice)}
              </span>
            </div>
            <span className="rcc-return-amount">{mxn(deposit.importAmount)}</span>
          </div>

          {/* Otros envases pendientes del mismo cliente (informativo) */}
          {otherPending.length > 0 && (
            <>
              <div className="rcc-section-title">
                También pendientes de este cliente ({otherPending.length})
              </div>
              <ul className="rcc-other-list">
                {otherPending.map((d) => (
                  <li key={d.id} className="rcc-other-item">
                    <span className="rcc-other-name">{d.containerName}</span>
                    <span className="rcc-other-qty">×{d.quantity}</span>
                    <span className="rcc-other-amount">{mxn(d.importAmount)}</span>
                  </li>
                ))}
              </ul>
              <div className="rcc-other-total">
                <span>Otros pendientes</span>
                <span>{mxn(otherTotal)}</span>
              </div>
              <p className="rcc-hint-note">
                Solo se regresará el envase seleccionado arriba. Los demás siguen pendientes.
              </p>
            </>
          )}

          {/* Aviso de salida de caja */}
          <div className="rcc-cash-note">
            Se registrará una <strong>salida de efectivo</strong> por{" "}
            <strong>{mxn(deposit.importAmount)}</strong> en el turno activo.
          </div>
        </div>

        <div className="rcc-footer">
          <button
            type="button"
            className="rcc-btn rcc-btn--ghost"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rcc-btn rcc-btn--confirm"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Procesando..." : `✅ Regresar ${mxn(deposit.importAmount)}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReturnContainerConfirmModal;
