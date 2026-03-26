import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchOnlineStoreOrderById,
  patchOnlineStoreOrderStatus,
  cancelOnlineStoreOrder,
  type StoreOrder,
} from '../../api/onlineStoreOrders';
import { ORDER_STATUS } from '../../constants/onlineStoreOrderStatus';
import {
  geocodeAddressForDelivery,
  openStreetMapEmbedUrl,
  formatCoordsForDisplay,
  type GeoPoint,
} from '../../utils/geocodeAddress';

export interface OnlineStoreDeliveryModalProps {
  open: boolean;
  orderId: number | null;
  onClose: () => void;
  onSuccess: (message?: string | null, errorMessage?: string | null) => void;
}

const CANCELLATION_REASONS = [
  { id: 'no_show', label: 'Cliente no se presentó' },
  { id: 'client_refused', label: 'Cliente ya no quiere el pedido' },
  { id: 'wrong_address', label: 'Dirección incorrecta o no encontrada' },
  { id: 'damaged', label: 'Producto dañado o incorrecto' },
  { id: 'other', label: 'Otro' },
] as const;

type Step = 'main' | 'confirm-delivered' | 'cancel' | 'confirm-cancel';

const formatPrice = (price: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price ?? 0);

const OnlineStoreDeliveryModal: React.FC<OnlineStoreDeliveryModalProps> = ({
  open,
  orderId,
  onClose,
  onSuccess,
}) => {
  const [order, setOrder] = useState<StoreOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>('main');
  const [cancelReasonId, setCancelReasonId] = useState('');
  const [cancelReasonOther, setCancelReasonOther] = useState('');
  const [deliveryGeoPoint, setDeliveryGeoPoint] = useState<GeoPoint | null>(null);
  const [deliveryGeoLoading, setDeliveryGeoLoading] = useState(false);
  const [deliveryDomicilioOpen, setDeliveryDomicilioOpen] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!orderId || !open) return;
    setLoading(true);
    try {
      const data = await fetchOnlineStoreOrderById(orderId);
      setOrder(data);
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
      setStep('main');
      setCancelReasonId('');
      setCancelReasonOther('');
      setDeliveryGeoPoint(null);
      setDeliveryGeoLoading(false);
      setDeliveryDomicilioOpen(false);
    }
  }, [open, orderId, loadOrder]);

  const isDeliveryReady =
    order?.status === ORDER_STATUS.READY_FOR_PICKUP || order?.status === ORDER_STATUS.IN_TRANSIT;
  const isInTransitDelivery =
    order?.status === ORDER_STATUS.IN_TRANSIT && order?.deliveryType?.code === 'delivery';
  const deliveryAddressText = (order?.deliveryAddress ?? '').trim();

  useEffect(() => {
    if (!open || !isInTransitDelivery || !deliveryAddressText) {
      setDeliveryGeoPoint(null);
      setDeliveryGeoLoading(false);
      return;
    }
    let cancelled = false;
    setDeliveryGeoLoading(true);
    setDeliveryGeoPoint(null);
    void geocodeAddressForDelivery(deliveryAddressText).then((pt) => {
      if (cancelled) return;
      setDeliveryGeoPoint(pt);
      setDeliveryGeoLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, isInTransitDelivery, deliveryAddressText]);
  const mapEmbedSrc =
    deliveryAddressText.length > 0 && !deliveryGeoLoading
      ? deliveryGeoPoint
        ? openStreetMapEmbedUrl(deliveryGeoPoint.lat, deliveryGeoPoint.lng)
        : `https://maps.google.com/maps?q=${encodeURIComponent(deliveryAddressText)}&hl=es&z=18&output=embed`
      : null;
  const mapsOpenByAddressUrl =
    deliveryAddressText.length > 0
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(deliveryAddressText)}`
      : null;
  const mapsOpenByCoordsUrl = deliveryGeoPoint
    ? `https://www.google.com/maps/search/?api=1&query=${deliveryGeoPoint.lat},${deliveryGeoPoint.lng}`
    : null;
  const wazeNavigateUrl = deliveryGeoPoint
    ? `https://www.waze.com/ul?ll=${deliveryGeoPoint.lat}%2C${deliveryGeoPoint.lng}&navigate=yes`
    : null;
  const items = order?.items || [];
  const deliveryLabel =
    order?.status === ORDER_STATUS.IN_TRANSIT ? 'En camino' : 'Listo para recoger';
  const deliveryIcon = order?.status === ORDER_STATUS.IN_TRANSIT ? '🚚' : '📍';

  const handleOpenConfirmDelivered = () => setStep('confirm-delivered');
  const handleOpenCancel = () => setStep('cancel');
  const handleBackToMain = () => setStep('main');

  const handleConfirmDelivered = async () => {
    if (!order || !isDeliveryReady) return;
    setSubmitting(true);
    try {
      const deliveredAt = new Date().toISOString();
      await patchOnlineStoreOrderStatus(order.id, ORDER_STATUS.COMPLETED, deliveredAt);
      onSuccess?.('Pedido marcado como entregado.');
      onClose?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo marcar como entregado.';
      onSuccess?.(null, msg);
    } finally {
      setSubmitting(false);
    }
  };

  const getCancelReasonText = () => {
    if (cancelReasonId === 'other') return cancelReasonOther.trim() || 'Otro';
    const r = CANCELLATION_REASONS.find((x) => x.id === cancelReasonId);
    return r ? r.label : cancelReasonOther.trim() || 'Cancelado';
  };

  const handleConfirmCancel = async () => {
    if (!order || !isDeliveryReady) return;
    const reason = getCancelReasonText();
    if (!reason) {
      onSuccess?.(null, 'Indica un motivo de cancelación.');
      return;
    }
    setSubmitting(true);
    try {
      await cancelOnlineStoreOrder(order.id, reason);
      onSuccess?.('Pedido cancelado.');
      onClose?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo cancelar el pedido.';
      onSuccess?.(null, msg);
    } finally {
      setSubmitting(false);
    }
  };

  const canConfirmCancel =
    Boolean(cancelReasonId) && (cancelReasonId !== 'other' || cancelReasonOther.trim().length > 0);

  const handleOverlayKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && step === 'main') onClose?.();
  };

  if (!open) return null;

  let stepTitle = 'Confirmar entrega';
  if (step === 'confirm-delivered') stepTitle = '¿Marcar como entregado?';
  else if (step === 'cancel') stepTitle = 'Cancelar pedido';
  else if (step === 'confirm-cancel') stepTitle = '¿Cancelar este pedido?';

  return (
    <div
      className="cajero-delivery-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cajero-delivery-modal-title"
      onClick={(e) => e.target === e.currentTarget && step === 'main' && onClose?.()}
      onKeyDown={handleOverlayKeyDown}
    >
      <div className="cajero-delivery-modal">
        <header className="cajero-delivery-modal-header">
          <h2 id="cajero-delivery-modal-title" className="cajero-delivery-modal-title">
            {stepTitle}
          </h2>
          <button type="button" className="cajero-delivery-modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        {loading ? (
          <div className="cajero-delivery-modal-loading">
            <div className="cajero-delivery-modal-spinner" aria-hidden />
            <p>Cargando pedido...</p>
          </div>
        ) : !order ? (
          <div className="cajero-delivery-modal-error">
            <p>No se pudo cargar el pedido.</p>
            <button type="button" className="cajero-delivery-modal-btn-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        ) : !isDeliveryReady ? (
          <div className="cajero-delivery-modal-error">
            <p>Este pedido no está listo para entrega.</p>
            <button type="button" className="cajero-delivery-modal-btn-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        ) : step === 'confirm-delivered' ? (
          <div className="cajero-delivery-modal-step">
            <p className="cajero-delivery-modal-step-desc">
              Confirma que el cliente recibió el pedido correctamente. Esta acción no se puede deshacer.
            </p>
            {isInTransitDelivery && deliveryAddressText && (
              <p className="cajero-delivery-modal-step-address" aria-label="Dirección de entrega">
                <strong>Dirección:</strong> {deliveryAddressText}
                {deliveryGeoPoint && (
                  <>
                    <br />
                    <strong>GPS (punto en mapa):</strong>{' '}
                    <code className="cajero-delivery-modal-step-coords">
                      {formatCoordsForDisplay(deliveryGeoPoint.lat, deliveryGeoPoint.lng)}
                    </code>
                  </>
                )}
              </p>
            )}
            <div className="cajero-delivery-modal-actions">
              <button
                type="button"
                className="cajero-delivery-modal-btn-secondary"
                onClick={handleBackToMain}
                disabled={submitting}
              >
                Volver
              </button>
              <button
                type="button"
                className="cajero-delivery-modal-btn-primary cajero-delivery-modal-btn-success"
                onClick={() => void handleConfirmDelivered()}
                disabled={submitting}
              >
                {submitting ? 'Procesando...' : 'Sí, marcar como entregado'}
              </button>
            </div>
          </div>
        ) : step === 'confirm-cancel' ? (
          <div className="cajero-delivery-modal-step">
            <p className="cajero-delivery-modal-step-desc">
              Se notificará al cliente. El pedido quedará cancelado con el motivo indicado.
            </p>
            {cancelReasonId && (
              <div className="cajero-delivery-modal-reason-preview">
                <span className="cajero-delivery-modal-reason-label">Motivo:</span> {getCancelReasonText()}
              </div>
            )}
            <div className="cajero-delivery-modal-actions">
              <button
                type="button"
                className="cajero-delivery-modal-btn-secondary"
                onClick={() => setStep('cancel')}
                disabled={submitting}
              >
                Volver
              </button>
              <button
                type="button"
                className="cajero-delivery-modal-btn-danger"
                onClick={() => void handleConfirmCancel()}
                disabled={submitting}
              >
                {submitting ? 'Procesando...' : 'Sí, cancelar pedido'}
              </button>
            </div>
          </div>
        ) : step === 'cancel' ? (
          <div className="cajero-delivery-modal-step">
            <p className="cajero-delivery-modal-step-desc">
              Indica el motivo de la cancelación (el cliente será notificado).
            </p>
            <fieldset className="cajero-delivery-modal-reasons">
              <legend className="cajero-delivery-modal-reason-title">Motivo de cancelación</legend>
              {CANCELLATION_REASONS.map((reason) => (
                <label
                  key={reason.id}
                  className={`cajero-delivery-modal-reason-option ${cancelReasonId === reason.id ? 'cajero-delivery-modal-reason-option--selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="cancelReason"
                    value={reason.id}
                    checked={cancelReasonId === reason.id}
                    onChange={() => setCancelReasonId(reason.id)}
                    className="cajero-delivery-modal-reason-radio"
                  />
                  <span className="cajero-delivery-modal-reason-text">{reason.label}</span>
                </label>
              ))}
            </fieldset>
            {cancelReasonId === 'other' && (
              <div className="cajero-delivery-modal-reason-other">
                <label htmlFor="cajero-delivery-other-reason" className="cajero-delivery-modal-reason-other-label">
                  Escribe el motivo (opcional pero recomendado)
                </label>
                <textarea
                  id="cajero-delivery-other-reason"
                  className="cajero-delivery-modal-reason-other-input"
                  placeholder="Ej: Cliente solicitó cancelación por cambio de domicilio"
                  value={cancelReasonOther}
                  onChange={(e) => setCancelReasonOther(e.target.value)}
                  rows={3}
                />
              </div>
            )}
            <div className="cajero-delivery-modal-actions cajero-delivery-modal-actions--spaced">
              <button
                type="button"
                className="cajero-delivery-modal-btn-secondary"
                onClick={handleBackToMain}
                disabled={submitting}
              >
                Volver
              </button>
              <button
                type="button"
                className="cajero-delivery-modal-btn-danger"
                onClick={() => setStep('confirm-cancel')}
                disabled={!canConfirmCancel || submitting}
              >
                Continuar a cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="cajero-delivery-modal-folio">Folio {order.id}</div>
            <div className="cajero-delivery-modal-delivery-badge">
              <span className="cajero-delivery-modal-delivery-icon" aria-hidden>
                {deliveryIcon}
              </span>
              <span className="cajero-delivery-modal-delivery-label">{deliveryLabel}</span>
            </div>
            <p className="cajero-delivery-modal-validation-hint">
              Valida con el cliente que los productos coincidan antes de marcar como entregado o cancelar.
            </p>
            {isInTransitDelivery && (
              <div className="cajero-delivery-modal-accordion">
                <button
                  type="button"
                  id="cajero-delivery-domicilio-trigger"
                  className="cajero-delivery-modal-accordion-trigger"
                  aria-expanded={deliveryDomicilioOpen}
                  aria-controls="cajero-delivery-domicilio-panel"
                  onClick={() => setDeliveryDomicilioOpen((prev) => !prev)}
                >
                  <span className="cajero-delivery-modal-accordion-chevron" aria-hidden>
                    {deliveryDomicilioOpen ? '▼' : '▶'}
                  </span>
                  <span className="cajero-delivery-modal-accordion-trigger-main">
                    {deliveryDomicilioOpen ? 'Ocultar domicilio' : 'Ver domicilio'}
                  </span>
                  <span className="cajero-delivery-modal-accordion-trigger-sub">Mapa y dirección</span>
                </button>
                {deliveryDomicilioOpen && (
                  <section
                    id="cajero-delivery-domicilio-panel"
                    className="cajero-delivery-modal-accordion-panel"
                    aria-labelledby="cajero-delivery-domicilio-trigger"
                  >
                    <h3 className="cajero-delivery-modal-route-title cajero-delivery-modal-route-title--in-panel">
                      Entrega a domicilio
                    </h3>
                    {deliveryAddressText ? (
                      <>
                        <p className="cajero-delivery-modal-route-address">{deliveryAddressText}</p>
                        <div className="cajero-delivery-modal-map-legend" role="note">
                          <span className="cajero-delivery-modal-map-legend-icon" aria-hidden>
                            📍
                          </span>
                          <div className="cajero-delivery-modal-map-legend-body">
                            <strong className="cajero-delivery-modal-map-legend-title">
                              Ubicación del cliente
                            </strong>
                            <p className="cajero-delivery-modal-map-legend-text">
                              {deliveryGeoLoading
                                ? 'Buscando el punto exacto en el mapa…'
                                : deliveryGeoPoint
                                  ? 'La banderita amarilla y negra en el mapa señala el punto de entrega.'
                                  : 'No se pudo fijar coordenadas: el mapa es aproximado por la dirección. Confirma en sitio con el cliente.'}
                            </p>
                          </div>
                        </div>
                        <div className="cajero-delivery-modal-map-wrap">
                          {deliveryGeoLoading ? (
                            <div className="cajero-delivery-modal-map-loading">
                              <div className="cajero-delivery-modal-map-loading-spinner" aria-hidden />
                              <p>Localizando dirección…</p>
                            </div>
                          ) : mapEmbedSrc ? (
                            <iframe
                              title="Mapa de la dirección de entrega"
                              className="cajero-delivery-modal-map-frame"
                              src={mapEmbedSrc}
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                              allowFullScreen
                            />
                          ) : null}
                        </div>
                        {deliveryGeoPoint && (
                          <>
                            <p className="cajero-delivery-modal-map-coords">
                              <span className="cajero-delivery-modal-map-coords-label">Coordenadas (GPS):</span>{' '}
                              <code className="cajero-delivery-modal-map-coords-value">
                                {formatCoordsForDisplay(deliveryGeoPoint.lat, deliveryGeoPoint.lng)}
                              </code>
                            </p>
                            <div className="cajero-delivery-modal-map-links-row">
                              {mapsOpenByCoordsUrl && (
                                <a
                                  href={mapsOpenByCoordsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="cajero-delivery-modal-map-link"
                                >
                                  Abrir punto en Google Maps
                                </a>
                              )}
                              {wazeNavigateUrl && (
                                <a
                                  href={wazeNavigateUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="cajero-delivery-modal-map-link"
                                >
                                  Navegar con Waze
                                </a>
                              )}
                              {mapsOpenByAddressUrl && (
                                <a
                                  href={mapsOpenByAddressUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="cajero-delivery-modal-map-link"
                                >
                                  Google Maps (texto dirección)
                                </a>
                              )}
                            </div>
                          </>
                        )}
                        {!deliveryGeoPoint && !deliveryGeoLoading && mapsOpenByAddressUrl && (
                          <a
                            href={mapsOpenByAddressUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cajero-delivery-modal-map-link cajero-delivery-modal-map-link--solo"
                          >
                            Abrir dirección en Google Maps
                          </a>
                        )}
                      </>
                    ) : (
                      <p className="cajero-delivery-modal-route-missing">
                        No hay dirección registrada en el pedido. Consulta al cliente o en administración.
                      </p>
                    )}
                  </section>
                )}
              </div>
            )}
            <div className="cajero-delivery-modal-products">
              <h3 className="cajero-delivery-modal-products-title">Productos a entregar</h3>
              <ul className="cajero-delivery-modal-products-list">
                {items.map((item, index) => (
                  <li key={item.id ?? `item-${index}`} className="cajero-delivery-modal-product">
                    <span className="cajero-delivery-modal-product-check" aria-hidden>
                      ✓
                    </span>
                    <div className="cajero-delivery-modal-product-content">
                      <span className="cajero-delivery-modal-product-name">
                        {item.productName ?? 'Producto'}
                      </span>
                      <span className="cajero-delivery-modal-product-detail">
                        {item.quantity} × {formatPrice(item.unitPrice)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="cajero-delivery-modal-total">
              Total: <strong>{formatPrice(order.total)}</strong>
            </div>
            <footer className="cajero-delivery-modal-footer">
              <button
                type="button"
                className="cajero-delivery-modal-btn-secondary cajero-delivery-modal-btn-half"
                onClick={handleOpenCancel}
                disabled={submitting}
              >
                Cancelar pedido
              </button>
              <button
                type="button"
                className="cajero-delivery-modal-btn-primary cajero-delivery-modal-btn-success cajero-delivery-modal-btn-half"
                onClick={handleOpenConfirmDelivered}
                disabled={submitting}
              >
                ✓ Entregado
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
};

export default OnlineStoreDeliveryModal;
