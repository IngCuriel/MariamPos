import  { useState, useEffect, useRef } from "react";
import { FaMoneyBillWave, FaCreditCard } from "react-icons/fa";
import { IoCloseCircleOutline } from "react-icons/io5";
import type { ConfirmPaymentData } from "../../types/index";

interface PaymentModalProps {
  total:number;
  onClose: () => void;
  onConfirm: (confirmData:ConfirmPaymentData) => void;
}

const PaymentModal:React.FC<PaymentModalProps> = ({ total, onClose, onConfirm }) => {
  const [paymentType, setPaymentType] = useState("efectivo");
  const [amountReceived, setAmountReceived] = useState<number>(0);

  const inputRef = useRef<HTMLInputElement>(null); // 👈 referencia al input

  const totalNumber = total;
  const change = paymentType === "efectivo" ? amountReceived - totalNumber : 0;

  // 👇 Cuando se abra el modal, enfoca el input automáticamente
  useEffect(() => {
    if (paymentType === "efectivo" && inputRef.current) {
      inputRef.current?.focus();
    }
  }, [paymentType]);

  const handleConfirm = () => {
    if (paymentType === "efectivo" && amountReceived < totalNumber) {
      alert(`El monto recibido es menor al total. -- ${amountReceived} -- ${totalNumber}`);
      return;
    }
    onConfirm({paymentType, amountReceived, change });
  };

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
            Efectivo
          </button>
          <button
            className={`payment-btn ${paymentType === "tarjeta" ? "active" : ""}`}
            onClick={() => setPaymentType("tarjeta")}
          >
            <FaCreditCard size={30} />
            Tarjeta
          </button>
        </div>

        {paymentType === "efectivo" && (
          <div className="input-section">
            <label>Monto recibido:</label>
            <input
              ref={inputRef} // 👈 referencia aquí
              type="number"
              placeholder="0.00"
              value={amountReceived}
              onChange={(e) => setAmountReceived(parseFloat(e.target.value))}
            />
            <p className="change-text">Cambio: ${change.toFixed(2)}</p>
          </div>
        )}

        <button className="confirm-btn" onClick={handleConfirm}>
          Confirmar Cobro
        </button>
      </div>
    </div>
  );
};

export default PaymentModal;