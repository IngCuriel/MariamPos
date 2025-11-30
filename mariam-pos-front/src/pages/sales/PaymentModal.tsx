import { useState, useEffect, useRef, useCallback } from "react";
import { FaMoneyBillWave, FaCreditCard, FaGift } from "react-icons/fa";
import { IoCloseCircleOutline } from "react-icons/io5";
import Swal from "sweetalert2";
import type { ConfirmPaymentData } from "../../types/index";
import { getClientCreditSummary } from "../../api/credits";
import "../../styles/pages/sales/paymentModal.css";
import type { Client } from "../../types/index";

interface PaymentModalProps {
  total: number;
  client?: Client | null; // Información del cliente para validar crédito
  containersDepositInfo?: {
    total: number;
    count: number;
    details: Array<{ name: string; quantity: number; amount: number }>;
  } | null;
  onClose: () => void;
  onConfirm: (confirmData: ConfirmPaymentData) => void;
}

const bills = [500, 200, 100, 50]; // ← Aquí defines tus billetes

const PaymentModal: React.FC<PaymentModalProps> = ({ total, client, containersDepositInfo, onClose, onConfirm }) => {
  const [paymentType, setPaymentType] = useState("efectivo");
  const [amountReceived, setAmountReceived] = useState<string>("");
  const [cashAmount, setCashAmount] = useState<string>("");
  const [cardAmount, setCardAmount] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);
  const cardInputRef = useRef<HTMLInputElement>(null);

  // Calcular total incluyendo depósito de envases
  const containersTotal = containersDepositInfo?.total || 0;
  const totalNumber = total + containersTotal;
  const received = parseFloat(amountReceived || "0");
  const cashReceived = parseFloat(cashAmount || "0");
  const cardReceived = parseFloat(cardAmount || "0");
  const change = paymentType === "efectivo" ? Math.max(received - totalNumber, 0) : 0;
  const totalMixed = cashReceived + cardReceived;

  useEffect(() => {
    if (paymentType === "efectivo" && inputRef.current) {
      inputRef.current.focus();
    } else if (paymentType === "mixto" && cashInputRef.current) {
      cashInputRef.current.focus();
    }
  }, [paymentType]);

  // Limpiar campos cuando cambia el tipo de pago
  useEffect(() => {
    if (paymentType === "mixto") {
      setAmountReceived("");
    } else if (paymentType === "regalo") {
      setAmountReceived("");
      setCashAmount("");
      setCardAmount("");
    } else {
      setCashAmount("");
      setCardAmount("");
    }
  }, [paymentType]);

  const handleConfirm = useCallback(async () => {
    if (paymentType === "mixto") {
      // Validar pago mixto
      if (totalMixed === 0) {
        Swal.fire({
          title: "⚠️ Montos requeridos",
          text: "Debe ingresar al menos un monto en efectivo o tarjeta.",
          icon: "warning",
          confirmButtonText: "Entendido",
        });
        return;
      }

      if (totalMixed !== totalNumber) {
        Swal.fire({
          title: "💵 Monto incorrecto",
          text: `La suma de efectivo ($${cashReceived.toFixed(2)}) y tarjeta ($${cardReceived.toFixed(2)}) = $${totalMixed.toFixed(2)}, pero el total es $${totalNumber.toFixed(2)}.`,
          icon: "warning",
          confirmButtonText: "Entendido",
          confirmButtonColor: "#3085d6",
        });
        return;
      }

      if (cashReceived < 0 || cardReceived < 0) {
        Swal.fire({
          title: "⚠️ Montos inválidos",
          text: "Los montos no pueden ser negativos.",
          icon: "warning",
          confirmButtonText: "Entendido",
        });
        return;
      }

      Swal.fire({
        title: "✅ Cobro exitoso",
        html: `
          <p>Pago mixto registrado correctamente:</p>
          <p style="margin-top: 10px;">
            💵 Efectivo: <strong>$${cashReceived.toFixed(2)}</strong><br/>
            💳 Tarjeta: <strong>$${cardReceived.toFixed(2)}</strong><br/>
            <span style="color: #059669; font-weight: 600; font-size: 1.1rem;">Total: $${totalNumber.toFixed(2)}</span>
          </p>
        `,
        icon: "success",
        timer: 5000,
        showConfirmButton: false,
      });

      onConfirm({
        paymentType: "mixto",
        amountReceived: totalNumber,
        change: 0,
        cashAmount: cashReceived,
        cardAmount: cardReceived,
        containersDepositInfo: containersDepositInfo || null,
      });
      return;
    }

    // Lógica para efectivo o tarjeta
    let finalAmount = received;

    if (paymentType === "efectivo" && amountReceived.trim() === "") {
      finalAmount = totalNumber;
    }

    if (paymentType === "efectivo" && finalAmount < totalNumber) {
      const missingAmount = totalNumber - finalAmount;
      
      // Validar si el cliente puede usar crédito
      if (client && client.allowCredit && client.creditLimit) {
        try {
          // Obtener créditos pendientes del cliente
          const creditSummary = await getClientCreditSummary(client.id);
          const currentPending = creditSummary.totalPending || 0;
          const availableCredit = client.creditLimit - currentPending;
          
          if (missingAmount <= availableCredit) {
            // El cliente puede usar crédito
            const { value: useCredit } = await Swal.fire({
              title: "💳 Monto insuficiente",
              html: `
                <p>El monto recibido ($${finalAmount.toFixed(2)}) es menor al total ($${totalNumber.toFixed(2)}).</p>
                <p style="margin-top: 10px;"><strong>Faltante: $${missingAmount.toFixed(2)}</strong></p>
                <p style="margin-top: 10px;">
                  El cliente tiene crédito disponible (Límite: $${client.creditLimit.toFixed(2)}, Pendiente: $${currentPending.toFixed(2)}, Disponible: $${availableCredit.toFixed(2)})
                </p>
                <p style="margin-top: 10px; color: #059669; font-weight: 600;">
                  ¿Desea finalizar la venta y registrar el faltante como crédito?
                </p>
              `,
              icon: "question",
              showCancelButton: true,
              confirmButtonText: "Sí, usar crédito",
              cancelButtonText: "Cancelar",
              confirmButtonColor: "#059669",
              cancelButtonColor: "#6b7280",
              focusConfirm: false,
              returnFocus: false,
            });

            if (useCredit) {
              // Finalizar con crédito
              Swal.fire({
                title: "✅ Venta con crédito",
                html: `
                  <p>La venta se completará con:</p>
                  <p style="margin-top: 10px;">
                    💵 Pagado: <strong>$${finalAmount.toFixed(2)}</strong><br/>
                    💳 A crédito: <strong>$${missingAmount.toFixed(2)}</strong>
                  </p>
                `,
                icon: "success",
                timer: 3000,
                showConfirmButton: false,
              });

              onConfirm({
                paymentType,
                amountReceived: finalAmount,
                change: 0,
                creditAmount: missingAmount,
                containersDepositInfo: containersDepositInfo || null,
              });
              return;
            } else {
              // El usuario canceló, volver al input
              setTimeout(() => {
                if (inputRef.current) {
                  inputRef.current.focus();
                  inputRef.current.select();
                }
              }, 10);
              return;
            }
          } else {
            // El faltante excede el crédito disponible
            Swal.fire({
              title: "❌ Crédito insuficiente",
              html: `
                <p>El monto recibido ($${finalAmount.toFixed(2)}) es menor al total ($${totalNumber.toFixed(2)}).</p>
                <p style="margin-top: 10px;"><strong>Faltante: $${missingAmount.toFixed(2)}</strong></p>
                <p style="margin-top: 10px; color: #dc2626;">
                  El faltante ($${missingAmount.toFixed(2)}) excede el crédito disponible ($${availableCredit.toFixed(2)}).
                </p>
                <p style="margin-top: 10px;">
                  Límite de crédito: $${client.creditLimit.toFixed(2)}<br/>
                  Crédito pendiente: $${currentPending.toFixed(2)}<br/>
                  Crédito disponible: $${availableCredit.toFixed(2)}
                </p>
              `,
              icon: "error",
              confirmButtonText: "Entendido",
              confirmButtonColor: "#dc2626",
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
        } catch (error) {
          console.error("Error al obtener créditos del cliente:", error);
          // Si hay error, mostrar mensaje normal
        }
      }
      
      // Si no tiene crédito o hubo error, mostrar mensaje normal
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
      containersDepositInfo: containersDepositInfo || null,
    });
  }, [paymentType, amountReceived, totalNumber, received, change, onConfirm, cashReceived, cardReceived, totalMixed, client]);

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
        // Ciclar entre efectivo -> tarjeta -> mixto -> regalo -> efectivo
        setPaymentType((prev) => {
          if (prev === "efectivo") return "tarjeta";
          if (prev === "tarjeta") return "mixto";
          if (prev === "mixto") return "regalo";
          return "efectivo";
        });
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

        {containersDepositInfo && containersDepositInfo.total > 0 && (
          <div className="containers-deposit-section" style={{
            background: "#f0fdf4",
            border: "2px solid #059669",
            borderRadius: "8px",
            padding: "1rem",
            marginBottom: "1rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "1.5rem" }}>🍺</span>
              <strong style={{ fontSize: "1rem", color: "#059669" }}>Depósito de Envases</strong>
            </div>
            <div style={{ marginBottom: "0.5rem" }}>
              {containersDepositInfo.details.map((detail, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "0.25rem 0", fontSize: "0.9rem" }}>
                  <span>{detail.name} ({detail.quantity})</span>
                  <strong>${detail.amount.toFixed(2)}</strong>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "0.5rem", borderTop: "1px solid #059669", fontWeight: "600" }}>
              <span>Total envases:</span>
              <strong style={{ color: "#059669" }}>${containersDepositInfo.total.toFixed(2)}</strong>
            </div>
          </div>
        )}

        {/* Solo mostrar subtotal si hay depósito de envases */}
        {containersDepositInfo && containersDepositInfo.total > 0 && (
          <>
            <div className="total-section">
              <p>Subtotal productos:</p>
              <p style={{ fontSize: "1.2rem", color: "#6b7280" }}>${total.toFixed(2)}</p>
            </div>
            <div className="total-section">
              <p>Depósito envases:</p>
              <p style={{ fontSize: "1.2rem", color: "#059669" }}>+${containersDepositInfo.total.toFixed(2)}</p>
            </div>
          </>
        )}
        <div className="total-section" style={{ borderTop: containersDepositInfo && containersDepositInfo.total > 0 ? "2px solid #1f2937" : "none", paddingTop: containersDepositInfo && containersDepositInfo.total > 0 ? "0.5rem" : "0", marginTop: containersDepositInfo && containersDepositInfo.total > 0 ? "0.5rem" : "0" }}>
          <p style={{ fontSize: "1.1rem", fontWeight: "600" }}>Total a cobrar:</p>
          <h1 style={{ fontSize: "2rem", color: "#059669" }}>${totalNumber.toFixed(2)}</h1>
        </div>

        <div className="payment-options" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px" }}>
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
          <button
            className={`payment-btn ${paymentType === "mixto" ? "active" : ""}`}
            onClick={() => setPaymentType("mixto")}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <div style={{ display: "flex", gap: "5px" }}>
              <FaMoneyBillWave size={20} />
              <FaCreditCard size={20} />
            </div>
            Mixto
          </button>
          <button
            className={`payment-btn ${paymentType === "regalo" ? "active" : ""}`}
            onClick={() => setPaymentType("regalo")}
            style={{
              backgroundColor: paymentType === "regalo" ? "#aeae40" : "#f3f4f6",
              borderColor: paymentType === "regalo" ? "#f59e0b" : "#d1d5db",
            }}
          >
            <FaGift size={30} />
            Regalo
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

        {paymentType === "mixto" && (
          <div className="input-section">
            {/*<label style={{ marginBottom: "15px", display: "block", fontWeight: "600" }}>
              Desglose de Pago Mixto:
            </label> */}

            {/* Efectivo */}
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem" }}>
                💵 Monto en Efectivo:
              </label>
              <div className="bills-grid" style={{ marginBottom: "10px" }}>
                {bills.map((b) => (
                  <button
                    key={b}
                    className="bill-btn"
                    onClick={() => {
                      const newAmount = (parseFloat(cashAmount || "0") + b).toString();
                      setCashAmount(newAmount);
                    }}
                  >
                    ${b}
                  </button>
                ))}
              </div>
              <div className="input-wrapper">
                <input
                  ref={cashInputRef}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Tab" && !e.shiftKey) {
                      e.preventDefault();
                      cardInputRef.current?.focus();
                    }
                  }}
                />
                {cashAmount.length > 0 && (
                  <button
                    className="clear-btn-payment"
                    onClick={() => {
                      setCashAmount("");
                      cashInputRef.current?.focus();
                    }}
                  >
                    ❌
                  </button>
                )}
              </div>
            </div>

            {/* Tarjeta */}
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem" }}>
                💳 Monto en Tarjeta:
              </label>
              <div className="input-wrapper">
                <input
                  ref={cardInputRef}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={cardAmount}
                  onChange={(e) => setCardAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Tab" && e.shiftKey) {
                      e.preventDefault();
                      cashInputRef.current?.focus();
                    }
                  }}
                />
                {cardAmount.length > 0 && (
                  <button
                    className="clear-btn-payment"
                    onClick={() => {
                      setCardAmount("");
                      cardInputRef.current?.focus();
                    }}
                  >
                    ❌
                  </button>
                )}
              </div>
            </div>

            {/* Resumen */}
            <div style={{
              padding: "12px",
              backgroundColor: totalMixed === totalNumber ? "#d1fae5" : "#fee2e2",
              borderRadius: "8px",
              border: `2px solid ${totalMixed === totalNumber ? "#059669" : "#dc2626"}`,
              marginTop: "10px"
            }}>
              {/*<div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.9rem" }}>Efectivo:</span>
                <strong style={{ color: "#059669" }}>${cashReceived.toFixed(2)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.9rem" }}>Tarjeta:</span>
                <strong style={{ color: "#3b82f6" }}>${cardReceived.toFixed(2)}</strong>
              </div>
               <hr style={{ margin: "8px 0", borderColor: "#d1d5db" }} />*/}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "1rem", fontWeight: "600" }}>Total:</span>
                <strong style={{ 
                  fontSize: "1.1rem",
                  color: totalMixed === totalNumber ? "#059669" : "#dc2626"
                }}>
                  ${totalMixed.toFixed(2)} / ${totalNumber.toFixed(2)}
                </strong>
              </div>
              {totalMixed !== totalNumber && (
                <p style={{ 
                  margin: "8px 0 0 0", 
                  fontSize: "0.85rem", 
                  color: "#dc2626",
                  textAlign: "center"
                }}>
                  {totalMixed < totalNumber 
                    ? `Faltan $${(totalNumber - totalMixed).toFixed(2)}`
                    : `Sobran $${(totalMixed - totalNumber).toFixed(2)}`
                  }
                </p>
              )}
            </div>
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
