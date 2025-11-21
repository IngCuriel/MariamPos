import React, { useState, useEffect, useRef } from "react";
import Button from "../../components/Button";
import Card from "../../components/Card";
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
      await updateStock({
        productId: inventory.productId,
        newStock,
        reason,
        notes: notes.trim() || undefined,
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
      <div className="modal-container-inventory">
        <Card className="modal-card">
          <div className="modal-header">
            <h2>🔧 Ajustar Stock</h2>
            <button className="close-btn" onClick={onClose}>
              ×
            </button>
          </div>

          <div className="modal-content">
            <div className="product-info">
              <h3>{inventory.product?.name}</h3>
              <p>Código: {inventory.product?.code}</p>
              <p>
                Stock actual: <strong>{inventory.currentStock}</strong>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="inventory-form">
              <div className="form-group">
                <label htmlFor="newStock">Nuevo Stock *</label>
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

              <div className="form-group">
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

              <div className="form-group">
                <label htmlFor="notes">Notas (opcional)</label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Explicación del ajuste..."
                />
              </div>

              <div className="form-preview">
                <p>
                  <strong>Diferencia:</strong>{" "}
                  <span className={difference >= 0 ? "stock-positive" : "stock-negative"}>
                    {difference > 0 ? "+" : ""}
                    {difference} unidades
                  </span>
                </p>
                <p>
                  <strong>Nuevo stock:</strong>{" "}
                  <span className="stock-preview">{newStock}</span>
                </p>
              </div>

              <div className="form-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? "Guardando..." : "Aplicar Ajuste"}
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default InventoryAdjustModal;

