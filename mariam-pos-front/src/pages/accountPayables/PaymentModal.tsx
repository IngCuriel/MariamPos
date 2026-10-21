import React, { useState } from "react";
import type { AccountPayable, RegisterPaymentInput } from "../../types";
import { registerPayment } from "../../api/accountPayables";
import Swal from "sweetalert2";
import "../../styles/pages/accountPayables/accountPayables.css";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  accountPayable: AccountPayable;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount || 0);

const formatDate = (date: Date | string | null | undefined) => {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit" });
};

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
      Swal.fire({ icon: "error", title: "Error", text: "El monto del pago debe ser mayor a 0" });
      return;
    }
    if (paymentAmount > accountPayable.balance) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: `El monto del pago (${formatCurrency(paymentAmount)}) no puede ser mayor al saldo pendiente (${formatCurrency(accountPayable.balance)})`,
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

  const remainingAfter = Math.max(0, accountPayable.balance - (paymentAmount || 0));
  const willSettle = (paymentAmount || 0) >= accountPayable.balance && (paymentAmount || 0) > 0;

  const paymentMethods: Array<{ value: string; label: string; icon: string }> = [
    { value: "CASH", label: "Efectivo", icon: "💵" },
    { value: "TRANSFER", label: "Transferencia", icon: "🏦" },
    { value: "CHECK", label: "Cheque", icon: "🧾" },
    { value: "CARD", label: "Tarjeta", icon: "💳" },
  ];

  return (
    <div className="ap-pay-overlay" onClick={onClose}>
      <div className="ap-pay-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ap-pay-header">
          <h1>💰 Registrar Pago</h1>
          <button type="button" className="ap-pay-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form id="ap-pay-form" onSubmit={handleSubmit} className="ap-pay-body">
          {/* Izquierda: resumen de la deuda tipo ticket */}
          <aside className="ap-pay-summary">
            {/* Saldo pendiente como héroe */}
            <div className="ap-pay-hero">
              <span className="ap-pay-hero-label">Saldo pendiente</span>
              <span className="ap-pay-hero-value">{formatCurrency(accountPayable.balance)}</span>
            </div>

            <div className="ap-pay-supplier">
              <span className="ap-pay-supplier-icon">🏭</span>
              <div>
                <span className="ap-pay-supplier-name">
                  {accountPayable.supplier?.name || "N/A"}
                </span>
                {accountPayable.purchase && (
                  <span className="ap-pay-supplier-sub">Compra #{accountPayable.purchase.id}</span>
                )}
              </div>
            </div>

            <ul className="ap-pay-lines">
              <li>
                <span>Monto total</span>
                <span>{formatCurrency(accountPayable.amount)}</span>
              </li>
              <li>
                <span>Ya pagado</span>
                <span>{formatCurrency(accountPayable.paidAmount)}</span>
              </li>
              <li>
                <span>Vencimiento</span>
                <span>{formatDate(accountPayable.dueDate)}</span>
              </li>
            </ul>

            {/* Quedará después: cambia de color si salda la cuenta */}
            <div className={`ap-pay-after ${willSettle ? "ap-pay-after--ok" : "ap-pay-after--left"}`}>
              <span className="ap-pay-after-label">
                {willSettle ? "✅ Quedará saldada" : "Quedará pendiente"}
              </span>
              <span className="ap-pay-after-value">{formatCurrency(remainingAfter)}</span>
            </div>
          </aside>

          {/* Derecha: formulario de pago */}
          <div className="ap-pay-form">
            {/* Monto protagonista */}
            <div className="ap-pay-group">
              <label>
                Monto del pago <span className="ap-pay-required">*</span>
              </label>
              <div className="ap-pay-amount-wrap">
                <span className="ap-pay-amount-symbol">$</span>
                <input
                  type="number"
                  min="0.01"
                  max={accountPayable.balance}
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  required
                  className="ap-pay-amount"
                />
              </div>
              <div className="ap-pay-quick">
                <button
                  type="button"
                  className="ap-pay-quick-btn"
                  onClick={() => setPaymentAmount(accountPayable.balance)}
                >
                  Saldo total
                </button>
                <button
                  type="button"
                  className="ap-pay-quick-btn"
                  onClick={() =>
                    setPaymentAmount(Math.round((accountPayable.balance / 2) * 100) / 100)
                  }
                >
                  Mitad
                </button>
                <button
                  type="button"
                  className="ap-pay-quick-btn"
                  onClick={() =>
                    setPaymentAmount(Math.round((accountPayable.balance / 4) * 100) / 100)
                  }
                >
                  25%
                </button>
              </div>
            </div>

            {/* Método de pago como chips */}
            <div className="ap-pay-group">
              <label>Método de pago</label>
              <div className="ap-pay-methods">
                {paymentMethods.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    className={`ap-pay-method ${paymentMethod === m.value ? "ap-pay-method--on" : ""}`}
                    onClick={() => setPaymentMethod(m.value)}
                  >
                    <span className="ap-pay-method-icon">{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="ap-pay-row">
              <div className="ap-pay-group">
                <label>Fecha de pago</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>

              <div className="ap-pay-group">
                <label>Referencia</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Cheque, transf., etc."
                />
              </div>
            </div>

            <div className="ap-pay-group">
              <label>Notas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Notas adicionales (opcional)"
              />
            </div>
          </div>

          {/* Acciones (abarcan ambas columnas) */}
          <div className="ap-pay-actions">
            <button type="button" className="ap-btn ap-btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="ap-btn ap-btn--success">
              💾 Registrar Pago
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentModal;
