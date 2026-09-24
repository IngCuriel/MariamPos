import { useState, useEffect, useRef, useCallback } from "react";
import { FaMoneyBillWave, FaCreditCard, FaGift } from "react-icons/fa";
import { IoCloseCircleOutline } from "react-icons/io5";
import Swal from "sweetalert2";
import { createRoot } from "react-dom/client";
import type { ConfirmPaymentData } from "../../types/index";
import { getClientCreditSummary } from "../../api/credits";
import TouchCalculator from "../../components/TouchCalculator";
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

const PaymentModal: React.FC<PaymentModalProps> = ({ total, client, containersDepositInfo, onClose, onConfirm }) => {
  const [paymentType, setPaymentType] = useState("efectivo");
  const [amountReceived, setAmountReceived] = useState<string>("");
  const [cashAmount, setCashAmount] = useState<string>("");
  const [cardAmount, setCardAmount] = useState<string>("");
  const [paymentReference, setPaymentReference] = useState<string>(""); // Folio/ref comprobante tarjeta
  const inputRef = useRef<HTMLInputElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);
  const cardInputRef = useRef<HTMLInputElement>(null);

  // Función para mostrar la calculadora táctil
  const showTouchCalculator = (
    currentValue: string,
    label: string,
    onConfirm: (value: string) => void
  ) => {
    const container = document.createElement("div");
    container.id = "touch-calculator-container";
    document.body.appendChild(container);
    const root = createRoot(container);

    const handleClose = () => {
      root.unmount();
      document.body.removeChild(container);
    };

    root.render(
      <TouchCalculator
        initialValue={currentValue}
        label={label}
        onConfirm={(value) => {
          onConfirm(value);
          handleClose();
        }}
        onClose={handleClose}
      />
    );
  };

  // Calcular total incluyendo depósito de envases
  const containersTotal = containersDepositInfo?.total || 0;
  const totalNumber = total + containersTotal;
  const received = parseFloat(amountReceived || "0");
  const cashReceived = parseFloat(cashAmount || "0");
  const cardReceived = parseFloat(cardAmount || "0");
  const change = paymentType === "efectivo" ? Math.max(received - totalNumber, 0) : 0;
  const totalMixed = cashReceived + cardReceived;

  useEffect(() => {
    const attemptFocus = (ref: React.RefObject<HTMLInputElement | null>) => {
      if (ref.current && ref.current.offsetParent !== null) { // Verificar que el elemento esté visible
        ref.current.focus();
        ref.current.select();
        if (document.activeElement !== ref.current) {
          // Si el focus falló, intentar de nuevo con un pequeño delay
          setTimeout(() => {
            ref.current?.focus();
            ref.current?.select();
          }, 50);
        }
        return true;
      }
      return false;
    };

    const focusOnOpen = () => {
      if (paymentType === "efectivo") {
        if (!attemptFocus(inputRef)) {
          requestAnimationFrame(() => setTimeout(() => attemptFocus(inputRef), 100));
        }
      } else if (paymentType === "mixto") {
        if (!attemptFocus(cashInputRef)) {
          requestAnimationFrame(() => setTimeout(() => attemptFocus(cashInputRef), 100));
        }
      }
    };

    // Intentar enfocar después de un pequeño delay para asegurar que el modal esté completamente renderizado
    const timeoutId = setTimeout(focusOnOpen, 100);
    const rafId = requestAnimationFrame(() => setTimeout(focusOnOpen, 200));
    const anotherTimeoutId = setTimeout(focusOnOpen, 300);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(anotherTimeoutId);
      cancelAnimationFrame(rafId);
    };
  }, [paymentType, containersDepositInfo]); // Agregar containersDepositInfo a las dependencias

  // Limpiar campos cuando cambia el tipo de pago
  useEffect(() => {
    if (paymentType === "mixto") {
      setAmountReceived("");
      // Si hay importe de envases, inicializar el efectivo con el mínimo requerido
      if (containersDepositInfo && containersDepositInfo.total > 0) {
        setCashAmount(containersDepositInfo.total.toFixed(2));
      } else {
        setCashAmount("");
      }
    } else if (paymentType === "regalo") {
      setAmountReceived("");
      setCashAmount("");
      setCardAmount("");
    } else {
      setCashAmount("");
      setCardAmount("");
    }
    // La referencia de comprobante solo aplica a tarjeta/mixto; limpiar en los demás.
    if (paymentType === "efectivo" || paymentType === "regalo") {
      setPaymentReference("");
    }
  }, [paymentType, containersDepositInfo]);

  // Si hay importe de envases, solo permitir efectivo o mixto
  useEffect(() => {
    if (containersDepositInfo && containersDepositInfo.total > 0) {
      if (paymentType === "tarjeta" || paymentType === "regalo") {
        // Cambiar automáticamente a efectivo si se intenta usar tarjeta o regalo
        setPaymentType("efectivo");
        Swal.fire({
          icon: "info",
          title: "💵 Pago de Envases",
          html: `
            <p>El importe de envases ($${containersDepositInfo.total.toFixed(2)}) debe pagarse en <strong>efectivo</strong>.</p>
            <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #6b7280;">
              Puede pagar los productos con tarjeta usando la opción "Mixto", pero el depósito de envases siempre debe ser en efectivo.
            </p>
          `,
          confirmButtonText: "Entendido",
          confirmButtonColor: "#059669",
          timer: 4000,
        });
      }
    }
  }, [containersDepositInfo, paymentType]);

  const handleConfirm = useCallback(async () => {
    // Validar que si hay importe de envases, se pague en efectivo
    if (containersDepositInfo && containersDepositInfo.total > 0) {
      if (paymentType === "tarjeta") {
        Swal.fire({
          icon: "warning",
          title: "💵 Pago de Envases Requerido",
          html: `
            <p>El importe de envases ($${containersDepositInfo.total.toFixed(2)}) debe pagarse en <strong>efectivo</strong>.</p>
            <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #6b7280;">
              Puede pagar los productos ($${total.toFixed(2)}) con tarjeta usando la opción "Mixto", pero el depósito de envases siempre debe ser en efectivo.
            </p>
          `,
          confirmButtonText: "Entendido",
          confirmButtonColor: "#059669",
        });
        return;
      }

      if (paymentType === "regalo") {
        Swal.fire({
          icon: "warning",
          title: "💵 Pago de Envases Requerido",
          html: `
            <p>El importe de envases ($${containersDepositInfo.total.toFixed(2)}) debe pagarse en <strong>efectivo</strong>.</p>
            <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #6b7280;">
              No se puede registrar como regalo cuando hay depósito de envases.
            </p>
          `,
          confirmButtonText: "Entendido",
          confirmButtonColor: "#059669",
        });
        return;
      }
    }

    if (paymentType === "mixto") {
      // Calcular efectivo para productos (efectivo total - envases)
      const cashForProducts = containersDepositInfo && containersDepositInfo.total > 0
        ? Math.max(0, cashReceived - containersDepositInfo.total)
        : cashReceived;
      
      // Total para productos (efectivo para productos + tarjeta)
      const totalForProducts = cashForProducts + cardReceived;
      
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

      // Validar que el total para productos sea igual al total de productos
      if (Math.abs(totalForProducts - total) > 0.01) {
        Swal.fire({
          title: "💵 Monto incorrecto",
          html: `
            <p>La suma de pagos para productos no coincide:</p>
            <p style="margin-top: 0.5rem;">
              ${containersDepositInfo && containersDepositInfo.total > 0 
                ? `🍺 Efectivo para envases: <strong>$${containersDepositInfo.total.toFixed(2)}</strong><br/>` 
                : ''}
              💰 Efectivo para productos: <strong>$${cashForProducts.toFixed(2)}</strong><br/>
              💳 Tarjeta: <strong>$${cardReceived.toFixed(2)}</strong><br/>
              <span style="color: #dc2626;">Total productos: <strong>$${totalForProducts.toFixed(2)}</strong></span><br/>
              <span style="color: #059669;">Total requerido: <strong>$${total.toFixed(2)}</strong></span>
            </p>
          `,
          icon: "warning",
          confirmButtonText: "Entendido",
          confirmButtonColor: "#3085d6",
        });
        return;
      }

      // Validar que el total mixto (efectivo + tarjeta) sea igual al totalNumber (productos + envases)
      if (Math.abs(totalMixed - totalNumber) > 0.01) {
        Swal.fire({
          title: "💵 Monto total incorrecto",
          html: `
            <p>La suma total no coincide:</p>
            <p style="margin-top: 0.5rem;">
              💵 Efectivo total: <strong>$${cashReceived.toFixed(2)}</strong><br/>
              💳 Tarjeta: <strong>$${cardReceived.toFixed(2)}</strong><br/>
              <span style="color: #dc2626;">Suma: <strong>$${totalMixed.toFixed(2)}</strong></span><br/>
              <span style="color: #059669;">Total requerido: <strong>$${totalNumber.toFixed(2)}</strong></span>
            </p>
          `,
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

      // Si hay importe de envases, validar que el efectivo cubra al menos el importe de envases
      if (containersDepositInfo && containersDepositInfo.total > 0) {
        if (cashReceived < containersDepositInfo.total) {
          Swal.fire({
            icon: "warning",
            title: "💵 Efectivo Insuficiente para Envases",
            html: `
              <p>El importe de envases ($${containersDepositInfo.total.toFixed(2)}) debe pagarse completamente en <strong>efectivo</strong>.</p>
              <p style="margin-top: 0.5rem;">
                Efectivo ingresado: <strong>$${cashReceived.toFixed(2)}</strong><br/>
                Requerido para envases: <strong style="color: #dc2626;">$${containersDepositInfo.total.toFixed(2)}</strong>
              </p>
              <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #6b7280;">
                Puede pagar los productos ($${total.toFixed(2)}) con tarjeta, pero el depósito de envases siempre debe ser en efectivo.
              </p>
            `,
            confirmButtonText: "Entendido",
            confirmButtonColor: "#059669",
          });
          return;
        }
      }

      // Calcular efectivo para productos (efectivo total - envases)
      const cashForProductsFinal = containersDepositInfo && containersDepositInfo.total > 0
        ? Math.max(0, cashReceived - containersDepositInfo.total)
        : cashReceived;

      Swal.fire({
        title: "✅ Cobro exitoso",
        html: `
          <p>Pago mixto registrado correctamente:</p>
          <p style="margin-top: 10px;">
            ${containersDepositInfo && containersDepositInfo.total > 0 
              ? `🍺 Efectivo para envases: <strong>$${containersDepositInfo.total.toFixed(2)}</strong><br/>` 
              : ''}
            💰 Efectivo para productos: <strong>$${cashForProductsFinal.toFixed(2)}</strong><br/>
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
        cashAmount: cashForProductsFinal, // Solo efectivo para productos (sin envases)
        cardAmount: cardReceived,
        paymentReference: paymentReference.trim() || undefined,
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
      paymentReference: paymentType === "tarjeta" ? paymentReference.trim() || undefined : undefined,
      containersDepositInfo: containersDepositInfo || null,
    });
  }, [paymentType, amountReceived, totalNumber, received, change, onConfirm, cashReceived, cardReceived, totalMixed, client, paymentReference]);

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
        // Si hay envases, saltar tarjeta y regalo
        setPaymentType((prev) => {
          if (containersDepositInfo && containersDepositInfo.total > 0) {
            // Con envases: solo efectivo y mixto
            if (prev === "efectivo") return "mixto";
            return "efectivo";
          } else {
            // Sin envases: todos los métodos
            if (prev === "efectivo") return "tarjeta";
            if (prev === "tarjeta") return "mixto";
            if (prev === "mixto") return "regalo";
            return "efectivo";
          }
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleConfirm, onClose]);

  const hasContainersDeposit = containersDepositInfo && containersDepositInfo.total > 0;

  return (
    <div className="modal-overlay">
      <div 
        className={`modal-container ${hasContainersDeposit ? 'payment-with-containers' : ''}`}
        style={hasContainersDeposit ? { maxWidth: "1200px", width: "95%" } : {}}
      >
        <button className="close-btn" onClick={onClose}>
          <IoCloseCircleOutline size={32} />
        </button>

        <h2 className="modal-title">💰 Cobrar Venta</h2>

        {hasContainersDeposit ? (
          <div className="payment-two-columns" style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1.5rem",
            marginBottom: "1.5rem",
          }}>
            {/* Columna izquierda: Depósito de Envases + Totales */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="containers-deposit-section" style={{
                background: "#f0fdf4",
                border: "2px solid #059669",
                borderRadius: "8px",
                padding: "1rem",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <span style={{ fontSize: "1.5rem" }}>🍺</span>
                  <strong style={{ fontSize: "1rem", color: "#059669" }}>Depósito de Envases</strong>
                </div>
                <div style={{ marginBottom: "0.5rem" }}>
                  {containersDepositInfo.details.map((detail, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "0.25rem 0", fontSize: "0.9rem" }}>
                      <span> {detail.quantity} - {detail.name} -Precio unitario: ${(detail.amount/detail.quantity).toFixed(2)}</span>
                      <strong>${detail.amount.toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "0.5rem", borderTop: "1px solid #059669", fontWeight: "600" }}>
                  <span>Total envases:</span>
                  <strong style={{ color: "#059669" }}>${containersDepositInfo.total.toFixed(2)}</strong>
                </div>
              </div>

              {/* Totales de la venta */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div className="total-section">
                  <p>Subtotal productos:</p>
                  <p style={{ fontSize: "1.2rem", color: "#6b7280" }}>${total.toFixed(2)}</p>
                </div>
                <div className="total-section">
                  <p>Depósito envases:</p>
                  <p style={{ fontSize: "1.2rem", color: "#059669" }}>+${containersDepositInfo.total.toFixed(2)}</p>
                </div>
                <div className="total-section" style={{ borderTop: "2px solid #1f2937", paddingTop: "0.5rem", marginTop: "0.5rem" }}>
                  <p style={{ fontSize: "1.1rem", fontWeight: "600" }}>Total a cobrar:</p>
                  <h1 style={{ fontSize: "2rem", color: "#059669" }}>${totalNumber.toFixed(2)}</h1>
                </div>
              </div>
            </div>

            {/* Columna derecha: Métodos de pago + Inputs */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
            onClick={() => {
              if (containersDepositInfo && containersDepositInfo.total > 0) {
                Swal.fire({
                  icon: "info",
                  title: "💵 Pago de Envases",
                  html: `
                    <p>El importe de envases ($${containersDepositInfo.total.toFixed(2)}) debe pagarse en <strong>efectivo</strong>.</p>
                    <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #6b7280;">
                      Use la opción "Mixto" para pagar productos con tarjeta y envases en efectivo.
                    </p>
                  `,
                  confirmButtonText: "Entendido",
                  confirmButtonColor: "#059669",
                });
              } else {
                setPaymentType("tarjeta");
              }
            }}
            disabled={!!(containersDepositInfo && containersDepositInfo.total > 0)}
            style={{
              opacity: containersDepositInfo && containersDepositInfo.total > 0 ? 0.5 : 1,
              cursor: containersDepositInfo && containersDepositInfo.total > 0 ? "not-allowed" : "pointer",
            }}
            title={containersDepositInfo && containersDepositInfo.total > 0 ? "El importe de envases debe pagarse en efectivo" : ""}
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
            onClick={() => {
              if (containersDepositInfo && containersDepositInfo.total > 0) {
                Swal.fire({
                  icon: "warning",
                  title: "💵 Pago de Envases",
                  html: `
                    <p>El importe de envases ($${containersDepositInfo.total.toFixed(2)}) debe pagarse en <strong>efectivo</strong>.</p>
                    <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #6b7280;">
                      No se puede registrar como regalo cuando hay depósito de envases.
                    </p>
                  `,
                  confirmButtonText: "Entendido",
                  confirmButtonColor: "#059669",
                });
              } else {
                setPaymentType("regalo");
              }
            }}
            disabled={!!(containersDepositInfo && containersDepositInfo.total > 0)}
            style={{
              backgroundColor: paymentType === "regalo" ? "#aeae40" : "#f3f4f6",
              borderColor: paymentType === "regalo" ? "#f59e0b" : "#d1d5db",
              opacity: containersDepositInfo && containersDepositInfo.total > 0 ? 0.5 : 1,
              cursor: containersDepositInfo && containersDepositInfo.total > 0 ? "not-allowed" : "pointer",
            }}
            title={containersDepositInfo && containersDepositInfo.total > 0 ? "No disponible cuando hay depósito de envases" : ""}
          >
            <FaGift size={30} />
            Regalo
          </button>
              </div>

              {paymentType === "efectivo" && (
          <div className="input-section">
            <label>Monto recibido:</label>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div className="input-wrapper" style={{ flex: 1 }}>
                <input
                  ref={inputRef}
                  type="number"
                  placeholder="0.00"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  style={{ paddingRight: amountReceived.length > 0 ? '35px' : '10px' }}
                />
                {amountReceived.length > 0 && (
                  <button
                    className="clear-btn-payment"
                    onClick={() => {
                      setAmountReceived("");
                      inputRef.current?.focus();
                    }}
                    title="Limpiar"
                  >
                    ❌
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  const currentValue = amountReceived.replace(/,/g, '') || '0';
                  showTouchCalculator(currentValue, '💰 Monto Recibido', (newValue) => {
                    setAmountReceived(newValue);
                    if (inputRef.current) {
                      inputRef.current.focus();
                      inputRef.current.select();
                    }
                  });
                }}
                title="Abrir calculadora táctil"
                style={{
                  padding: "12px 16px",
                  fontSize: "1.5rem",
                  backgroundColor: "#f3f4f6",
                  border: "2px solid #d1d5db",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#e5e7eb";
                  e.currentTarget.style.borderColor = "#9ca3af";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#f3f4f6";
                  e.currentTarget.style.borderColor = "#d1d5db";
                }}
              >
                🧮
              </button>
            </div>
            <p className="change-text">Cambio: ${change.toFixed(2)}</p>
              </div>
              )}

              {paymentType === "mixto" && (
          <div className="input-section">
            {containersDepositInfo && containersDepositInfo.total > 0 && (
              <div style={{
                marginBottom: "15px",
                padding: "0.75rem",
                backgroundColor: "#fef3c7",
                border: "1px solid #f59e0b",
                borderRadius: "4px",
              }}>
                <p style={{ fontSize: "0.85rem", color: "#92400e", margin: 0 }}>
                  <strong>⚠️ Importante:</strong> El importe de envases (${containersDepositInfo.total.toFixed(2)}) debe pagarse en efectivo.
                  <br />
                  Mínimo requerido en efectivo: <strong>${containersDepositInfo.total.toFixed(2)}</strong>
                </p>
              </div>
            )}

            {/* Efectivo */}
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem" }}>
                💵 Monto en Efectivo:
                {containersDepositInfo && containersDepositInfo.total > 0 && (
                  <span style={{ color: "#dc2626", fontSize: "0.85rem", marginLeft: "0.5rem" }}>
                    (Mínimo: ${containersDepositInfo.total.toFixed(2)})
                  </span>
                )}
              </label>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <div className="input-wrapper" style={{ flex: 1 }}>
                  <input
                    ref={cashInputRef}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={containersDepositInfo && containersDepositInfo.total > 0 ? `Mínimo: ${containersDepositInfo.total.toFixed(2)}` : "0.00"}
                    value={cashAmount}
                    onChange={(e) => {
                      // Permitir cualquier valor mientras se escribe (validación al confirmar)
                      setCashAmount(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Tab" && !e.shiftKey) {
                        e.preventDefault();
                        cardInputRef.current?.focus();
                      }
                    }}
                    onWheel={(e) => e.currentTarget.blur()}
                    style={{ paddingRight: cashAmount.length > 0 ? '35px' : '10px' }}
                  />
                  {cashAmount.length > 0 && (
                    <button
                      className="clear-btn-payment"
                      onClick={() => {
                        setCashAmount("");
                        cashInputRef.current?.focus();
                      }}
                      title="Limpiar"
                    >
                      ❌
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const currentValue = cashAmount.replace(/,/g, '') || '0';
                    showTouchCalculator(currentValue, '💰 Monto en Efectivo', (newValue) => {
                      setCashAmount(newValue);
                      if (cashInputRef.current) {
                        cashInputRef.current.focus();
                        cashInputRef.current.select();
                      }
                    });
                  }}
                  title="Abrir calculadora táctil"
                  style={{
                    padding: "12px 16px",
                    fontSize: "1.5rem",
                    backgroundColor: "#f3f4f6",
                    border: "2px solid #d1d5db",
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#e5e7eb";
                    e.currentTarget.style.borderColor = "#9ca3af";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#f3f4f6";
                    e.currentTarget.style.borderColor = "#d1d5db";
                  }}
                >
                  🧮
                </button>
              </div>
              {/* Desglose del efectivo cuando hay envases */}
              {containersDepositInfo && containersDepositInfo.total > 0 && (
                <div style={{
                  marginTop: "0.5rem",
                  padding: "0.5rem",
                  backgroundColor: cashReceived >= containersDepositInfo.total ? "#f0fdf4" : "#fef3c7",
                  border: `1px solid ${cashReceived >= containersDepositInfo.total ? "#059669" : "#f59e0b"}`,
                  borderRadius: "4px",
                  fontSize: "0.85rem",
                }}>
                  {cashReceived >= containersDepositInfo.total ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                        <span style={{ color: "#065f46" }}>🍺 Efectivo para envases:</span>
                        <strong style={{ color: "#059669" }}>${containersDepositInfo.total.toFixed(2)}</strong>
                      </div>
                      {cashReceived > containersDepositInfo.total && (
                        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "0.25rem", borderTop: "1px solid #059669" }}>
                          <span style={{ color: "#065f46" }}>💰 Efectivo para productos:</span>
                          <strong style={{ color: "#059669" }}>${(cashReceived - containersDepositInfo.total).toFixed(2)}</strong>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "0.25rem", borderTop: "1px solid #059669", marginTop: "0.25rem", fontWeight: "600" }}>
                        <span style={{ color: "#065f46" }}>Total efectivo:</span>
                        <strong style={{ color: "#059669" }}>${cashReceived.toFixed(2)}</strong>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: "#92400e" }}>
                      <strong>⚠️ Efectivo insuficiente:</strong> Se requiere al menos ${containersDepositInfo.total.toFixed(2)} para envases.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tarjeta */}
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem" }}>
                💳 Monto en Tarjeta:
                {containersDepositInfo && containersDepositInfo.total > 0 && (
                  <span style={{ color: "#6b7280", fontSize: "0.85rem", marginLeft: "0.5rem" }}>
                    (Máximo: ${total.toFixed(2)} - solo productos)
                  </span>
                )}
              </label>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <div className="input-wrapper" style={{ flex: 1 }}>
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
                    onWheel={(e) => e.currentTarget.blur()}
                    style={{ paddingRight: cardAmount.length > 0 ? '35px' : '10px' }}
                  />
                  {cardAmount.length > 0 && (
                    <button
                      className="clear-btn-payment"
                      onClick={() => {
                        setCardAmount("");
                        cardInputRef.current?.focus();
                      }}
                      title="Limpiar"
                    >
                      ❌
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const currentValue = cardAmount.replace(/,/g, '') || '0';
                    showTouchCalculator(currentValue, '💰 Monto en Tarjeta', (newValue) => {
                      setCardAmount(newValue);
                      if (cardInputRef.current) {
                        cardInputRef.current.focus();
                        cardInputRef.current.select();
                      }
                    });
                  }}
                  title="Abrir calculadora táctil"
                  style={{
                    padding: "12px 16px",
                    fontSize: "1.5rem",
                    backgroundColor: "#f3f4f6",
                    border: "2px solid #d1d5db",
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#e5e7eb";
                    e.currentTarget.style.borderColor = "#9ca3af";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#f3f4f6";
                    e.currentTarget.style.borderColor = "#d1d5db";
                  }}
                >
                  🧮
                </button>
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
            </div>
          </div>
        ) : (
          <>
            <div className="total-section" style={{ marginBottom: "1rem" }}>
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
                onClick={() => {
                  if (containersDepositInfo && containersDepositInfo.total > 0) {
                    Swal.fire({
                      icon: "info",
                      title: "💵 Pago de Envases",
                      html: `
                        <p>El importe de envases ($${containersDepositInfo.total.toFixed(2)}) debe pagarse en <strong>efectivo</strong>.</p>
                        <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #6b7280;">
                          Use la opción "Mixto" para pagar productos con tarjeta y envases en efectivo.
                        </p>
                      `,
                      confirmButtonText: "Entendido",
                      confirmButtonColor: "#059669",
                    });
                  } else {
                    setPaymentType("tarjeta");
                  }
                }}
                disabled={!!(containersDepositInfo && containersDepositInfo.total > 0)}
                style={{
                  opacity: containersDepositInfo && containersDepositInfo.total > 0 ? 0.5 : 1,
                  cursor: containersDepositInfo && containersDepositInfo.total > 0 ? "not-allowed" : "pointer",
                }}
                title={containersDepositInfo && containersDepositInfo.total > 0 ? "El importe de envases debe pagarse en efectivo" : ""}
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
                onClick={() => {
                  if (containersDepositInfo && containersDepositInfo.total > 0) {
                    Swal.fire({
                      icon: "warning",
                      title: "💵 Pago de Envases",
                      html: `
                        <p>El importe de envases ($${containersDepositInfo.total.toFixed(2)}) debe pagarse en <strong>efectivo</strong>.</p>
                        <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #6b7280;">
                          No se puede registrar como regalo cuando hay depósito de envases.
                        </p>
                      `,
                      confirmButtonText: "Entendido",
                      confirmButtonColor: "#059669",
                    });
                  } else {
                    setPaymentType("regalo");
                  }
                }}
                disabled={!!(containersDepositInfo && containersDepositInfo.total > 0)}
                style={{
                  backgroundColor: paymentType === "regalo" ? "#aeae40" : "#f3f4f6",
                  borderColor: paymentType === "regalo" ? "#f59e0b" : "#d1d5db",
                  opacity: containersDepositInfo && containersDepositInfo.total > 0 ? 0.5 : 1,
                  cursor: containersDepositInfo && containersDepositInfo.total > 0 ? "not-allowed" : "pointer",
                }}
                title={containersDepositInfo && containersDepositInfo.total > 0 ? "No disponible cuando hay depósito de envases" : ""}
              >
                <FaGift size={30} />
                Regalo
              </button>
            </div>

            {paymentType === "tarjeta" && (
              <div className="input-section">
                <label>Folio / referencia del comprobante (opcional):</label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    placeholder="Ej: 004521, últimos 4 dígitos, autorización..."
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    maxLength={60}
                  />
                </div>
              </div>
            )}

            {paymentType === "efectivo" && (
              <div className="input-section">
                <label>Monto recibido:</label>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <div className="input-wrapper" style={{ flex: 1 }}>
                    <input
                      ref={inputRef}
                      type="number"
                      placeholder="0.00"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      style={{ paddingRight: amountReceived.length > 0 ? '35px' : '10px' }}
                    />
                    {amountReceived.length > 0 && (
                      <button
                        className="clear-btn-payment"
                        onClick={() => {
                          setAmountReceived("");
                          inputRef.current?.focus();
                        }}
                        title="Limpiar"
                      >
                        ❌
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const currentValue = amountReceived.replace(/,/g, '') || '0';
                      showTouchCalculator(currentValue, '💰 Monto Recibido', (newValue) => {
                        setAmountReceived(newValue);
                        if (inputRef.current) {
                          inputRef.current.focus();
                          inputRef.current.select();
                        }
                      });
                    }}
                    title="Abrir calculadora táctil"
                    style={{
                      padding: "12px 16px",
                      fontSize: "1.5rem",
                      backgroundColor: "#f3f4f6",
                      border: "2px solid #d1d5db",
                      borderRadius: "8px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#e5e7eb";
                      e.currentTarget.style.borderColor = "#9ca3af";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#f3f4f6";
                      e.currentTarget.style.borderColor = "#d1d5db";
                    }}
                  >
                    🧮
                  </button>
                </div>
                <p className="change-text">Cambio: ${change.toFixed(2)}</p>
              </div>
            )}

            {paymentType === "mixto" && (
              <div className="input-section">
                {containersDepositInfo && containersDepositInfo.total > 0 && (
                  <div style={{
                    marginBottom: "15px",
                    padding: "0.75rem",
                    backgroundColor: "#fef3c7",
                    border: "1px solid #f59e0b",
                    borderRadius: "4px",
                  }}>
                    <p style={{ fontSize: "0.85rem", color: "#92400e", margin: 0 }}>
                      <strong>⚠️ Importante:</strong> El importe de envases (${containersDepositInfo.total.toFixed(2)}) debe pagarse en efectivo.
                      <br />
                      Mínimo requerido en efectivo: <strong>${containersDepositInfo.total.toFixed(2)}</strong>
                    </p>
                  </div>
                )}

                {/* Efectivo */}
                <div style={{ marginBottom: "15px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem" }}>
                    💵 Monto en Efectivo:
                    {containersDepositInfo && containersDepositInfo.total > 0 && (
                      <span style={{ color: "#dc2626", fontSize: "0.85rem", marginLeft: "0.5rem" }}>
                        (Mínimo: ${containersDepositInfo.total.toFixed(2)})
                      </span>
                    )}
                  </label>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <div className="input-wrapper" style={{ flex: 1 }}>
                      <input
                        ref={cashInputRef}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={containersDepositInfo && containersDepositInfo.total > 0 ? `Mínimo: ${containersDepositInfo.total.toFixed(2)}` : "0.00"}
                        value={cashAmount}
                        onChange={(e) => {
                          // Permitir cualquier valor mientras se escribe (validación al confirmar)
                          setCashAmount(e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Tab" && !e.shiftKey) {
                            e.preventDefault();
                            cardInputRef.current?.focus();
                          }
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        style={{ paddingRight: cashAmount.length > 0 ? '35px' : '10px' }}
                      />
                      {cashAmount.length > 0 && (
                        <button
                          className="clear-btn-payment"
                          onClick={() => {
                            setCashAmount("");
                            cashInputRef.current?.focus();
                          }}
                          title="Limpiar"
                        >
                          ❌
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const currentValue = cashAmount.replace(/,/g, '') || '0';
                        showTouchCalculator(currentValue, '💰 Monto en Efectivo', (newValue) => {
                          setCashAmount(newValue);
                          if (cashInputRef.current) {
                            cashInputRef.current.focus();
                            cashInputRef.current.select();
                          }
                        });
                      }}
                      title="Abrir calculadora táctil"
                      style={{
                        padding: "12px 16px",
                        fontSize: "1.5rem",
                        backgroundColor: "#f3f4f6",
                        border: "2px solid #d1d5db",
                        borderRadius: "8px",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#e5e7eb";
                        e.currentTarget.style.borderColor = "#9ca3af";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#f3f4f6";
                        e.currentTarget.style.borderColor = "#d1d5db";
                      }}
                    >
                      🧮
                    </button>
                  </div>
                  {/* Desglose del efectivo cuando hay envases */}
                  {containersDepositInfo && containersDepositInfo.total > 0 && (
                    <div style={{
                      marginTop: "0.5rem",
                      padding: "0.5rem",
                      backgroundColor: cashReceived >= containersDepositInfo.total ? "#f0fdf4" : "#fef3c7",
                      border: `1px solid ${cashReceived >= containersDepositInfo.total ? "#059669" : "#f59e0b"}`,
                      borderRadius: "4px",
                      fontSize: "0.85rem",
                    }}>
                      {cashReceived >= containersDepositInfo.total ? (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                            <span style={{ color: "#065f46" }}>🍺 Efectivo para envases:</span>
                            <strong style={{ color: "#059669" }}>${containersDepositInfo.total.toFixed(2)}</strong>
                          </div>
                          {cashReceived > containersDepositInfo.total && (
                            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "0.25rem", borderTop: "1px solid #059669" }}>
                              <span style={{ color: "#065f46" }}>💰 Efectivo para productos:</span>
                              <strong style={{ color: "#059669" }}>${(cashReceived - containersDepositInfo.total).toFixed(2)}</strong>
                            </div>
                          )}
                          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "0.25rem", borderTop: "1px solid #059669", marginTop: "0.25rem", fontWeight: "600" }}>
                            <span style={{ color: "#065f46" }}>Total efectivo:</span>
                            <strong style={{ color: "#059669" }}>${cashReceived.toFixed(2)}</strong>
                          </div>
                        </>
                      ) : (
                        <div style={{ color: "#92400e" }}>
                          <strong>⚠️ Efectivo insuficiente:</strong> Se requiere al menos ${containersDepositInfo.total.toFixed(2)} para envases.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Tarjeta */}
                <div style={{ marginBottom: "15px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem" }}>
                    💳 Monto en Tarjeta:
                    {containersDepositInfo && containersDepositInfo.total > 0 && (
                      <span style={{ color: "#6b7280", fontSize: "0.85rem", marginLeft: "0.5rem" }}>
                        (Máximo: ${total.toFixed(2)} - solo productos)
                      </span>
                    )}
                  </label>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <div className="input-wrapper" style={{ flex: 1 }}>
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
                        onWheel={(e) => e.currentTarget.blur()}
                        style={{ paddingRight: cardAmount.length > 0 ? '35px' : '10px' }}
                      />
                      {cardAmount.length > 0 && (
                        <button
                          className="clear-btn-payment"
                          onClick={() => {
                            setCardAmount("");
                            cardInputRef.current?.focus();
                          }}
                          title="Limpiar"
                        >
                          ❌
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const currentValue = cardAmount.replace(/,/g, '') || '0';
                        showTouchCalculator(currentValue, '💰 Monto en Tarjeta', (newValue) => {
                          setCardAmount(newValue);
                          if (cardInputRef.current) {
                            cardInputRef.current.focus();
                            cardInputRef.current.select();
                          }
                        });
                      }}
                      title="Abrir calculadora táctil"
                      style={{
                        padding: "12px 16px",
                        fontSize: "1.5rem",
                        backgroundColor: "#f3f4f6",
                        border: "2px solid #d1d5db",
                        borderRadius: "8px",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#e5e7eb";
                        e.currentTarget.style.borderColor = "#9ca3af";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#f3f4f6";
                        e.currentTarget.style.borderColor = "#d1d5db";
                      }}
                    >
                      🧮
                    </button>
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
          </>
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
