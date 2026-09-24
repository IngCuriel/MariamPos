import React, { useState, useEffect } from "react";
import { IoClose } from "react-icons/io5";
import Swal from "sweetalert2";
import { createCreditPayment, getCreditById } from "../../api/credits";
import { useCashier } from "../../contexts/CashierContext";
import type { ClientCredit, CreateCreditPaymentInput } from "../../types/index";
import "../../styles/pages/client/creditPaymentModal.css";

interface CreditPaymentModalProps {
  isOpen: boolean;
  credit: ClientCredit | null;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

const formatMXN = (value: number) =>
  (value || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const formatDateTime = (value?: Date | string) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

const CreditPaymentModal: React.FC<CreditPaymentModalProps> = ({
  isOpen,
  credit,
  onClose,
  onPaymentSuccess,
}) => {
  const { selectedCashier } = useCashier();
  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("efectivo");
  // Notas: oculto por ahora, se conserva la lógica por si vuelve.
  const [notes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [creditDetails, setCreditDetails] = useState<ClientCredit | null>(credit);

  useEffect(() => {
    if (isOpen && credit) {
      loadCreditDetails();
      setAmount("");
      setPaymentMethod("efectivo");
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
        text: `El monto del abono (${formatMXN(paymentAmount)}) no puede ser mayor al saldo pendiente (${formatMXN(creditDetails.remainingAmount)})`,
        confirmButtonText: "Entendido",
      });
      return;
    }

    setLoading(true);
    try {
      const input: CreateCreditPaymentInput = {
        creditId: creditDetails.id,
        amount: paymentAmount,
        paymentMethod: paymentMethod,
        notes: notes.trim() || undefined,
        // Cajero seleccionado que aplica el abono (auditoría).
        createdBy: selectedCashier?.name || undefined,
        // Caja donde se cobra: el backend resuelve el turno activo para el corte.
        branch: localStorage.getItem("sucursal") || "Sucursal Principal",
        cashRegister: localStorage.getItem("caja") || "Caja 1",
      };

      await createCreditPayment(creditDetails.id, input);

      Swal.fire({
        icon: "success",
        title: "✅ Abono registrado",
        html: `
          <p>El abono de ${formatMXN(paymentAmount)} se ha registrado correctamente.</p>
          <p style="margin-top: 10px; color: #059669; font-weight: 600;">
            Saldo pendiente restante: ${formatMXN(creditDetails.remainingAmount - paymentAmount)}
          </p>
        `,
        timer: 3000,
        showConfirmButton: false,
      });

      onPaymentSuccess();
      onClose();
    } catch (error: unknown) {
      console.error("Error al registrar abono:", error);
      const message =
        typeof error === "object" && error !== null && "response" in error
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      Swal.fire({
        icon: "error",
        title: "Error",
        text: message || "No se pudo registrar el abono",
        confirmButtonText: "Entendido",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !creditDetails) return null;

  const clientName = creditDetails.client?.name || credit?.client?.name || "—";
  const paymentAmountNum = parseFloat(amount || "0");
  const canSubmit = !loading && paymentAmountNum > 0 && paymentAmountNum <= creditDetails.remainingAmount;

  return (
    <div className="abono-overlay" onClick={onClose} role="presentation">
      <div className="abono-modal" role="dialog" aria-modal="true" aria-labelledby="abono-title" onClick={(e) => e.stopPropagation()}>
        <div className="abono-header">
          <div>
            <h2 id="abono-title" className="abono-title">💳 Registrar Abono</h2>
            <span className="abono-header-folio">Crédito #{creditDetails.id}</span>
          </div>
          <button className="abono-close" onClick={onClose} aria-label="Cerrar">
            <IoClose size={24} />
          </button>
        </div>

        <div className="abono-body">
          {/* Resumen del crédito */}
          <div className="abono-info">
            <div className="abono-info-row">
              <span className="abono-info-label">Cliente</span>
              <span className="abono-info-value">{clientName}</span>
            </div>
            <div className="abono-info-row">
              <span className="abono-info-label">Fecha del crédito</span>
              <span className="abono-info-value">{formatDateTime(creditDetails.createdAt)}</span>
            </div>
            <div className="abono-info-note">
              Este crédito se generó de la venta <strong>#{creditDetails.saleId}</strong>, registrada por{" "}
              <strong>{creditDetails.createdBy || "cajero no registrado"}</strong>.
            </div>
            <div className="abono-info-amounts">
              <div className="abono-amount">
                <span className="abono-amount-label">Total del crédito</span>
                <span className="abono-amount-value">
                  {formatMXN(creditDetails.originalAmount)}
                </span>
              </div>
              <div className="abono-amount">
                <span className="abono-amount-label">Pagado</span>
                <span className="abono-amount-value abono-amount-value--paid">
                  {formatMXN(creditDetails.paidAmount)}
                </span>
              </div>
              <div className="abono-amount">
                <span className="abono-amount-label">Pendiente</span>
                <span className="abono-amount-value abono-amount-value--due">
                  {formatMXN(creditDetails.remainingAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Monto a abonar */}
          <div className="abono-field">
            <label htmlFor="abono-amount" className="abono-label">
              Monto a abonar <span className="abono-required">*</span>
            </label>
            <input
              id="abono-amount"
              className="abono-input"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              max={creditDetails.remainingAmount}
              inputMode="decimal"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
            />
            <span className="abono-hint">Máximo: {formatMXN(creditDetails.remainingAmount)}</span>
          </div>

          {/* Método de pago */}
          <div className="abono-field">
            <label htmlFor="abono-method" className="abono-label">Método de pago</label>
            <select
              id="abono-method"
              className="abono-select"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="efectivo">💵 Efectivo</option>
              <option value="tarjeta">💳 Tarjeta</option>
              <option value="transferencia">📱 Transferencia</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        </div>

        <div className="abono-footer">
          <button
            type="button"
            className="abono-btn abono-btn--cancel"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="abono-btn abono-btn--confirm"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {loading ? "Registrando..." : "Registrar Abono"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreditPaymentModal;
