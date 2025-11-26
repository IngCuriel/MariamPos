import React, { useState, useEffect } from "react";
import { IoCloseCircleOutline } from "react-icons/io5";
import Swal from "sweetalert2";
import { createCreditPayment, getCreditById } from "../../api/credits";
import type { ClientCredit, CreateCreditPaymentInput } from "../../types/index";
import "../../styles/pages/sales/paymentModal.css";

interface CreditPaymentModalProps {
  isOpen: boolean;
  credit: ClientCredit | null;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

const CreditPaymentModal: React.FC<CreditPaymentModalProps> = ({
  isOpen,
  credit,
  onClose,
  onPaymentSuccess,
}) => {
  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("efectivo");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [creditDetails, setCreditDetails] = useState<ClientCredit | null>(credit);

  useEffect(() => {
    if (isOpen && credit) {
      loadCreditDetails();
      setAmount("");
      setPaymentMethod("efectivo");
      setNotes("");
    }
  }, [isOpen, credit]);

  const loadCreditDetails = async () => {
    if (!credit) return;
    try {
      const details = await getCreditById(credit.id);
      setCreditDetails(details);
    } catch (error) {
      console.error("Error al cargar detalles del crédito:", error);
    }
  };

  const handleSubmit = async () => {
    if (!creditDetails) return;

    const paymentAmount = parseFloat(amount);
    
    if (!amount || paymentAmount <= 0) {
      Swal.fire({
        icon: "warning",
        title: "Monto inválido",
        text: "Debe ingresar un monto mayor a 0",
        confirmButtonText: "Entendido",
      });
      return;
    }

    if (paymentAmount > creditDetails.remainingAmount) {
      Swal.fire({
        icon: "error",
        title: "Monto excedido",
        text: `El monto del abono ($${paymentAmount.toFixed(2)}) no puede ser mayor al saldo pendiente ($${creditDetails.remainingAmount.toFixed(2)})`,
        confirmButtonText: "Entendido",
      });
      return;
    }

    setLoading(true);
    try {
      const input: CreateCreditPaymentInput = {
        amount: paymentAmount,
        paymentMethod: paymentMethod,
        notes: notes.trim() || undefined,
      };

      await createCreditPayment(creditDetails.id, input);
      
      Swal.fire({
        icon: "success",
        title: "✅ Abono registrado",
        html: `
          <p>El abono de $${paymentAmount.toFixed(2)} se ha registrado correctamente.</p>
          <p style="margin-top: 10px; color: #059669; font-weight: 600;">
            Saldo pendiente restante: $${(creditDetails.remainingAmount - paymentAmount).toFixed(2)}
          </p>
        `,
        timer: 3000,
        showConfirmButton: false,
      });

      onPaymentSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error al registrar abono:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.error || "No se pudo registrar el abono",
        confirmButtonText: "Entendido",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !creditDetails) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="payment-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="payment-modal-header">
          <h2>💳 Registrar Abono</h2>
          <button className="close-btn" onClick={onClose}>
            <IoCloseCircleOutline size={24} />
          </button>
        </div>

        <div className="payment-modal-content">
          {/* Información del crédito */}
          <div style={{ 
            padding: "16px", 
            backgroundColor: "#f3f4f6", 
            borderRadius: "8px", 
            marginBottom: "20px" 
          }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "1rem", color: "#374151" }}>
              Información del Crédito
            </h3>
            <div style={{ display: "grid", gap: "8px", fontSize: "0.9rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6b7280" }}>Cliente:</span>
                <strong>{creditDetails.client?.name || "N/A"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6b7280" }}>Venta #:</span>
                <strong>{creditDetails.saleId}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6b7280" }}>Monto original:</span>
                <strong>${creditDetails.originalAmount.toFixed(2)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6b7280" }}>Pagado:</span>
                <strong style={{ color: "#059669" }}>${creditDetails.paidAmount.toFixed(2)}</strong>
              </div>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                paddingTop: "8px", 
                borderTop: "1px solid #d1d5db",
                marginTop: "8px"
              }}>
                <span style={{ color: "#6b7280", fontWeight: "600" }}>Saldo pendiente:</span>
                <strong style={{ color: "#dc2626", fontSize: "1.1rem" }}>
                  ${creditDetails.remainingAmount.toFixed(2)}
                </strong>
              </div>
            </div>
          </div>

          {/* Formulario de abono */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                Monto del abono *
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                max={creditDetails.remainingAmount}
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: "1.1rem",
                  border: "2px solid #d1d5db",
                  borderRadius: "6px",
                  fontWeight: "600",
                }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSubmit();
                  }
                }}
              />
              <small style={{ display: "block", marginTop: "4px", color: "#6b7280" }}>
                Máximo: ${creditDetails.remainingAmount.toFixed(2)}
              </small>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                Método de pago
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: "1rem",
                  border: "2px solid #d1d5db",
                  borderRadius: "6px",
                }}
              >
                <option value="efectivo">💵 Efectivo</option>
                <option value="tarjeta">💳 Tarjeta</option>
                <option value="transferencia">📱 Transferencia</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                Notas (Opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionales sobre el abono..."
                rows={3}
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: "0.9rem",
                  border: "2px solid #d1d5db",
                  borderRadius: "6px",
                  resize: "vertical",
                }}
              />
            </div>
          </div>
        </div>

        <div className="payment-modal-footer">
          <button
            className="btn touch-btn"
            onClick={onClose}
            style={{ backgroundColor: "#6b7280" }}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            className="btn touch-btn"
            onClick={handleSubmit}
            style={{ backgroundColor: "#059669" }}
            disabled={loading || !amount || parseFloat(amount || "0") <= 0}
          >
            {loading ? "Registrando..." : "💳 Registrar Abono"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreditPaymentModal;

