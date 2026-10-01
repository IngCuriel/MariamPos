import { useEffect, useState } from "react";
import { IoCloseCircleOutline } from "react-icons/io5";
import Swal from "sweetalert2";
import ReasonPicker, { type ReasonSelection } from "./ReasonPicker";
import { cancelSale } from "../../api/returns";
import type { CancelSaleRequest, CancelSaleResponse, Sale } from "../../types/index";
import "../../styles/pages/sales/paymentModal.css";

interface CancelSaleModalProps {
  // Venta a cancelar. El modal usa su folio/total/sucursal/caja para armar el request.
  sale: Sale;
  // Cierra el modal sin cancelar.
  onClose: () => void;
  // Se invoca con la respuesta completa cuando la cancelación tiene éxito.
  // El padre (wiring de la tarea 12.1) usa `response.receipt` para renderizar
  // el comprobante (CancellationReturnReceipt, construido por otra tarea).
  onSuccess: (response: CancelSaleResponse) => void;
  // Cajera que ejecuta la operación (auditoría, Req 5.1). Opcional.
  createdBy?: string;
}

/**
 * CancelSaleModal
 *
 * Confirma la cancelación de una venta completa (Req 1.1).
 * - Solicita el Motivo ANTES de aplicar la cancelación mediante `ReasonPicker`
 *   en modo "cancel" (Req 1.2); bloquea el botón de confirmar mientras el motivo
 *   no sea válido (Req 1.4).
 * - Llama `cancelSale(saleId, body)` pasando reason/reasonType + datos de auditoría
 *   (createdBy/branch/cashRegister) tomados de la venta.
 * - Al éxito, entrega la respuesta al padre vía `onSuccess` para que abra el
 *   comprobante (Req 10.1), y cierra el modal.
 * - Maneja el error 409 `requiresShift` informando que se requiere un turno de
 *   caja abierto (Req 7.7); el resto de errores se muestran con su mensaje.
 */
