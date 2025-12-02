import React, { useState, useEffect, useRef } from "react";
import Button from "../../components/Button";
import Card from "../../components/Card";
import type { Inventory } from "../../types";
import { createInventoryMovement } from "../../api/inventory";
import Swal from "sweetalert2";
import "../../styles/pages/inventory/inventory.css";

interface InventoryEntryModalProps {
  inventory: Inventory;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const InventoryEntryModal: React.FC<InventoryEntryModalProps> = ({
  inventory,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("Compra");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const quantityRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setReason("Compra");
      setReference("");
      setNotes("");
      setTimeout(() => {
        quantityRef.current?.focus();
        quantityRef.current?.select();
      }, 100);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (quantity <= 0) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "La cantidad debe ser mayor a 0",
      });
      return;
    }

    setLoading(true);
    try {
      const branch = localStorage.getItem('sucursal') || undefined;
      const cashRegister = localStorage.getItem('caja') || undefined;
      
      await createInventoryMovement({
        productId: inventory.productId,
        type: "ENTRADA",
        quantity,
        reason,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        branch,
        cashRegister,
      });

      Swal.fire({
        icon: "success",
        title: "Entrada registrada",
        text: `Se agregaron ${quantity} unidades al inventario`,
        timer: 2000,
        showConfirmButton: false,
      });

      onSuccess();
    } catch (error) {
      console.error("Error creating movement:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo registrar la entrada",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container-inventory">
        <Card className="modal-card">
          <div className="modal-header">
            <h2>➕ Entrada de Inventario</h2>
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
                <label htmlFor="quantity">Cantidad *</label>
                <input
                  ref={quantityRef}
                  type="number"
                  id="quantity"
                  min="0.01"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  required
                  placeholder="Ej: 10"
                />
              </div>

              <div className="form-group">
                <label htmlFor="reason">Motivo</label>
                <select
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  <option value="Compra">Compra</option>
                  <option value="Devolución">Devolución</option>
                  <option value="Ajuste positivo">Ajuste positivo</option>
                  <option value="Transferencia entrada">Transferencia entrada</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="reference">Referencia (opcional)</label>
                <input
                  type="text"
                  id="reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ej: Factura #123, Orden #456"
                />
              </div>

              <div className="form-group">
                <label htmlFor="notes">Notas (opcional)</label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Notas adicionales..."
                />
              </div>

              <div className="form-preview">
                <p>
                  <strong>Stock después de la entrada:</strong>{" "}
                  <span className="stock-preview">
                    {inventory.currentStock + quantity}
                  </span>
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
                <Button type="submit" variant="success" disabled={loading}>
                  {loading ? "Guardando..." : "Registrar Entrada"}
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default InventoryEntryModal;

