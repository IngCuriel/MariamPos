import { useState, useEffect, useRef, useCallback } from "react";
import { FaMoneyBillWave, FaCreditCard } from "react-icons/fa";
import { IoCloseCircleOutline } from "react-icons/io5";
import Swal from "sweetalert2";
import type { ConfirmPaymentData } from "../../types/index";
import "../../styles/pages/sales/paymentModal.css";
interface PaymentModalProps {
  total: number;
  onClose: () => void;
  onConfirm: (confirmData: ConfirmPaymentData) => void;
}

const bills = [.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]; // ← Aquí defines tus billetes

const PaymentModal: React.FC<PaymentModalProps> = ({ total, onClose, onConfirm }) => {
  const [paymentType, setPaymentType] = useState("efectivo");
  const [amountReceived, setAmountReceived] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const totalNumber = total;
  const received = parseFloat(amountReceived || "0");
  const change = paymentType === "efectivo" ? Math.max(received - totalNumber, 0) : 0;

  useEffect(() => {
    if (paymentType === "efectivo" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [paymentType]);

  const handleConfirm = useCallback(() => {
    let finalAmount = received;

    if (paymentType === "efectivo" && amountReceived.trim() === "") {
      finalAmount = totalNumber;
    }

    if (paymentType === "efectivo" && finalAmount < totalNumber) {
      Swal.fire({
        title: "💵 Monto insuficiente",
        text: `El monto recibido ($${finalAmount.toFixed(2)}) es menor al total ($${totalNumber.toFixed(2)}).`,
        icon: "warning",
        confirmButtonText: "Entendido",
        confirmButtonColor: "#3085d6",
        focusConfirm: false,
        returnFocus: false,
      }).then(() => {
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
          }
        }, 10);
      });

      return;
    }

    Swal.fire({
      title: "✅ Cobro exitoso",
      text:
        paymentType === "efectivo"
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

            {/* 💵 Botones de billetes */}
            <div className="bills-grid">
              {bills.map((b) => (
                <button
                  key={b}
                  className="bill-btn"
                  onClick={() => {
                    const newAmount = (parseFloat(amountReceived || "0") + b).toString();
                    setAmountReceived(newAmount);
                  }}
                >
                  ${b}
                </button>
              ))}
            </div>

            {/* Input opcional */}
            <div className="input-wrapper">
            <input
              ref={inputRef}
              type="number"
              placeholder="(Opcional)"
              value={amountReceived}
              onChange={(e) => setAmountReceived(e.target.value)}
            />
             {amountReceived.length > 0 && (
                  <button
                    className="clear-btn-payment"
                    onClick={() => {
                      setAmountReceived("");
                      inputRef.current?.focus();
                    }}
                  >
                    ❌
                  </button>
                )}
            </div>
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