const CancelSaleModal: React.FC<CancelSaleModalProps> = ({
  sale,
  onClose,
  onSuccess,
  createdBy,
}) => {
  // Selección actual del ReasonPicker. Arranca inválida hasta que haya motivo.
  const [selection, setSelection] = useState<ReasonSelection>({
    reason: "",
    reasonType: "estandar",
    isValid: false,
  });
  const [loading, setLoading] = useState(false);

  // Una venta ya "Cancelada" no puede volver a cancelarse (Req 1.5).
  const alreadyCancelled = sale.status === "Cancelada";

  // Cómo se devuelve el dinero al cliente. Lo decide la cajera.
  // "efectivo" → sale efectivo de la caja; "transferencia" → se devuelve por
  // fuera (no toca la caja); "none" → no se devuelve dinero (error del cajero,
  // el cliente nunca pagó, etc.). Arranca en "efectivo" como opción por defecto.
  const [refundMethod, setRefundMethod] = useState<
    "efectivo" | "transferencia" | "none"
  >("efectivo");

  // Destino del inventario para los productos que manejan stock:
  // "estandar" → regresa a existencias; "merma" → se da de baja (no regresa).
  const [inventoryDestination, setInventoryDestination] = useState<
    "estandar" | "merma"
  >("estandar");

  // ¿La venta tiene al menos un producto que maneja inventario? El selector de
  // destino solo tiene efecto en esos casos.
  const hasTrackedProducts = (sale.details ?? []).some(
    (d) => d.product?.trackInventory
  );

  const handleConfirm = async () => {
    if (loading) return;

    if (alreadyCancelled) {
      Swal.fire({
        icon: "info",
        title: "La venta ya está cancelada",
        text: "Esta venta ya fue cancelada previamente y no puede cancelarse de nuevo.",
        confirmButtonText: "Entendido",
      });
      return;
    }

    // Bloqueo de envío sin motivo válido (Req 1.4 / 3.1).
    if (!selection.isValid) {
      Swal.fire({
        icon: "warning",
        title: "Motivo requerido",
        text: "Selecciona o escribe un motivo para cancelar la venta.",
        confirmButtonText: "Entendido",
      });
      return;
    }

    setLoading(true);
    try {
      const body: CancelSaleRequest = {
        reason: selection.reason,
        // El destino del inventario lo decide el radio del modal, no el picker.
        reasonType: inventoryDestination,
        createdBy: createdBy ?? sale.createdBy,
        branch: sale.branch,
        cashRegister: sale.cashRegister,
        // Cómo se devuelve el dinero: decide si sale efectivo de la caja.
        refundMethod,
      };

      const response = await cancelSale(sale.id, body);

      // Entrega la respuesta al padre para abrir el comprobante (Req 10.1).
      onSuccess(response);
      onClose();
    } catch (error: any) {
      const status = error?.response?.status;
      const data = error?.response?.data;

      // 409 requiresShift: se necesita un turno de caja abierto para la salida
      // de efectivo (Req 7.7).
      if (status === 409 && data?.requiresShift) {
        Swal.fire({
          icon: "warning",
          title: "Se requiere un turno de caja abierto",
          text:
            data?.error ||
            "La cancelación implica una salida de efectivo. Abre un turno de caja en esta caja antes de continuar.",
          confirmButtonText: "Entendido",
        });
        return;
      }

      // 409 por venta ya cancelada u otro conflicto de estado (Req 1.5).
      if (status === 409) {
        Swal.fire({
          icon: "info",
          title: "No se pudo cancelar la venta",
          text: data?.error || "La venta ya está cancelada.",
          confirmButtonText: "Entendido",
        });
        return;
      }

      Swal.fire({
        icon: "error",
        title: "Error al cancelar la venta",
        text: data?.error || "No se pudo cancelar la venta. Intenta de nuevo.",
        confirmButtonText: "Entendido",
      });
    } finally {
      setLoading(false);
    }
  };

  // Cerrar con ESC.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const confirmDisabled = loading || alreadyCancelled || !selection.isValid;

  return (
    <div className="modal-overlay">
      <div
        className="modal-container"
        style={{
          maxWidth: "920px",
          width: "95%",
          maxHeight: "95vh",
          overflowY: "auto",
          padding: "22px 24px",
        }}
      >
        <button className="close-btn" onClick={onClose}>
          <IoCloseCircleOutline size={28} />
        </button>

        <h2
          className="modal-title"
          style={{ fontSize: "1.3rem", marginBottom: "10px" }}
        >
          🚫 Cancelar venta
        </h2>

        {/* Datos de la venta en una sola fila */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "8px 18px",
            backgroundColor: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: "10px",
            padding: "10px 16px",
            marginBottom: "16px",
            fontSize: "0.85rem",
            color: "#374151",
          }}
        >
          <span>
            <strong>Folio:</strong>{" "}
            {sale.folio && sale.folio.trim() ? sale.folio : `#${sale.id}`}
          </span>
          <span>
            <strong>Total:</strong> ${sale.total.toFixed(2)}
          </span>
          <span style={{ color: "#6b7280" }}>
            <strong style={{ color: "#374151" }}>Caja:</strong> {sale.branch} -{" "}
            {sale.cashRegister}
          </span>
          {sale.paymentMethod && (
            <span style={{ color: "#6b7280" }}>
              <strong style={{ color: "#374151" }}>Pago:</strong>{" "}
              {sale.paymentMethod}
            </span>
          )}
          {(createdBy ?? sale.createdBy) && (
            <span style={{ color: "#6b7280" }}>
              <strong style={{ color: "#374151" }}>Cajero:</strong>{" "}
              {createdBy ?? sale.createdBy}
            </span>
          )}
        </div>

        {alreadyCancelled ? (
          <p
            style={{
              padding: "12px",
              borderRadius: "8px",
              backgroundColor: "#fef2f2",
              color: "#b91c1c",
              fontSize: "0.9rem",
              marginBottom: "16px",
            }}
          >
            Esta venta ya está cancelada. No es posible cancelarla de nuevo.
          </p>
        ) : (
          <>
            <p
              style={{
                fontSize: "0.85rem",
                color: "#374151",
                marginBottom: "16px",
              }}
            >
              Esta acción marcará la venta como <strong>Cancelada</strong> y la
              excluirá de los reportes. La venta original se conserva para
              auditoría.
            </p>

            {/* Tres columnas: devolución de dinero · motivo · destino inventario */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: hasTrackedProducts
                  ? "repeat(3, minmax(0, 1fr))"
                  : "repeat(2, minmax(0, 1fr))",
                gap: "16px",
                alignItems: "start",
              }}
            >
            {/* Cómo se devuelve el dinero al cliente: decide la salida de efectivo */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                ¿Cómo se devuelve el dinero al cliente?
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {[
                  {
                    key: "efectivo",
                    label: "💵 Efectivo",
                    hint: "Sale efectivo de la caja (requiere turno abierto).",
                  },
                  {
                    key: "transferencia",
                    label: "🏦 Transferencia",
                    hint: "Se devuelve por fuera; no afecta el efectivo de la caja.",
                  },
                  {
                    key: "none",
                    label: "🚫 No se devuelve dinero",
                    hint: "Error del cajero o el cliente no pagó; solo se cancela.",
                  },
                ].map((opt) => {
                  const active = refundMethod === opt.key;
                  return (
                    <label
                      key={opt.key}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "8px",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "2px solid",
                        borderColor: active ? "#667eea" : "#e5e7eb",
                        backgroundColor: active ? "#eef2ff" : "white",
                        cursor: loading ? "not-allowed" : "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      <input
                        type="radio"
                        name="refundMethod"
                        checked={active}
                        disabled={loading}
                        onChange={() =>
                          setRefundMethod(
                            opt.key as "efectivo" | "transferencia" | "none"
                          )
                        }
                        style={{ marginTop: "2px", accentColor: "#667eea" }}
                      />
                      <span>
                        <span
                          style={{
                            display: "block",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            color: active ? "#4338ca" : "#374151",
                          }}
                        >
                          {opt.label}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                          {opt.hint}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Columna 2: Selector de motivo (modo cancelación, Req 1.2 / 1.3).
                El checkbox de merma se oculta: el destino del inventario se
                decide con el radio de la columna 3. */}
            <div>
              <ReasonPicker
                mode="cancel"
                onChange={setSelection}
                disabled={loading}
                hideMermaToggle
              />
            </div>

            {/* Columna 3: Destino del inventario (solo si hay productos con stock) */}
            {hasTrackedProducts && (
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: "#374151",
                    marginBottom: "8px",
                  }}
                >
                  ¿Qué pasa con el producto?
                </label>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: "6px" }}
                >
                  {[
                    {
                      key: "estandar",
                      label: "📦 Regresa a existencias",
                      hint: "El producto vuelve al inventario (venta anulada).",
                    },
                    {
                      key: "merma",
                      label: "🗑️ Se da de baja como merma",
                      hint: "El producto no regresa (caducado, dañado, etc.).",
                    },
                  ].map((opt) => {
                    const active = inventoryDestination === opt.key;
                    return (
                      <label
                        key={opt.key}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "8px",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "2px solid",
                          borderColor: active ? "#667eea" : "#e5e7eb",
                          backgroundColor: active ? "#eef2ff" : "white",
                          cursor: loading ? "not-allowed" : "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        <input
                          type="radio"
                          name="inventoryDestination"
                          checked={active}
                          disabled={loading}
                          onChange={() =>
                            setInventoryDestination(
                              opt.key as "estandar" | "merma"
                            )
                          }
                          style={{ marginTop: "2px", accentColor: "#667eea" }}
                        />
                        <span>
                          <span
                            style={{
                              display: "block",
                              fontSize: "0.85rem",
                              fontWeight: 600,
                              color: active ? "#4338ca" : "#374151",
                            }}
                          >
                            {opt.label}
                          </span>
                          <span
                            style={{ fontSize: "0.75rem", color: "#6b7280" }}
                          >
                            {opt.hint}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            </div>
          </>
        )}

        <div className="payment-modal-actions" style={{ marginTop: "20px" }}>
          <button
            className="cancel-btn-payment"
            onClick={onClose}
            disabled={loading}
            style={{ fontSize: "0.9rem", padding: "10px 20px" }}
          >
            Volver (ESC)
          </button>
          <button
            className="confirm-btn"
            onClick={handleConfirm}
            disabled={confirmDisabled}
            style={{
              fontSize: "0.9rem",
              padding: "10px 20px",
              opacity: confirmDisabled ? 0.6 : 1,
              cursor: confirmDisabled ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Cancelando..." : "Confirmar cancelación"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelSaleModal;
