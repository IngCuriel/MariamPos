import React from "react";
import type { StoreOrder } from "../../api/onlineStoreOrders";
import { STATUS_LABELS } from "../../constants/onlineStoreOrderStatus";
import "../../styles/pages/sales/pendingSaleDetailModal.css";

interface OnlineSaleDetailModalProps {
  isOpen: boolean;
  order: StoreOrder | null;
  onClose: () => void;
}

const money = (n: number) =>
  (n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

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

/**
 * Detalle (solo lectura) de un pedido de la tienda online. Reutiliza los estilos
 * del detalle de ventas pendientes (psd-*) para mantener coherencia visual.
 */
const OnlineSaleDetailModal: React.FC<OnlineSaleDetailModalProps> = ({
  isOpen,
  order,
  onClose,
}) => {
  if (!isOpen || !order) return null;

  const items = order.items ?? [];
  const clientName = order.user?.name || order.user?.email || "Cliente";

  return (
    <div className="psd-overlay" onClick={onClose} style={{ zIndex: 10002 }}>
      <div className="psd-content" onClick={(e) => e.stopPropagation()}>
        <div className="psd-header">
          <div className="psd-header-info">
            <span className="psd-header-label">Pedido en línea · Folio</span>
            <span className="psd-header-folio">{order.id}</span>
          </div>
          <button className="psd-close" onClick={onClose} title="Cerrar" type="button">
            ✕
          </button>
        </div>

        <div className="psd-body">
          <div className="psd-note">👤 {clientName}</div>

          {/* Metadatos: estado, fecha de creación y, si aplica, dirección de envío */}
          <div className="psd-dates">
            <div className="psd-date-item">
              <span className="psd-date-label">📦 Estado</span>
              <span className="psd-date-value">
                {STATUS_LABELS[order.status] || order.status}
              </span>
            </div>
            <div className="psd-date-item">
              <span className="psd-date-label">🕓 Creado</span>
              <span className="psd-date-value">{dateTimeMx(order.createdAt)}</span>
            </div>
            {order.branch?.name && (
              <div className="psd-date-item">
                <span className="psd-date-label">🏪 Sucursal</span>
                <span className="psd-date-value">{order.branch.name}</span>
              </div>
            )}
            {order.deliveryAddress && (
              <div className="psd-date-item">
                <span className="psd-date-label">📍 Envío</span>
                <span className="psd-date-value">{order.deliveryAddress}</span>
              </div>
            )}
          </div>

          <div className="psd-list">
            {items.map((it) => {
              const qty = it.confirmedQuantity ?? it.quantity;
              const calcText = `${qty}${
                it.presentationName ? ` ${it.presentationName}` : qty === 1 ? " unidad" : " unidades"
              } × ${money(it.unitPrice)}`;
              return (
                <div key={it.id} className="psd-item">
                  <span className="psd-item-name" title={it.productName}>
                    {it.productName}
                  </span>
                  {it.presentationName ? (
                    <span className="psd-badge psd-badge--pres">
                      📦 {it.presentationName}
                    </span>
                  ) : (
                    <span className="psd-badge-empty" aria-hidden="true" />
                  )}
                  <span className="psd-item-calc">{calcText}</span>
                  <span className="psd-item-subtotal">{money(it.subtotal)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="psd-footer">
          <div className="psd-total-row">
            <span className="psd-total-label">Total</span>
            <span className="psd-total-value">{money(order.total)}</span>
          </div>
          <button className="psd-btn-close" onClick={onClose} type="button">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnlineSaleDetailModal;
