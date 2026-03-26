import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchOnlineStoreOrderById,
  reviewOnlineStoreOrderAvailability,
  fetchOnlineStoreProductById,
  type StoreOrder,
  type StoreOrderItem,
  type StoreProductPreview,
} from '../../api/onlineStoreOrders';
import { ORDER_STATUS } from '../../constants/onlineStoreOrderStatus';

export interface OnlineStoreReviewModalProps {
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

const OnlineStoreReviewModal: React.FC<OnlineStoreReviewModalProps> = ({
  open,
  orderId,
  onClose,
  onSuccess,
}) => {
  const [order, setOrder] = useState<StoreOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productModalProduct, setProductModalProduct] = useState<StoreProductPreview | null>(null);
  const [productModalLoading, setProductModalLoading] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [itemAvailability, setItemAvailability] = useState<Record<number, boolean | null>>({});
  const [confirmedQuantity, setConfirmedQuantity] = useState<Record<number, number>>({});

  const loadOrder = useCallback(async () => {
    if (!orderId || !open) return;
    setLoading(true);
    try {
      const data = await fetchOnlineStoreOrderById(orderId);
      setOrder(data);
      const avail: Record<number, boolean | null> = {};
      const qty: Record<number, number> = {};
      (data.items || []).forEach((item: StoreOrderItem) => {
        avail[item.id] = item.isAvailable ?? null;
        qty[item.id] = item.confirmedQuantity ?? item.quantity;
      });
      setItemAvailability(avail);
      setConfirmedQuantity(qty);
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
      setItemAvailability({});
      setConfirmedQuantity({});
      setProductModalOpen(false);
      setProductModalProduct(null);
      setScannedBarcode('');
    }
  }, [open, orderId, loadOrder]);

  const handleItemAvailabilityChange = (itemId: number, isAvailable: boolean | null) => {
    setItemAvailability((prev) => ({ ...prev, [itemId]: isAvailable }));
  };

  const handleConfirmedQuantityChange = (itemId: number, value: string, max: number) => {
    const num = Math.min(max, Math.max(0, Number.parseInt(value, 10) || 0));
    setConfirmedQuantity((prev) => ({ ...prev, [itemId]: num }));
  };

  const canConfirm =
    Boolean(order?.items?.length) &&
    order!.items.every(
      (item) => itemAvailability[item.id] === true || itemAvailability[item.id] === false,
    );

  const handleConfirmClick = () => {
    if (!canConfirm || saving) return;
    setConfirmDialogOpen(true);
  };

  const handleProductNameClick = useCallback(async (item: StoreOrderItem) => {
    const productId = item.productId;
    if (!productId) return;
    setProductModalOpen(true);
    setProductModalProduct(null);
    setProductModalLoading(true);
    try {
      const data = await fetchOnlineStoreProductById(productId);
      setProductModalProduct(data);
    } catch {
      setProductModalProduct(null);
    } finally {
      setProductModalLoading(false);
    }
  }, []);

  const closeProductModal = useCallback(() => {
    setProductModalOpen(false);
    setProductModalProduct(null);
    setScannedBarcode('');
  }, []);

  const productCode = productModalProduct?.code?.trim() ?? '';
  const scannedTrimmed = scannedBarcode.trim();
  const barcodeMatch = scannedTrimmed !== '' && productCode !== '' && scannedTrimmed === productCode;
  const barcodeMismatch =
    scannedTrimmed !== '' && productCode !== '' && scannedTrimmed !== productCode;

