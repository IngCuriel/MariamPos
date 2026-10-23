import React from "react";
import type { PendingSale } from "../../api/pendingSales";
import "../../styles/pages/sales/pendingSaleDetailModal.css";

interface PendingSaleDetailModalProps {
  isOpen: boolean;
  pendingSale: PendingSale | null;
  onClose: () => void;
}

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

// Fecha y hora en zona horaria de México (America/Mexico_City).
const dateTimeMx = (v?: string | null) => {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("es-MX", {
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

const PendingSaleDetailModal: React.FC<PendingSaleDetailModalProps> = ({
  isOpen,
  pendingSale,
  onClose,
}) => {
  if (!isOpen || !pendingSale) return null;

  const details = pendingSale.details ?? [];

  return (
    <div className="psd-overlay" onClick={onClose}>
      <div className="psd-content" onClick={(e) => e.stopPropagation()}>
        <div className="psd-header">
          <div className="psd-header-info">
            <span className="psd-header-label">Detalle de venta pendiente</span>
            <span className="psd-header-folio">{pendingSale.code}</span>
          </div>
          <button className="psd-close" onClick={onClose} title="Cerrar" type="button">
            ✕
          </button>
        </div>

        <div className="psd-body">
          {pendingSale.clientName && (
            <div className="psd-note">📝 {pendingSale.clientName}</div>
          )}

          {/* Metadatos: creación siempre; cobro solo si está pagado.
              Caja de origen y cajero creador de forma compacta. */}
          <div className="psd-dates">
            <div className="psd-date-item">
              <span className="psd-date-label">🕓 Creado</span>
              <span className="psd-date-value">
                {dateTimeMx(pendingSale.createdAt)}
                {pendingSale.createdBy ? ` · ${pendingSale.createdBy}` : ""}
              </span>
            </div>
            <div className="psd-date-item">
              <span className="psd-date-label">🏪 Caja de origen</span>
              <span className="psd-date-value">
                {pendingSale.cashRegister || "—"}
                {pendingSale.branch ? ` · ${pendingSale.branch}` : ""}
              </span>
            </div>
            {pendingSale.status === "PAID" && (
              <div className="psd-date-item">
                <span className="psd-date-label">🟢 Cobrado</span>
                <span className="psd-date-value">
                  {dateTimeMx(pendingSale.paidAt)}
                  {pendingSale.paidBy ? ` · ${pendingSale.paidBy}` : ""}
                </span>
              </div>
            )}
            {pendingSale.status === "PAID" && pendingSale.paidCashRegister && (
              <div className="psd-date-item">
                <span className="psd-date-label">💵 Cobrado en</span>
                <span className="psd-date-value">{pendingSale.paidCashRegister}</span>
              </div>
            )}
          </div>

          <div className="psd-list">
            {details.map((d, i) => {
              // ¿Tiene presentación? (ej: Bulto). presentationName viene poblado.
              const hasPresentation = !!d.presentationName;
              // Cuántas unidades base trae la presentación (ej: 20 kilogramos por bulto).
              const pres = d.product?.presentations?.find(
                (p) => p.id === d.presentationId
              );
              const unitsPerPres = pres?.quantity;
              const unitName = d.product?.unit?.name;
              // Total de la línea. Para presentaciones NO base, el subTotal guardado
              // puede venir como precioUnitario × 1 (sin multiplicar las unidades que
              // trae la presentación). Recalculamos: precio × unidades × nº presentaciones.
              const isBasePres = !unitsPerPres || unitsPerPres === 1;
              const lineTotal =
                hasPresentation && !isBasePres && unitsPerPres
                  ? d.price * unitsPerPres * d.quantity
                  : d.subTotal ?? d.price * d.quantity;

              const calcText = hasPresentation
                ? `${d.quantity} ${d.quantity === 1 ? "presentación" : "presentaciones"}${
                    unitsPerPres ? ` · ${unitsPerPres}${unitName ? " " + unitName : ""} c/u` : ""
                  } × ${money(d.price)}`
                : `${d.quantity}${
                    unitName ? " " + unitName : d.quantity === 1 ? " unidad" : " unidades"
                  } × ${money(d.price)}`;

              return (
                <div key={i} className="psd-item">
                  <span className="psd-item-name" title={d.productName || "Producto"}>
                    {d.productName || "Producto"}
                  </span>
                  {/* Badge solo cuando NO es normal: presentación (📦) o granel (⚖️) */}
                  {hasPresentation ? (
                    <span className="psd-badge psd-badge--pres">
                      📦 {d.presentationName}
                    </span>
                  ) : d.saleType === "Granel" ? (
                    <span className="psd-badge">⚖️ Granel</span>
                  ) : (
                    <span className="psd-badge-empty" aria-hidden="true" />
                  )}
                  <span className="psd-item-calc">{calcText}</span>
                  <span className="psd-item-subtotal">{money(lineTotal)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="psd-footer">
          <div className="psd-total-row">
            <span className="psd-total-label">Total</span>
            <span className="psd-total-value">{money(pendingSale.total)}</span>
          </div>
          <button className="psd-btn-close" onClick={onClose} type="button">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PendingSaleDetailModal;
