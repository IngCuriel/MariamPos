import React, { useState, useEffect, useRef } from "react";
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
  // Factor de la presentación elegida: 1 = pieza (base); 24 = reja, etc.
  const [unitFactor, setUnitFactor] = useState(1);
  const quantityRef = useRef<HTMLInputElement>(null);

  // Presentaciones del producto (solo las que agrupan más de 1 pieza).
  const packPresentations = (inventory.product?.presentations ?? []).filter(
    (p) => p.quantity > 1
  );
  // Piezas reales que se darán de entrada (cantidad × factor de presentación).
  const basePieces = (quantity || 0) * unitFactor;

  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setReason("Compra");
      setReference("");
      setNotes("");
      setUnitFactor(1);
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

      // Si se eligió una presentación, dejar constancia en las notas y mover
      // el inventario SIEMPRE en piezas (unidad base).
      const presName = packPresentations.find(
        (p) => p.quantity === unitFactor
      )?.name;
      const packNote =
        unitFactor > 1 && presName
          ? `Entrada por presentación: ${quantity} ${presName} × ${unitFactor} = ${basePieces} pza`
          : "";
      const finalNotes = [notes.trim(), packNote].filter(Boolean).join(" — ");

      await createInventoryMovement({
        productId: inventory.productId,
        type: "ENTRADA",
        quantity: basePieces,
        reason,
        reference: reference.trim() || undefined,
        notes: finalNotes || undefined,
        branch,
        cashRegister,
      });

      Swal.fire({
        icon: "success",
        title: "Entrada registrada",
        text:
          unitFactor > 1
            ? `Se agregaron ${basePieces} piezas (${quantity} ${presName}) al inventario`
            : `Se agregaron ${basePieces} unidades al inventario`,
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
      <div className="inv-modal">
        <div className="inv-modal-header">
          <h2>➕ Entrada de Inventario</h2>
          <button className="inv-modal-close" onClick={onClose} title="Cerrar">
            ×
          </button>
        </div>

        <div className="inv-modal-body">
          {/* Datos del producto en una fila compacta */}
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
            {/* Presentación: solo si el producto tiene presentaciones mayores a 1 */}
            {packPresentations.length > 0 && (
              <div className="inv-field">
                <label htmlFor="presentation">Dar entrada por</label>
                <select
                  id="presentation"
                  value={unitFactor}
                  onChange={(e) => setUnitFactor(Number(e.target.value))}
                >
                  <option value={1}>Pieza (unidad base)</option>
                  {packPresentations.map((p) => (
                    <option key={p.id ?? p.name} value={p.quantity}>
                      {p.name} ({p.quantity} pza)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="inv-form-row">
              <div className="inv-field">
                <label htmlFor="quantity">
                  Cantidad * {unitFactor > 1 ? "(en presentación)" : ""}
                </label>
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
              <div className="inv-field">
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
            </div>

            <div className="inv-field">
              <label htmlFor="reference">Referencia (opcional)</label>
              <input
                type="text"
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Ej: Factura #123, Orden #456"
              />
            </div>

            <div className="inv-field">
              <label htmlFor="notes">Notas (opcional)</label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Notas adicionales..."
              />
            </div>

            {/* Resultado */}
            <div className="inv-preview inv-preview--add">
              <span>
                {unitFactor > 1
                  ? `Entran ${basePieces} pza (${quantity || 0} × ${unitFactor})`
                  : "Stock después de la entrada"}
              </span>
              <strong>{inventory.currentStock + basePieces}</strong>
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
                className="inv-btn inv-btn--success"
                disabled={loading}
              >
                {loading ? "Guardando..." : "Registrar entrada"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default InventoryEntryModal;

