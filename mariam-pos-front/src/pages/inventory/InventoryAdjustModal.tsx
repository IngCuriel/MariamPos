import React, { useState, useEffect, useRef } from "react";
import type { Inventory } from "../../types";
import { updateStock } from "../../api/inventory";
import Swal from "sweetalert2";
import "../../styles/pages/inventory/inventory.css";

interface InventoryAdjustModalProps {
  inventory: Inventory;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const InventoryAdjustModal: React.FC<InventoryAdjustModalProps> = ({
  inventory,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [newStock, setNewStock] = useState(inventory.currentStock);
  const [reason, setReason] = useState("Ajuste de inventario");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const stockRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setNewStock(inventory.currentStock);
      setReason("Ajuste de inventario");
      setNotes("");
      setTimeout(() => {
        stockRef.current?.focus();
        stockRef.current?.select();
      }, 100);
    }
  }, [isOpen, inventory.currentStock]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newStock < 0) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "El stock no puede ser negativo",
      });
      return;
    }

    if (newStock === inventory.currentStock) {
      Swal.fire({
        icon: "info",
        title: "Sin cambios",
        text: "El stock no ha cambiado",
      });
      return;
    }

    setLoading(true);
    try {
      const branch = localStorage.getItem('sucursal') || undefined;
      const cashRegister = localStorage.getItem('caja') || undefined;
      
      await updateStock({
        productId: inventory.productId,
        newStock,
        reason,
        notes: notes.trim() || undefined,
        branch,
        cashRegister,
      });

      const difference = newStock - inventory.currentStock;
      Swal.fire({
        icon: "success",
        title: "Stock actualizado",
        text: `Stock ajustado ${difference > 0 ? "+" : ""}${difference} unidades`,
        timer: 2000,
        showConfirmButton: false,
      });

      onSuccess();
    } catch (error) {
      console.error("Error updating stock:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo actualizar el stock",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const difference = newStock - inventory.currentStock;

  return (
    <div className="modal-overlay">
      <div className="inv-modal">
        <div className="inv-modal-header">
          <h2>🔧 Ajustar Stock</h2>
          <button className="inv-modal-close" onClick={onClose} title="Cerrar">
            ×
          </button>
        </div>

        <div className="inv-modal-body">
          <div className="inv-modal-product">
            <span className="inv-modal-product-name">
              {inventory.product?.name}
            </span>
            <span className="inv-modal-product-meta">
              Código: {inventory.product?.code || "—"} · Stock actual:{" "}
              <strong>{inventory.currentStock}</strong>
            </span>
          </div>

          <form onSubmit={handleSubmit} className="inv-form">
            <div className="inv-form-row">
              <div className="inv-field">
                <label htmlFor="newStock">Nuevo stock *</label>
                <input
                  ref={stockRef}
                  type="number"
                  id="newStock"
                  min="0"
                  step="0.01"
                  value={newStock}
                  onChange={(e) => setNewStock(Number(e.target.value))}
                  required
                  placeholder="Ej: 50"
                />
              </div>
              <div className="inv-field">
                <label htmlFor="reason">Motivo del ajuste</label>
                <select
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  <option value="Ajuste de inventario">Ajuste de inventario</option>
                  <option value="Corrección de error">Corrección de error</option>
                  <option value="Merma/Desperdicio">Merma/Desperdicio</option>
                  <option value="Conteo físico">Conteo físico</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            </div>

            <div className="inv-field">
              <label htmlFor="notes">Notas (opcional)</label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Explicación del ajuste..."
              />
            </div>

            {/* Resultado: diferencia + nuevo stock */}
            <div
              className={`inv-preview ${
                difference >= 0 ? "inv-preview--add" : "inv-preview--remove"
              }`}
            >
              <span>
                Diferencia:{" "}
                <strong>
                  {difference > 0 ? "+" : ""}
                  {difference}
                </strong>
              </span>
              <span>
                Nuevo stock: <strong>{newStock}</strong>
              </span>
            </div>

            <div className="inv-form-actions">
              <button
                type="button"
                className="inv-btn inv-btn--ghost"
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inv-btn inv-btn--primary"
                disabled={loading}
              >
                {loading ? "Guardando..." : "Aplicar ajuste"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default InventoryAdjustModal;

