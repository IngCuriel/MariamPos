import React from "react";
import { IoClose, IoChevronForward } from "react-icons/io5";
import type { ClientCredit } from "../../types/index";
import "../../styles/pages/client/creditSelectionModal.css";

interface CreditSelectionModalProps {
  isOpen: boolean;
  clientName?: string;
  credits: ClientCredit[];
  onClose: () => void;
  onSelect: (credit: ClientCredit) => void;
}

const formatMXN = (value: number) =>
  (value || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const formatDate = (value: Date | string) => {
  try {
    return new Date(value).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
};

const CreditSelectionModal: React.FC<CreditSelectionModalProps> = ({
  isOpen,
  clientName,
  credits,
  onClose,
  onSelect,
}) => {
  if (!isOpen) return null;

  const total = credits.reduce((sum, c) => sum + (c.remainingAmount || 0), 0);

  return (
    <div className="credit-sel-overlay" onClick={onClose} role="presentation">
      <div
        className="credit-sel-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-sel-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="credit-sel-header">
          <div className="credit-sel-header-info">
            <h2 id="credit-sel-title" className="credit-sel-title">
              Seleccionar crédito
            </h2>
            <span className="credit-sel-subtitle">
              {clientName ? `${clientName} · ` : ""}
              {credits.length} crédito{credits.length !== 1 ? "s" : ""} pendiente{credits.length !== 1 ? "s" : ""} · {formatMXN(total)}
            </span>
          </div>
          <button
            type="button"
            className="credit-sel-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <IoClose size={24} />
          </button>
        </div>

        <div className="credit-sel-list">
          {credits.map((credit) => {
            const isPartial = credit.status === "PARTIALLY_PAID";
            return (
              <button
                type="button"
                key={credit.id}
                className="credit-sel-card"
                onClick={() => onSelect(credit)}
              >
                <div className="credit-sel-card-main">
                  <div className="credit-sel-card-top">
                    <span className="credit-sel-card-folio">Venta #{credit.saleId}</span>
                    <span
                      className={`credit-sel-badge ${isPartial ? "credit-sel-badge--partial" : "credit-sel-badge--pending"}`}
                    >
                      {isPartial ? "Parcial" : "Pendiente"}
                    </span>
                  </div>
                  <div className="credit-sel-card-meta">
                    <span>{formatDate(credit.createdAt)}</span>
                    {credit.originalAmount > 0 && credit.originalAmount !== credit.remainingAmount && (
                      <span>
                        Total {formatMXN(credit.originalAmount)} · Pagado {formatMXN(credit.paidAmount)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="credit-sel-card-right">
                  <span className="credit-sel-card-amount-label">Saldo</span>
                  <span className="credit-sel-card-amount">{formatMXN(credit.remainingAmount)}</span>
                </div>
                <IoChevronForward size={22} className="credit-sel-card-chevron" />
              </button>
            );
          })}
        </div>

        <div className="credit-sel-footer">
          <button type="button" className="credit-sel-cancel" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreditSelectionModal;
