import React from 'react';
import type { StoreOrderItem } from '../../api/onlineStoreOrders';
import '../../styles/components/orderItemsShared.css';

export type FlowStep = 'review' | 'preparation' | 'delivery';

interface OrderItemsListProps {
  items: StoreOrderItem[];
  flowStep: FlowStep;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price ?? 0);

const OrderItemsList: React.FC<OrderItemsListProps> = ({ items, flowStep: _flowStep }) => {
  const availableItems = items.filter(i => i.isAvailable !== false);
  const unavailableItems = items.filter(i => i.isAvailable === false);

  const globalTotal = availableItems.reduce((sum, item) => {
    const qty = item.confirmedQuantity ?? item.quantity;
    return sum + qty * item.unitPrice;
  }, 0);

  return (
    <div className="order-items-shared">
      {/* Section: Products to deliver */}
      <div className="order-items-section">
        <div className="order-items-section-header">
          <span className="order-items-section-icon">📦</span>
          <span className="order-items-section-title">A entregar</span>
          <span className="order-items-section-count">{availableItems.length}</span>
          {availableItems.length > 4 && (
            <span className="order-items-scroll-hint">↕ desliza</span>
          )}
          <span className="order-items-section-total">
            Total: <strong>{formatPrice(globalTotal)}</strong>
          </span>
        </div>

        <div className="order-items-cards-wrap">
          {availableItems.length === 0 ? (
            <p className="order-items-empty">No hay productos disponibles para entregar.</p>
          ) : (
            availableItems.map((item, index) => {
              const isPartial =
                item.confirmedQuantity != null &&
                item.confirmedQuantity < item.quantity;
              const deliverQty = item.confirmedQuantity ?? item.quantity;
              const lineTotal = deliverQty * item.unitPrice;

              return (
                <div
                  key={item.id ?? `avail-${index}`}
                  className={`order-items-card ${isPartial ? 'order-items-card--partial' : ''}`}
                >
                  <div className="order-items-card-left">
                    <span className="order-items-card-icon">
                      {isPartial ? '⚠' : '✓'}
                    </span>
                  </div>
                  <div className="order-items-card-body">
                    <div className="order-items-card-name-row">
                      <span className="order-items-card-name">{item.productName ?? 'Producto'}</span>
                      {isPartial && (
                        <span className="order-items-card-partial-badge">
                          parcial: {deliverQty} de {item.quantity}
                        </span>
                      )}
                    </div>
                    <div className="order-items-card-detail">
                      <span className="order-items-card-detail-item">
                        <span className="order-items-card-label">Entregar:</span>
                        <span className="order-items-card-value order-items-card-value--qty">{deliverQty}</span>
                      </span>
                      <span className="order-items-card-detail-sep">×</span>
                      <span className="order-items-card-detail-item">
                        <span className="order-items-card-label">P.U:</span>
                        <span className="order-items-card-value">{formatPrice(item.unitPrice)}</span>
                      </span>
                      <span className="order-items-card-detail-sep">=</span>
                      <span className="order-items-card-detail-item">
                        <span className="order-items-card-label">Total:</span>
                        <span className="order-items-card-value order-items-card-value--total">{formatPrice(lineTotal)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Section: Unavailable products */}
      {unavailableItems.length > 0 && (
        <div className="order-items-section order-items-section--unavailable">
          <div className="order-items-section-header order-items-section-header--red">
            <span className="order-items-section-icon">✕</span>
            <span className="order-items-section-title">No disponibles</span>
            <span className="order-items-section-count order-items-section-count--red">{unavailableItems.length}</span>
            <span className="order-items-section-note">Cliente notificado</span>
          </div>
          <ul className="order-items-unavailable-list">
            {unavailableItems.map((item, index) => (
              <li key={item.id ?? `unavail-${index}`} className="order-items-unavailable-item">
                <span className="order-items-unavailable-name">{item.productName ?? 'Producto'}</span>
                <span className="order-items-unavailable-qty">
                  Solicitado: {item.quantity} — {formatPrice(item.unitPrice)} c/u
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default OrderItemsList;