  const handleConfirmAvailability = async () => {
    setConfirmDialogOpen(false);
    if (!order || order.status !== ORDER_STATUS.UNDER_REVIEW) return;
    const items = (order.items || []).map((item) => {
      const available = itemAvailability[item.id] === true;
      const qty = available
        ? (confirmedQuantity[item.id] != null ? confirmedQuantity[item.id] : item.quantity)
        : 0;
      return {
        itemId: item.id,
        isAvailable: available,
        confirmedQuantity: Math.min(Math.max(0, qty), item.quantity),
      };
    });
    setSaving(true);
    try {
      await reviewOnlineStoreOrderAvailability(order.id, items);
      onSuccess?.('Disponibilidad confirmada. El cliente ha sido notificado.');
      onClose?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo confirmar.';
      onSuccess?.(null, msg);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="cajero-review-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cajero-review-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="cajero-review-modal">
        <header className="cajero-review-modal-header">
          <h2 id="cajero-review-modal-title" className="cajero-review-modal-title">
            Confirmar disponibilidad
          </h2>
          <button type="button" className="cajero-review-modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        {loading ? (
          <div className="cajero-review-modal-loading">
            <div className="cajero-review-modal-spinner" aria-hidden />
            <p>Cargando pedido...</p>
          </div>
        ) : !order ? (
          <div className="cajero-review-modal-error">
            <p>No se pudo cargar el pedido.</p>
            <button type="button" className="cajero-review-modal-btn-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        ) : order.status !== ORDER_STATUS.UNDER_REVIEW ? (
          <div className="cajero-review-modal-error">
            <p>Este pedido ya no está en revisión.</p>
            <button type="button" className="cajero-review-modal-btn-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <p className="cajero-review-modal-hint">
              Marca la disponibilidad de cada producto. Al confirmar, se notificará al cliente.
            </p>

            <div className="cajero-review-modal-list">
              {(order.items || []).map((item) => (
                <div key={item.id} className="cajero-review-modal-item">
                  <div className="cajero-review-modal-item-info">
                    {item.productId ? (
                      <button
                        type="button"
                        className="cajero-review-modal-item-name cajero-review-modal-item-name-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleProductNameClick(item);
                        }}
                      >
                        {item.productName}
                      </button>
                    ) : (
                      <span className="cajero-review-modal-item-name">{item.productName}</span>
                    )}
                    <div className="cajero-review-modal-item-detail">
                      <span className="cajero-review-modal-item-qty">{item.quantity}</span>
                      <span className="cajero-review-modal-item-times"> × </span>
                      <span className="cajero-review-modal-item-price">{formatPrice(item.unitPrice)}</span>
                      <span className="cajero-review-modal-item-eq"> = </span>
                      <span className="cajero-review-modal-item-subtotal">{formatPrice(item.subtotal)}</span>
                    </div>
                  </div>
                  <div className="cajero-review-modal-item-actions">
                    <div className="cajero-review-modal-availability-btns">
                      <button
                        type="button"
                        className={`cajero-review-modal-av-btn ${
                          itemAvailability[item.id] === true ? 'cajero-review-modal-av-btn--available' : ''
                        }`}
                        aria-pressed={itemAvailability[item.id] === true}
                        onClick={() => handleItemAvailabilityChange(item.id, true)}
                        disabled={saving}
                      >
                        ✓ Disponible
                      </button>
                      <button
                        type="button"
                        className={`cajero-review-modal-av-btn ${
                          itemAvailability[item.id] === false ? 'cajero-review-modal-av-btn--unavailable' : ''
                        }`}
                        aria-pressed={itemAvailability[item.id] === false}
                        onClick={() => handleItemAvailabilityChange(item.id, false)}
                        disabled={saving}
                      >
                        ✕ No disponible
                      </button>
                      <button
                        type="button"
                        className={`cajero-review-modal-av-btn ${
                          (itemAvailability[item.id] ?? null) === null ? 'cajero-review-modal-av-btn--pending' : ''
                        }`}
                        aria-pressed={(itemAvailability[item.id] ?? null) === null}
                        onClick={() => handleItemAvailabilityChange(item.id, null)}
                        disabled={saving}
                      >
                        ? Pendiente
                      </button>
                    </div>
                    {itemAvailability[item.id] === true && (
                      <div className="cajero-review-modal-qty-wrap">
                        <label htmlFor={`cajero-review-qty-${item.id}`}>Cant. disponible:</label>
                        <input
                          id={`cajero-review-qty-${item.id}`}
                          type="number"
                          min={0}
                          max={item.quantity}
                          value={confirmedQuantity[item.id] ?? item.quantity}
                          onChange={(e) => handleConfirmedQuantityChange(item.id, e.target.value, item.quantity)}
                          className="cajero-review-modal-qty-input"
                          disabled={saving}
                        />
                        <span> de {item.quantity}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <footer className="cajero-review-modal-footer">
              <button
                type="button"
                className="cajero-review-modal-btn-primary cajero-review-modal-btn-full"
                onClick={handleConfirmClick}
                disabled={saving || !canConfirm}
              >
                {saving ? 'Confirmando...' : 'Confirmar disponibilidad'}
              </button>
              {!canConfirm && (order.items?.length ?? 0) > 0 && (
                <p className="cajero-review-modal-footer-hint">
                  Marca cada producto como Disponible o No disponible para habilitar.
                </p>
              )}
            </footer>
          </>
        )}
      </div>

      {productModalOpen && (
        <div
          className="cajero-review-product-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cajero-review-product-title"
          onClick={(e) => e.target === e.currentTarget && closeProductModal()}
        >
          <div className="cajero-review-product-modal">
            <div className="cajero-review-product-header">
              <h3 id="cajero-review-product-title">Producto</h3>
              <button
                type="button"
                className="cajero-review-product-close"
                onClick={closeProductModal}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            {productModalLoading ? (
              <div className="cajero-review-product-loading">
                <div className="cajero-review-modal-spinner" aria-hidden />
                <p>Cargando...</p>
              </div>
            ) : productModalProduct ? (
              <div className="cajero-review-product-body">
                <div className="cajero-review-product-image-wrap">
                  {productModalProduct.images && productModalProduct.images.length > 0 ? (
                    <img
                      src={productModalProduct.images[0].url}
                      alt=""
                      className="cajero-review-product-image"
                    />
                  ) : productModalProduct.icon ? (
                    <img src={productModalProduct.icon} alt="" className="cajero-review-product-image" />
                  ) : (
                    <div className="cajero-review-product-image-placeholder">Sin imagen</div>
                  )}
                </div>
                <p className="cajero-review-product-name">{productModalProduct.name}</p>
                <div className="cajero-review-product-code-wrap">
                  <span className="cajero-review-product-code-label">Código</span>
                  <span className="cajero-review-product-code-value">
                    {productModalProduct.code?.trim() || '—'}
                  </span>
                </div>
                <div className="cajero-review-product-scan-wrap">
                  <label htmlFor="cajero-review-scan-input" className="cajero-review-product-scan-label">
                    Escanear o ingresar código
                  </label>
                  <input
                    id="cajero-review-scan-input"
                    type="text"
                    className="cajero-review-product-scan-input"
                    placeholder="Pase el lector o escriba el código"
                    value={scannedBarcode}
                    onChange={(e) => setScannedBarcode(e.target.value)}
                    autoComplete="off"
                    aria-describedby="cajero-review-scan-result"
                  />
                  {barcodeMatch && (
                    <p
                      id="cajero-review-scan-result"
                      className="cajero-review-product-scan-result cajero-review-product-scan-result--ok"
                    >
                      ✓ Código correcto
                    </p>
                  )}
                  {barcodeMismatch && (
                    <p
                      id="cajero-review-scan-result"
                      className="cajero-review-product-scan-result cajero-review-product-scan-result--fail"
                    >
                      ✕ No coincide con el producto
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="cajero-review-product-error">
                <p>No se pudo cargar el producto.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {confirmDialogOpen && (
        <div
          className="cajero-review-confirm-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="cajero-review-confirm-title"
        >
          <div className="cajero-review-confirm-dialog">
            <h3 id="cajero-review-confirm-title" className="cajero-review-confirm-title">
              ¿Confirmar disponibilidad?
            </h3>
            <p className="cajero-review-confirm-message">
              Se notificará al cliente con la disponibilidad indicada. ¿Continuar?
            </p>
            <div className="cajero-review-confirm-actions">
              <button
                type="button"
                className="cajero-review-modal-btn-secondary"
                onClick={() => setConfirmDialogOpen(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="cajero-review-modal-btn-primary"
                onClick={() => void handleConfirmAvailability()}
                disabled={saving}
              >
                {saving ? 'Confirmando...' : 'Sí, confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnlineStoreReviewModal;
