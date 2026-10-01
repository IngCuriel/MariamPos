import { useEffect, useMemo, useState } from "react";
import { IoCloseCircleOutline } from "react-icons/io5";
import Swal from "sweetalert2";
import { returnSale } from "../../api/returns";
import type {
  Sale,
  SaleDetail,
  ReturnSaleRequest,
  ReturnSaleResponse,
} from "../../types/index";
import ReasonPicker, { type ReasonSelection } from "./ReasonPicker";
import "../../styles/pages/sales/paymentModal.css";

interface ReturnSaleModalProps {
  // Venta sobre la que se registra la devolución (incluye sus detalles).
  sale: Sale;
  // Cierra el modal sin aplicar cambios.
  onClose: () => void;
  // Se invoca con la respuesta del backend cuando la devolución se registra con éxito.
  // El componente de comprobante lo renderiza el llamador (no se importa aquí).
  onSuccess?: (response: ReturnSaleResponse) => void;
  // Caja donde se ejecuta la operación (para resolver el turno activo en backend).
  cashRegister?: string;
  // Cajera que ejecuta la devolución (auditoría).
  createdBy?: string;
}

// Cantidad disponible para devolver de un renglón = vendido - ya devuelto.
const availableToReturn = (detail: SaleDetail): number =>
  detail.quantity - (detail.returnedQuantity ?? 0);

