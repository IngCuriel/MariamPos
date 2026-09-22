import React from "react";
import { IoClose, IoPencil, IoReceiptOutline, IoCashOutline, IoReturnUpBackOutline } from "react-icons/io5";
import type { Client } from "../../types/index";
import "../../styles/pages/client/clientActionsModal.css";

interface ClientActionsModalProps {
  isOpen: boolean;
  client: Client | null;
  /** Saldo pendiente de crédito (0 o undefined = sin saldo). */
  pendingAmount?: number;
  /** Envases pendientes: cantidad y monto (0 = sin envases). */
  containersCount?: number;
  containersAmount?: number;
  onClose: () => void;
  onEdit: () => void;
  onViewHistory: () => void;
  onPay: () => void;
  onReturnContainers: () => void;
}

const formatMXN = (value: number) =>
  value.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const ClientActionsModal: React.FC<ClientActionsModalProps> = ({
  isOpen,
  client,
  pendingAmount = 0,
  containersCount = 0,
  containersAmount = 0,
  onClose,
  onEdit,
  onViewHistory,
  onPay,
  onReturnContainers,
}) => {
  if (!isOpen || !client) return null;

  const hasPending = pendingAmount > 0;
  const hasContainers = containersCount > 0;
  const canViewHistory = Boolean(client.allowCredit);

  return (
    <div className="client-actions-overlay" onClick={onClose} role="presentation">
      <div
        className="client-actions-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-actions-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="client-actions-header">
          <div className="client-actions-header-info">
            <h2 id="client-actions-title" className="client-actions-title">
              {client.name}
            </h2>
            {client.alias && <span className="client-actions-alias">📌 {client.alias}</span>}
          </div>
          <button
            type="button"
            className="client-actions-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <IoClose size={24} />
          </button>
        </div>

        {(hasPending || hasContainers) && (
          <div className="client-actions-summary">
            {hasPending && (
              <div className="client-actions-summary-item client-actions-summary-item--debt">
                <span className="client-actions-summary-label">Saldo pendiente</span>
                <span className="client-actions-summary-value">{formatMXN(pendingAmount)}</span>
              </div>
            )}
            {hasContainers && (
              <div className="client-actions-summary-item client-actions-summary-item--containers">
                <span className="client-actions-summary-label">
                  Envases por recuperar
                </span>
                <span className="client-actions-summary-value">
                  {containersCount} · {formatMXN(containersAmount)}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="client-actions-list">
          <button
            type="button"
            className="client-actions-option client-actions-option--edit"
            onClick={() => {
              onEdit();
              onClose();
            }}
          >
            <IoPencil size={22} />
            <span className="client-actions-option-text">
              <span className="client-actions-option-title">Editar cliente</span>
              <span className="client-actions-option-desc">Modificar datos y crédito</span>
            </span>
          </button>

          {canViewHistory && (
            <button
              type="button"
              className="client-actions-option client-actions-option--history"
              onClick={() => {
                onViewHistory();
                onClose();
              }}
            >
              <IoReceiptOutline size={22} />
              <span className="client-actions-option-text">
                <span className="client-actions-option-title">Ver historial de crédito</span>
                <span className="client-actions-option-desc">Movimientos y abonos</span>
              </span>
            </button>
          )}

          {hasPending && (
            <button
              type="button"
              className="client-actions-option client-actions-option--pay"
              onClick={() => {
                onPay();
                onClose();
              }}
            >
              <IoCashOutline size={22} />
              <span className="client-actions-option-text">
                <span className="client-actions-option-title">Abonar a crédito</span>
                <span className="client-actions-option-desc">Registrar pago · {formatMXN(pendingAmount)}</span>
              </span>
            </button>
          )}

          {hasContainers && (
            <button
              type="button"
              className="client-actions-option client-actions-option--return"
              onClick={() => {
                onReturnContainers();
                onClose();
              }}
            >
              <IoReturnUpBackOutline size={22} />
              <span className="client-actions-option-text">
                <span className="client-actions-option-title">Regresar importe de envases</span>
                <span className="client-actions-option-desc">
                  {containersCount} envase{containersCount !== 1 ? "s" : ""} · {formatMXN(containersAmount)}
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientActionsModal;
