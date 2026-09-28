import React, { useEffect, useRef, useState } from "react";
import { IoClose } from "react-icons/io5";
import "../../styles/pages/sales/savePendingModal.css";

interface SavePendingModalProps {
  isOpen: boolean;
  total: number;
  itemCount: number;
  onClose: () => void;
  onConfirm: (description: string) => void;
}

/**
 * Modal para guardar una venta pendiente.
 * La descripción es OPCIONAL (para recordar). El folio único lo genera el
 * backend (PP-1000, PP-1001…) y se muestra después de guardar.
 */
const SavePendingModal: React.FC<SavePendingModalProps> = ({
  isOpen,
  total,
  itemCount,
  onClose,
  onConfirm,
}) => {
  const [description, setDescription] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setDescription("");
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const money = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

  const handleConfirm = () => {
    onConfirm(description.trim());
  };

  return (
    <div className="spend-overlay" onClick={onClose} role="presentation">
      <div className="spend-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="spend-header">
          <h2 className="spend-title">🕓 Guardar venta pendiente</h2>
          <button className="spend-close" onClick={onClose} aria-label="Cerrar">
            <IoClose size={22} />
          </button>
        </div>

        <div className="spend-body">
          {/* Resumen de la venta */}
          <div className="spend-summary">
            <div className="spend-summary-item">
              <span className="spend-summary-label">Productos</span>
              <span className="spend-summary-value">{itemCount}</span>
            </div>
            <div className="spend-summary-item">
              <span className="spend-summary-label">Total</span>
              <span className="spend-summary-value spend-summary-total">{money(total)}</span>
            </div>
          </div>

          <p className="spend-help">
            Al guardar se generará un <strong>folio</strong> para darle al cliente.
            Puedes agregar una descripción para recordar la venta (opcional).
          </p>

          <label className="spend-label" htmlFor="pend-desc">
            📝 Descripción (opcional)
          </label>
          <input
            id="pend-desc"
            ref={inputRef}
            className="spend-input"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm();
            }}
            placeholder="Ej: Señor de la camioneta, Mesa 3, Juan…"
          />
        </div>

        <div className="spend-footer">
          <button type="button" className="spend-btn spend-btn--cancel" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="spend-btn spend-btn--save" onClick={handleConfirm}>
            Guardar pendiente
          </button>
        </div>
      </div>
    </div>
  );
};

export default SavePendingModal;
