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

              return (
                <div key={i} className="psd-item">
                  <div className="psd-item-main">
                    <span className="psd-item-name">{d.productName || "Producto"}</span>
                    <span className="psd-item-subtotal">{money(lineTotal)}</span>
                  </div>

                  {hasPresentation ? (
                    <div className="psd-item-detail">
                      <span className="psd-badge psd-badge--pres">
                        📦 {d.presentationName}
                      </span>
                      <span className="psd-item-calc">
                        {d.quantity} {d.quantity === 1 ? "presentación" : "presentaciones"}
                        {unitsPerPres
                          ? ` · ${unitsPerPres}${unitName ? " " + unitName : ""} c/u`
                          : ""}{" "}
                        × {money(d.price)}
                      </span>
                    </div>
                  ) : (
                    <div className="psd-item-detail">
                      <span className="psd-badge">
                        {d.saleType === "Granel" ? "⚖️ Granel" : "🏷️ Normal"}
                      </span>
                      <span className="psd-item-calc">
                        {d.quantity}
                        {unitName ? " " + unitName : d.quantity === 1 ? " unidad" : " unidades"} ×{" "}
                        {money(d.price)}
                      </span>
                    </div>
                  )}
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
