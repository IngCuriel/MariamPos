import React, { useEffect, useState } from "react";
import { IoClose } from "react-icons/io5";
import "../../styles/components/containersSummaryModal.css";

export interface ContainerSummaryDetail {
  name: string;
  quantity: number; // cantidad máxima (del carrito)
  amount: number; // importe total a esa cantidad
}

export interface AdjustedContainersInfo {
  total: number;
  count: number;
  details: Array<{ name: string; quantity: number; amount: number }>;
}

interface ContainersSummaryModalProps {
  isOpen: boolean;
  clientName: string;
  details: ContainerSummaryDetail[];
  onCancel: () => void;
  onConfirm: (info: AdjustedContainersInfo) => void;
}

const mxn = (n: number) =>
  (n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const ContainersSummaryModal: React.FC<ContainersSummaryModalProps> = ({
  isOpen,
  clientName,
  details,
  onCancel,
  onConfirm,
}) => {
  // Cantidad ajustada por envase (inicia en el máximo = todos se dejan).
  const [qtys, setQtys] = useState<number[]>([]);

  useEffect(() => {
    if (isOpen) {
      setQtys(details.map((d) => d.quantity));
    }
  }, [isOpen, details]);

  if (!isOpen) return null;

  const unitPrice = (d: ContainerSummaryDetail) =>
    d.quantity > 0 ? d.amount / d.quantity : 0;

  const setQty = (idx: number, value: number) => {
    setQtys((prev) =>
      prev.map((q, i) =>
        i === idx ? Math.max(0, Math.min(details[idx].quantity, value)) : q
      )
    );
  };

  const totalCount = qtys.reduce((s, q) => s + q, 0);
  const totalAmount = details.reduce((s, d, i) => s + qtys[i] * unitPrice(d), 0);

  const handleConfirm = () => {
    const finalDetails = details
      .map((d, i) => ({
        name: d.name,
        quantity: qtys[i],
        amount: qtys[i] * unitPrice(d),
      }))
      .filter((d) => d.quantity > 0);
    onConfirm({ total: totalAmount, count: totalCount, details: finalDetails });
  };

  return (
    <div className="csm-overlay" onClick={onCancel} role="presentation">
      <div
        className="csm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="csm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="csm-header">
          <h2 id="csm-title" className="csm-title">🍺 Resumen de Envases</h2>
          <button className="csm-close" onClick={onCancel} aria-label="Cerrar">
            <IoClose size={22} />
          </button>
        </div>

        <div className="csm-body">
          <div className="csm-hint">
            <span>Cliente: <strong>{clientName}</strong></span>
            <span className="csm-hint-note">Ajustá si trajo algunos envases</span>
          </div>

          <div className="csm-list">
            {details.map((d, idx) => {
              const up = unitPrice(d);
              const q = qtys[idx] ?? 0;
              return (
                <div key={idx} className="csm-row">
                  <div className="csm-row-info">
                    <span className="csm-row-name">{d.name}</span>
                    <span className="csm-row-unit">{mxn(up)} c/u</span>
                  </div>
                  <div className="csm-stepper">
                    <button
                      type="button"
                      className="csm-step"
                      disabled={q <= 0}
                      onClick={() => setQty(idx, q - 1)}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      className="csm-qty"
                      value={q}
                      min={0}
                      max={d.quantity}
                      onChange={(e) => setQty(idx, parseInt(e.target.value) || 0)}
                    />
                    <button
                      type="button"
                      className="csm-step"
                      disabled={q >= d.quantity}
                      onClick={() => setQty(idx, q + 1)}
                    >
                      +
                    </button>
                    <span className="csm-max">/ {d.quantity}</span>
                  </div>
                  <span className="csm-row-amount">{mxn(q * up)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer SIEMPRE visible: total + acciones (sin scroll) */}
        <div className="csm-footer">
          <div className="csm-totals">
            <span className="csm-totals-count">{totalCount} envase{totalCount !== 1 ? "s" : ""}</span>
            <span className="csm-totals-amount">{mxn(totalAmount)}</span>
          </div>
          <div className="csm-actions">
            <button type="button" className="csm-btn csm-btn--ghost" onClick={onCancel}>
              Cancelar
            </button>
            <button type="button" className="csm-btn csm-btn--confirm" onClick={handleConfirm}>
              Continuar con el cobro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContainersSummaryModal;