const ReturnSaleModal: React.FC<ReturnSaleModalProps> = ({
  sale,
  onClose,
  onSuccess,
  cashRegister,
  createdBy,
}) => {
  // Cantidad elegida por renglón, indexada por saleDetailId. Default 0.
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  // Motivo y clasificación provistos por ReasonPicker.
  const [reasonSelection, setReasonSelection] = useState<ReasonSelection>({
    reason: "",
    reasonType: "estandar",
    isValid: false,
  });
  // Cómo se devuelve el dinero al cliente: "efectivo" (sale de la caja),
  // "transferencia" (por fuera) o "none" (no se devuelve).
  const [refundMethod, setRefundMethod] = useState<
    "efectivo" | "transferencia" | "none"
  >("efectivo");
  // Destino del inventario: "estandar" (regresa a stock) o "merma".
  const [inventoryDestination, setInventoryDestination] = useState<
    "estandar" | "merma"
  >("estandar");
  const [loading, setLoading] = useState(false);

  const details = sale.details ?? [];

  // ¿La venta tiene algún producto que maneja inventario?
  const hasTrackedProducts = details.some((d) => d.product?.trackInventory);

  // Renglones que todavía tienen cantidad disponible para devolver.
  const returnableDetails = useMemo(
    () => details.filter((d) => availableToReturn(d) > 0),
    [details]
  );

  // Actualiza la cantidad de un renglón, acotada a [0, disponible].
  const setLineQuantity = (detail: SaleDetail, raw: number) => {
    const available = availableToReturn(detail);
    let value = Number.isFinite(raw) ? raw : 0;
    if (value < 0) value = 0;
    if (value > available) value = available; // validación en cliente (Req 2.3)
    setQuantities((prev) => ({ ...prev, [detail.id]: value }));
  };

  // Líneas con cantidad > 0 que se incluirán en la solicitud.
  const selectedLines = useMemo(
    () =>
      returnableDetails
        .map((d) => ({ detail: d, quantity: quantities[d.id] ?? 0 }))
        .filter((l) => l.quantity > 0),
    [returnableDetails, quantities]
  );

  // Suma de subtotales devueltos (proporcional a la cantidad elegida por renglón).
  const refundTotal = useMemo(
    () =>
      selectedLines.reduce((sum, { detail, quantity }) => {
        const unitSubtotal =
          detail.quantity > 0 ? detail.subTotal / detail.quantity : 0;
        return sum + unitSubtotal * quantity;
      }, 0),
    [selectedLines]
  );

  const hasSelection = selectedLines.length > 0;
  const canSubmit =
    !loading && reasonSelection.isValid && hasSelection && returnableDetails.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setLoading(true);
    try {
      const body: ReturnSaleRequest = {
        reason: reasonSelection.reason,
        // El destino del inventario lo decide el radio del modal, no el picker.
        reasonType: inventoryDestination,
        createdBy,
        branch: sale.branch,
        cashRegister: cashRegister ?? sale.cashRegister,
        refundMethod,
        lines: selectedLines.map(({ detail, quantity }) => ({
          saleDetailId: detail.id,
          quantity,
        })),
      };

      const response = await returnSale(sale.id, body);

      Swal.fire({
        icon: "success",
        title: "✅ Devolución registrada",
        text: `Se registró la devolución de la venta ${sale.folio}.`,
        timer: 2000,
        showConfirmButton: false,
      });

      onSuccess?.(response);
      onClose();
    } catch (error: any) {
      const status = error?.response?.status;
      const data = error?.response?.data;

      // Turno de caja requerido para la salida de efectivo (Req 7.7 / 2.10).
      if (status === 409 && (data?.requiresShift || data?.error)) {
        Swal.fire({
          icon: "warning",
          title: "Turno de caja requerido",
          text:
            data?.message ||
            data?.error ||
            "La devolución implica salida de efectivo. Abre un turno de caja antes de continuar.",
          confirmButtonText: "Entendido",
        });
        return;
      }

      // Cantidad excedida u otra validación del backend (Req 2.3).
      if (status === 400) {
        Swal.fire({
          icon: "warning",
          title: "No se pudo registrar la devolución",
          text:
            data?.message ||
            data?.error ||
            "Revisa las cantidades y el motivo de la devolución.",
          confirmButtonText: "Entendido",
        });
        return;
      }

      console.error("Error al registrar devolución:", error);
      Swal.fire({
        icon: "error",
        title: "Error al registrar devolución",
        text: data?.error || "No se pudo registrar la devolución.",
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
          ↩️ Devolver productos
        </h2>

        {/* Fila 1: datos de la venta (un poco más grandes) */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "10px 24px",
            backgroundColor: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: "10px",
            padding: "14px 18px",
            marginBottom: "16px",
            fontSize: "0.95rem",
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
          {(sale.createdBy ?? createdBy) && (
            <span style={{ color: "#6b7280" }}>
              <strong style={{ color: "#374151" }}>Cajero:</strong>{" "}
              {sale.createdBy ?? createdBy}
            </span>
          )}
        </div>

        {returnableDetails.length === 0 ? (
          <p
            style={{
              textAlign: "center",
              color: "#6b7280",
              padding: "24px",
              fontSize: "0.95rem",
            }}
          >
            No hay productos disponibles para devolver en esta venta.
          </p>
        ) : (
          <>
            {/* Fila 2: productos a devolver (ancho completo) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "#1f2937",
                  marginBottom: "2px",
                }}
              >
                Productos a devolver:
              </label>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  maxHeight: "240px",
                  overflowY: "auto",
                }}
              >
              {returnableDetails.map((detail) => {
                const available = availableToReturn(detail);
                const selected = quantities[detail.id] ?? 0;
                return (
                  <div
                    key={detail.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      padding: "7px 10px",
                      backgroundColor: "#f9fafb",
                      borderRadius: "7px",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "0.88rem",
                          color: "#1f2937",
                        }}
                      >
                        {detail.productName}
                      </div>
                      <div style={{ fontSize: "0.74rem", color: "#6b7280", marginTop: "1px" }}>
                        {/* Precio unitario de lo vendido (pieza o presentación) */}
                        ${detail.price.toFixed(2)}
                        {detail.unitAbbrev ? ` / ${detail.unitAbbrev}` : " c/u"}
                        {" · "}
                        {/* Subtotal del renglón */}
                        Subtotal: ${detail.subTotal.toFixed(2)}
                      </div>
                      <div style={{ fontSize: "0.74rem", color: "#6b7280" }}>
                        Comprado: {detail.quantity}
                        {detail.unitAbbrev ? ` ${detail.unitAbbrev}` : ""}
                        {(detail.returnedQuantity ?? 0) > 0
                          ? ` · Ya devuelto: ${detail.returnedQuantity}`
                          : ""}
                        {" · "}
                        <span style={{ color: "#047857", fontWeight: 600 }}>
                          Puede devolver: {available}
                          {detail.unitAbbrev ? ` ${detail.unitAbbrev}` : ""}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        flexShrink: 0,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setLineQuantity(detail, selected - 1)}
                        disabled={loading || selected <= 0}
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "6px",
                          border: "1px solid #d1d5db",
                          backgroundColor: "white",
                          cursor:
                            loading || selected <= 0 ? "not-allowed" : "pointer",
                          fontSize: "1rem",
                        }}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={available}
                        step="any"
                        value={selected}
                        disabled={loading}
                        onChange={(e) =>
                          setLineQuantity(detail, parseFloat(e.target.value))
                        }
                        style={{
                          width: "72px",
                          padding: "6px",
                          textAlign: "center",
                          borderRadius: "6px",
                          border: "1px solid #d1d5db",
                          fontSize: "0.9rem",
                          boxSizing: "border-box",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setLineQuantity(detail, selected + 1)}
                        disabled={loading || selected >= available}
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "6px",
                          border: "1px solid #d1d5db",
                          backgroundColor: "white",
                          cursor:
                            loading || selected >= available
                              ? "not-allowed"
                              : "pointer",
                          fontSize: "1rem",
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>

            {/* Fila 3: 3 columnas → dinero · motivo · destino inventario */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: hasTrackedProducts
                  ? "repeat(3, minmax(0, 1fr))"
                  : "repeat(2, minmax(0, 1fr))",
                gap: "16px",
                alignItems: "start",
                marginBottom: "16px",
              }}
            >
              {/* Cómo se devuelve el dinero */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: "#374151",
                    marginBottom: "6px",
                  }}
                >
                  ¿Cómo se devuelve el dinero?
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  {[
                    { key: "efectivo", label: "💵 Efectivo", hint: "Sale efectivo de la caja (requiere turno abierto)." },
                    { key: "transferencia", label: "🏦 Transferencia", hint: "Se devuelve por fuera; no afecta la caja." },
                    { key: "none", label: "🚫 No se devuelve", hint: "No se entrega dinero al cliente." },
                  ].map((opt) => {
                    const active = refundMethod === opt.key;
                    return (
                      <label
                        key={opt.key}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "8px",
                          padding: "7px 10px",
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
                          name="returnRefundMethod"
                          checked={active}
                          disabled={loading}
                          onChange={() =>
                            setRefundMethod(opt.key as "efectivo" | "transferencia" | "none")
                          }
                          style={{ marginTop: "2px", accentColor: "#667eea" }}
                        />
                        <span>
                          <span style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: active ? "#4338ca" : "#374151" }}>
                            {opt.label}
                          </span>
                          <span style={{ fontSize: "0.72rem", color: "#6b7280" }}>{opt.hint}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Motivo (columna del medio), sin checkbox de merma */}
              <div>
                <ReasonPicker
                  mode="return"
                  onChange={setReasonSelection}
                  disabled={loading}
                  hideMermaToggle
                />
              </div>

              {/* Destino del inventario (solo si hay productos con stock) */}
              {hasTrackedProducts && (
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "#374151",
                      marginBottom: "6px",
                    }}
                  >
                    ¿Qué pasa con el producto?
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    {[
                      { key: "estandar", label: "📦 Regresa a existencias", hint: "El producto vuelve al inventario." },
                      { key: "merma", label: "🗑️ Merma", hint: "No regresa (caducado, dañado, etc.)." },
                    ].map((opt) => {
                      const active = inventoryDestination === opt.key;
                      return (
                        <label
                          key={opt.key}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "8px",
                            padding: "7px 10px",
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
                            name="returnInventoryDestination"
                            checked={active}
                            disabled={loading}
                            onChange={() =>
                              setInventoryDestination(opt.key as "estandar" | "merma")
                            }
                            style={{ marginTop: "2px", accentColor: "#667eea" }}
                          />
                          <span>
                            <span style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: active ? "#4338ca" : "#374151" }}>
                              {opt.label}
                            </span>
                            <span style={{ fontSize: "0.72rem", color: "#6b7280" }}>{opt.hint}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            {/* Fila 4: resumen (líneas seleccionadas / monto a devolver) */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px 24px",
                padding: "10px 14px",
                backgroundColor: "#f3f4f6",
                borderRadius: "8px",
                fontSize: "0.9rem",
                marginBottom: "4px",
              }}
            >
              <span>
                Líneas seleccionadas: <strong>{selectedLines.length}</strong>
              </span>
              <span>
                Monto a devolver:{" "}
                <strong style={{ color: "#dc2626" }}>
                  ${refundTotal.toFixed(2)}
                </strong>
              </span>
            </div>
          </>
        )}

        <div className="payment-modal-actions" style={{ marginTop: "8px" }}>
          <button
            className="cancel-btn-payment"
            onClick={onClose}
            disabled={loading}
            style={{ fontSize: "0.9rem", padding: "10px 20px" }}
          >
            Cancelar (ESC)
          </button>
          <button
            className="confirm-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              fontSize: "0.9rem",
              padding: "10px 20px",
              opacity: canSubmit ? 1 : 0.6,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {loading ? "Registrando..." : "Registrar devolución"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReturnSaleModal;
