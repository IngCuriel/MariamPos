import React, { useState, useEffect, useCallback } from 'react';
import { fetchOnlineStoreOrderById, markOnlineStoreOrderReady, type StoreOrder, type StoreOrderItem } from '../../api/onlineStoreOrders';
import { ORDER_STATUS } from '../../constants/onlineStoreOrderStatus';

export interface OnlineStorePreparationModalProps {
  open: boolean;
  orderId: number | null;
  onClose: () => void;
  onSuccess: (message?: string | null, errorMessage?: string | null) => void;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price ?? 0);

const OnlineStorePreparationModal: React.FC<OnlineStorePreparationModalProps> = ({
  open,
  orderId,
  onClose,
  onSuccess,
}) => {
  const [order, setOrder] = useState<StoreOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [preparedItems, setPreparedItems] = useState<Record<string | number, boolean>>({});

  const loadOrder = useCallback(async () => {
    if (!orderId || !open) return;
    setLoading(true);
    try {
      const data = await fetchOnlineStoreOrderById(orderId);
      setOrder(data);
      const initial: Record<string | number, boolean> = {};
      (data.items || []).forEach((item: StoreOrderItem, index: number) => {
        const key = item.id ?? `item-${index}`;
        initial[key] = false;
      });
      setPreparedItems(initial);
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, open]);

  useEffect(() => {
    if (open && orderId) void loadOrder();
    if (!open) {
      setOrder(null);
      setPreparedItems({});
      setConfirmOpen(false);
    }
  }, [open, orderId, loadOrder]);

  const togglePrepared = (itemId: string | number) => {
    setPreparedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const getItemKey = (item: StoreOrderItem, index: number) => item.id ?? `item-${index}`;
  const items = order?.items || [];
  const allPrepared =
    items.length > 0 && items.every((item, index) => preparedItems[getItemKey(item, index)]);
  const preparedCount = items.filter((item, index) => preparedItems[getItemKey(item, index)]).length;
  const deliveryCode = order?.deliveryType?.code;
  const isDelivery = deliveryCode === 'delivery';
  let readyButtonLabel = 'Marcar como listo para recoger';
  let readyConfirmMessage = '¿Marcar este pedido como listo para recoger? Se notificará al cliente.';
  if (isDelivery) {
    readyButtonLabel = 'Marcar como en camino';
    readyConfirmMessage = '¿Marcar este pedido como en camino? Se notificará al cliente.';
  }

  const handleMarkReadyClick = () => {
    if (!allPrepared || submitting) return;
    setConfirmOpen(true);
  };

  const handleConfirmMarkReady = async () => {
    setConfirmOpen(false);
    if (!order || order.status !== ORDER_STATUS.IN_PREPARATION) return;
    setSubmitting(true);
    try {
      await markOnlineStoreOrderReady(order.id);
      const msg = isDelivery
        ? 'Pedido marcado como en camino. El cliente ha sido notificado.'
        : 'Pedido marcado como listo. El cliente ha sido notificado.';
      onSuccess?.(msg);
      onClose?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo actualizar.';
      onSuccess?.(null, msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const deliveryLabel = order?.deliveryType?.name || 'Entrega';
  const deliveryIcon = isDelivery ? '🚚' : '📍';
  const deliveryText = isDelivery
    ? 'Marca cada producto al prepararlo y luego envía al cliente.'
    : 'Marca cada producto al prepararlo; el cliente pasará por su pedido.';

  const handleOverlayKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose?.();
  };

  return (
    <div
      className="cajero-prep-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cajero-prep-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      onKeyDown={handleOverlayKeyDown}
    >
      <div className="cajero-prep-modal">
        <header className="cajero-prep-modal-header">
          <h2 id="cajero-prep-modal-title" className="cajero-prep-modal-title">
            Preparar pedido
          </h2>
          <button type="button" className="cajero-prep-modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        {loading ? (
          <div className="cajero-prep-modal-loading">
            <div className="cajero-prep-modal-spinner" aria-hidden />
            <p>Cargando pedido...</p>
          </div>
        ) : !order ? (
          <div className="cajero-prep-modal-error">
            <p>No se pudo cargar el pedido.</p>
            <button type="button" className="cajero-prep-modal-btn-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        ) : order.status !== ORDER_STATUS.IN_PREPARATION ? (
          <div className="cajero-prep-modal-error">
            <p>Este pedido ya no está en preparación.</p>
            <button type="button" className="cajero-prep-modal-btn-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="cajero-prep-modal-folio">Folio {order.id}</div>

            <div className="cajero-prep-modal-delivery">
              <span className="cajero-prep-modal-delivery-icon" aria-hidden>
                {deliveryIcon}
              </span>
              <span className="cajero-prep-modal-delivery-label">{deliveryLabel}</span>
              <p className="cajero-prep-modal-delivery-text">{deliveryText}</p>
            </div>

            <div className="cajero-prep-modal-progress">
              <span className="cajero-prep-modal-progress-text">
                {preparedCount} de {items.length} productos preparados
              </span>
              <div className="cajero-prep-modal-progress-bar">
                <div
                  className="cajero-prep-modal-progress-fill"
                  style={{ width: items.length ? `${(preparedCount / items.length) * 100}%` : 0 }}
                />
              </div>
            </div>

            <div className="cajero-prep-modal-list">
              {items.map((item, index) => {
                const key = getItemKey(item, index);
                return (
                  <label
                    key={String(key)}
                    className={`cajero-prep-modal-item ${preparedItems[key] ? 'cajero-prep-modal-item--checked' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={preparedItems[key] || false}
                      onChange={() => togglePrepared(key)}
                      className="cajero-prep-modal-item-checkbox"
                      aria-label={`Preparado: ${item.productName ?? 'Producto'}`}
                    />
                    <span className="cajero-prep-modal-item-checkbox-custom" aria-hidden />
                    <div className="cajero-prep-modal-item-content">
                      <span className="cajero-prep-modal-item-name">{item.productName ?? 'Producto'}</span>
                      <span className="cajero-prep-modal-item-detail">
                        {item.quantity} × {formatPrice(item.unitPrice)}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>

            <footer className="cajero-prep-modal-footer">
              <button
                type="button"
                className="cajero-prep-modal-btn-primary cajero-prep-modal-btn-full"
                onClick={handleMarkReadyClick}
                disabled={!allPrepared || submitting}
              >
                {submitting ? 'Procesando...' : readyButtonLabel}
              </button>
              {!allPrepared && items.length > 0 && (
                <p className="cajero-prep-modal-footer-hint">
                  Marca todos los productos como preparados para continuar.
                </p>
              )}
            </footer>
          </>
        )}
      </div>

      {confirmOpen && (
        <div className="cajero-prep-confirm-overlay" role="alertdialog" aria-modal="true">
          <div className="cajero-prep-confirm-dialog">
            <h3 className="cajero-prep-confirm-title">¿Continuar?</h3>
            <p className="cajero-prep-confirm-message">{readyConfirmMessage}</p>
            <div className="cajero-prep-confirm-actions">
              <button
                type="button"
                className="cajero-prep-modal-btn-secondary"
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="cajero-prep-modal-btn-primary"
                onClick={() => void handleConfirmMarkReady()}
                disabled={submitting}
              >
                {submitting ? 'Procesando...' : 'Sí, continuar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnlineStorePreparationModal;
