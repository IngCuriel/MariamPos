import { useState, useEffect, useRef, useCallback } from "react";
import { FaMoneyBillWave, FaCreditCard } from "react-icons/fa";
import { IoCloseCircleOutline } from "react-icons/io5";
import Swal from "sweetalert2"; // 👈 para los mensajes visuales
import type { ConfirmPaymentData } from "../../types/index";

interface PaymentModalProps {
  total: number;
  onClose: () => void;
  onConfirm: (confirmData: ConfirmPaymentData) => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ total, onClose, onConfirm }) => {
  const [paymentType, setPaymentType] = useState("efectivo");
  const [amountReceived, setAmountReceived] = useState<string>(""); // vacío por defecto
  const inputRef = useRef<HTMLInputElement>(null);

  const totalNumber = total;
  const received = parseFloat(amountReceived || "0");
  const change =
    paymentType === "efectivo" ? Math.max(received - totalNumber, 0) : 0;

  useEffect(() => {
    if (paymentType === "efectivo" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [paymentType]);

  const handleConfirm = useCallback(() => {
    let finalAmount = received;

    // ✅ Caso 1: No se ingresó nada → se asume pago exacto
    if (paymentType === "efectivo" && amountReceived.trim() === "") {
      finalAmount = totalNumber;
    }

    // ✅ Caso 2: Si el monto es menor → mostrar mensaje elegante
    if (paymentType === "efectivo" && finalAmount < totalNumber) {
      Swal.fire({
        title: "💵 Monto insuficiente",
        text: `El monto recibido ($${finalAmount.toFixed(2)}) es menor al total ($${totalNumber.toFixed(2)}).`,
        icon: "warning",
        confirmButtonText: "Entendido",
        confirmButtonColor: "#3085d6",
      });
      return;
    }

    // ✅ Caso 3: Cobro correcto
    Swal.fire({
      title: "✅ Cobro exitoso",
      text: paymentType === "efectivo"
        ? `Se ha cobrado $${finalAmount.toFixed(2)} (Cambio: $${change.toFixed(2)})`
        : "Pago con tarjeta registrado correctamente.",
      icon: "success",
      timer: 5000,
      showConfirmButton: false,
    });

    onConfirm({
      paymentType,
      amountReceived: finalAmount,
      change,
    });
  }, [paymentType, amountReceived, totalNumber, received, change, onConfirm]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.code === "Space") {
        e.preventDefault();
        // Alternar entre efectivo y tarjeta
        setPaymentType((prev) => (prev === "efectivo" ? "tarjeta" : "efectivo"));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleConfirm, onClose]);

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <button className="close-btn" onClick={onClose}>
          <IoCloseCircleOutline size={32} />
        </button>

        <h2 className="modal-title">💰 Cobrar Venta</h2>

        <div className="total-section">
          <p>Total a cobrar:</p>
          <h1>${totalNumber.toFixed(2)}</h1>
        </div>

        <div className="payment-options">
          <button
            className={`payment-btn ${paymentType === "efectivo" ? "active" : ""}`}
            onClick={() => setPaymentType("efectivo")}
          >
            <FaMoneyBillWave size={30} />
            Efectivo (Espacio)
          </button>
          <button
            className={`payment-btn ${paymentType === "tarjeta" ? "active" : ""}`}
            onClick={() => setPaymentType("tarjeta")}
          >
            <FaCreditCard size={30} />
            Tarjeta (Espacio)
          </button>
        </div>

        {paymentType === "efectivo" && (
          <div className="input-section">
            <label>Monto recibido:</label>
            <input
              ref={inputRef}
              type="number"
              placeholder="(Opcional)"
              value={amountReceived}
              onChange={(e) => setAmountReceived(e.target.value)}
            />
            <p className="change-text">Cambio: ${change.toFixed(2)}</p>
          </div>
        )}

        <div className="payment-modal-actions">
          <button className="cancel-btn-payment" onClick={onClose}>
            Cancelar (ESC)
          </button>
          <button className="confirm-btn" onClick={handleConfirm}>
            Confirmar Cobro (Enter)
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
