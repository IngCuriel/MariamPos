import React, { useState } from "react";
import Button from "../../components/Button";
import Card from "../../components/Card";
import type { AccountPayable, RegisterPaymentInput } from "../../types";
import { registerPayment } from "../../api/accountPayables";
import Swal from "sweetalert2";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  accountPayable: AccountPayable;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onSave, accountPayable }) => {
  const [paymentAmount, setPaymentAmount] = useState<number>(accountPayable.balance);
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  React.useEffect(() => {
    if (isOpen) {
      setPaymentAmount(accountPayable.balance);
      setPaymentMethod("CASH");
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setReference("");
      setNotes("");
    }
  }, [isOpen, accountPayable]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (paymentAmount <= 0) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "El monto del pago debe ser mayor a 0",
      });
      return;
    }

    if (paymentAmount > accountPayable.balance) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: `El monto del pago ($${paymentAmount.toFixed(2)}) no puede ser mayor al saldo pendiente ($${accountPayable.balance.toFixed(2)})`,
      });
      return;
    }

    try {
      const paymentData: RegisterPaymentInput = {
        paymentAmount,
        paymentMethod,
        paymentDate,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      await registerPayment(accountPayable.id, paymentData);
      onSave();
      onClose();
    } catch (error: any) {
      console.error("Error registering payment:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.error || "No se pudo registrar el pago",
      });
    }
  };

  if (!isOpen) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <Card className="modal-content payment-modal" onClick={(e) => e?.stopPropagation()}>
        <div className="modal-header">
          <h2>Registrar Pago</h2>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="payment-form">
          <div className="payment-info">
            <div className="info-item">
              <span className="info-label">Proveedor:</span>
              <span className="info-value">{accountPayable.supplier?.name || "N/A"}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Monto Total:</span>
              <span className="info-value">{formatCurrency(accountPayable.amount)}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Pagado:</span>
              <span className="info-value">{formatCurrency(accountPayable.paidAmount)}</span>
            </div>
            <div className="info-item highlight">
              <span className="info-label">Saldo Pendiente:</span>
              <span className="info-value">{formatCurrency(accountPayable.balance)}</span>
            </div>
            {accountPayable.purchase && (
              <div className="info-item">
                <span className="info-label">Compra:</span>
                <span className="info-value">{accountPayable.purchase.folio}</span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>
              Monto del Pago <span className="required">*</span>
            </label>
            <input
              type="number"
              min="0.01"
              max={accountPayable.balance}
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
              required
              className="payment-amount-input"
            />
            <div className="input-hint">
              Máximo: {formatCurrency(accountPayable.balance)}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Método de Pago</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="CASH">Efectivo</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="CHECK">Cheque</option>
                <option value="CARD">Tarjeta</option>
              </select>
            </div>

            <div className="form-group">
              <label>Fecha de Pago</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Referencia</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Número de cheque, transferencia, etc. (opcional)"
            />
          </div>

          <div className="form-group">
            <label>Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Notas adicionales (opcional)"
            />
          </div>

          <div className="form-actions">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Registrar Pago
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default PaymentModal;

