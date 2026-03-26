import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { fetchOnlineStoreOrdersPage, fetchOnlineStoreOrderById, type StoreOrder } from '../../api/onlineStoreOrders';
import { ORDER_STATUS, STATUS_COLORS, STATUS_LABELS } from '../../constants/onlineStoreOrderStatus';
import OnlineStoreReviewModal from './OnlineStoreReviewModal';
import OnlineStorePreparationModal from './OnlineStorePreparationModal';
import OnlineStoreDeliveryModal from './OnlineStoreDeliveryModal';
import { IoRefreshOutline } from 'react-icons/io5';
import '../../styles/components/onlineStoreCajero.css';

const TAB_POR_HACER = 'por-hacer';
const TAB_CONFIRMADOS = 'confirmados';
const TAB_DISPONIBLES = 'disponibles';
const TAB_AYUDA = 'ayuda';

function getDeliveryTypeInfo(order: StoreOrder) {
  const code = order.deliveryType?.code;
  const name = order.deliveryType?.name || 'Entrega';
  if (code === 'delivery') {
    return {
      label: name,
      text: 'Preparar pedido para enviarlo al cliente.',
      icon: '🚚',
    };
  }
  return {
    label: name,
    text: 'El cliente pasará por su pedido.',
    icon: '📍',
  };
}

function getDeliveryAvailabilityInfo(order: StoreOrder) {
  const isTransit = order.status === ORDER_STATUS.IN_TRANSIT;
  return {
    label: isTransit ? 'En camino' : 'Listo para recoger',
    icon: isTransit ? '🚚' : '📍',
    text: isTransit
      ? 'Envío a domicilio. Marcar como entregado cuando el cliente reciba.'
      : 'Recoger en sucursal. Marcar como entregado cuando el cliente retire.',
  };
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);

function getRelativeTime(dateString: string) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

function sortOrdersNewestFirst(orderList: StoreOrder[]) {
  return [...orderList].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return dateB - dateA;
  });
}

async function fetchReviewOrdersSorted(): Promise<StoreOrder[]> {
  const dataReview = await fetchOnlineStoreOrdersPage(ORDER_STATUS.UNDER_REVIEW, 1, 100);
  const listReview = Array.isArray(dataReview?.orders) ? dataReview.orders : [];
  return sortOrdersNewestFirst(listReview);
}

async function fetchPreparationOrdersSorted(): Promise<StoreOrder[]> {
  const dataPrep = await fetchOnlineStoreOrdersPage(ORDER_STATUS.IN_PREPARATION, 1, 100);
  const listPrep = Array.isArray(dataPrep?.orders) ? dataPrep.orders : [];
  return sortOrdersNewestFirst(listPrep);
}

async function fetchDeliveryOrdersSorted(): Promise<StoreOrder[]> {
  const [dataReady, dataTransit] = await Promise.all([
    fetchOnlineStoreOrdersPage(ORDER_STATUS.READY_FOR_PICKUP, 1, 100),
    fetchOnlineStoreOrdersPage(ORDER_STATUS.IN_TRANSIT, 1, 100),
  ]);
  const listReady = Array.isArray(dataReady?.orders) ? dataReady.orders : [];
  const listTransit = Array.isArray(dataTransit?.orders) ? dataTransit.orders : [];
  return sortOrdersNewestFirst([...listReady, ...listTransit]);
}

const OnlineStoreCajeroPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState(TAB_POR_HACER);
  const [reviewOrders, setReviewOrders] = useState<StoreOrder[]>([]);
  const [preparationOrders, setPreparationOrders] = useState<StoreOrder[]>([]);
  const [deliveryOrders, setDeliveryOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewOrderId, setReviewOrderId] = useState<number | null>(null);
  const [preparationOrderId, setPreparationOrderId] = useState<number | null>(null);
  const [deliveryModalOrderId, setDeliveryModalOrderId] = useState<number | null>(null);
  const [lookupFolio, setLookupFolio] = useState('');
  const [lookupOrder, setLookupOrder] = useState<StoreOrder | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  /**
   * Pedidos nuevos + confirmados: siempre en segundo plano (urgentes), en cualquier pestaña del modal.
   * `silent`: no toast ni vaciar listas (p. ej. polling cada 30s).
   */
  const loadUrgentOrders = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    try {
      const [review, prep] = await Promise.all([
        fetchReviewOrdersSorted(),
        fetchPreparationOrdersSorted(),
      ]);
      setReviewOrders(review);
      setPreparationOrders(prep);
    } catch {
      if (!silent) {
        toast.error('No se pudieron cargar los pedidos nuevos o confirmados.');
        setReviewOrders([]);
        setPreparationOrders([]);
      }
    }
  }, []);

  const loadDeliveryOrders = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    try {
      setDeliveryOrders(await fetchDeliveryOrdersSorted());
    } catch {
      if (!silent) {
        toast.error('No se pudieron cargar los pedidos para entrega.');
        setDeliveryOrders([]);
      }
    }
  }, []);

  /** Sincroniza lista visible + urgentes al cambiar de pestaña. */
  useEffect(() => {
    let cancelled = false;
    const finish = () => {
      if (!cancelled) setLoading(false);
    };

    if (activeTab === TAB_AYUDA) {
      setLoading(false);
      void loadUrgentOrders({ silent: true });
      return () => {
        cancelled = true;
      };
    }

    if (activeTab === TAB_DISPONIBLES) {
      setLoading(true);
      void (async () => {
        try {
          await Promise.all([
            loadUrgentOrders({ silent: true }),
            loadDeliveryOrders({ silent: false }),
          ]);
        } finally {
          finish();
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    void (async () => {
      try {
        await loadUrgentOrders({ silent: false });
      } finally {
        finish();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, loadUrgentOrders, loadDeliveryOrders]);

  /** Polling: urgentes siempre que el panel está montado (modal pedidos abierto). */
  useEffect(() => {
    const interval = globalThis.setInterval(() => {
      void loadUrgentOrders({ silent: true });
    }, 30000);
    return () => globalThis.clearInterval(interval);
  }, [loadUrgentOrders]);

  /** Polling solo para «Disponibles para entrega». */
  useEffect(() => {
    if (activeTab !== TAB_DISPONIBLES) {
      return undefined;
    }
    const interval = globalThis.setInterval(() => {
      void loadDeliveryOrders({ silent: true });
    }, 30000);
    return () => globalThis.clearInterval(interval);
  }, [activeTab, loadDeliveryOrders]);

  const refreshForActiveTab = useCallback(async () => {
    if (activeTab === TAB_AYUDA) {
      await loadUrgentOrders({ silent: false });
      return;
    }
    setLoading(true);
    try {
      await loadUrgentOrders({ silent: false });
      if (activeTab === TAB_DISPONIBLES) {
        await loadDeliveryOrders({ silent: false });
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, loadDeliveryOrders, loadUrgentOrders]);

  const handleModalSuccess = (message?: string | null, errorMessage?: string | null) => {
    if (errorMessage) toast.error(errorMessage);
    else if (message) {
      toast.success(message);
      void loadUrgentOrders({ silent: true });
      if (activeTab === TAB_DISPONIBLES) {
        void loadDeliveryOrders({ silent: true });
      }
    }
  };

  const handleLookup = useCallback(async () => {
    const folio = String(lookupFolio ?? '').trim();
    if (!folio) {
      toast.error('Ingresa el número de folio del pedido.');
      return;
    }
    setLookupError(null);
    setLookupOrder(null);
    setLookupLoading(true);
    try {
      const data = await fetchOnlineStoreOrderById(folio);
      setLookupOrder(data);
    } catch {
      setLookupOrder(null);
      setLookupError('No se encontró un pedido con ese folio.');
    } finally {
      setLookupLoading(false);
    }
  }, [lookupFolio]);

  const hasReview = reviewOrders.length > 0;
  const hasPreparation = preparationOrders.length > 0;
  const hasPorHacer = hasReview;
  const hasConfirmados = hasPreparation;
  const hasDisponibles = deliveryOrders.length > 0;

  return (
    <div className="cajero-tienda-online">
      <div className="cajero-tienda-online-tabs-row">
        <div className="cajero-tienda-online-tabs" role="tablist" aria-label="Secciones del cajero">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === TAB_POR_HACER}
            aria-controls="cajero-tab-panel-por-hacer"
            id="cajero-tab-por-hacer"
            className={`cajero-tienda-online-tab ${activeTab === TAB_POR_HACER ? 'cajero-tienda-online-tab--active' : ''}`}
            onClick={() => setActiveTab(TAB_POR_HACER)}
          >
            Pedidos nuevos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === TAB_CONFIRMADOS}
            aria-controls="cajero-tab-panel-confirmados"
            id="cajero-tab-confirmados"
            className={`cajero-tienda-online-tab ${activeTab === TAB_CONFIRMADOS ? 'cajero-tienda-online-tab--active' : ''}`}
            onClick={() => setActiveTab(TAB_CONFIRMADOS)}
          >
            Pedidos confirmados
            {preparationOrders.length > 0 && (
              <span className="cajero-tienda-online-tab-count" aria-hidden>
                {preparationOrders.length}
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === TAB_DISPONIBLES}
            aria-controls="cajero-tab-panel-disponibles"
            id="cajero-tab-disponibles"
            className={`cajero-tienda-online-tab cajero-tienda-online-tab--secondary ${activeTab === TAB_DISPONIBLES ? 'cajero-tienda-online-tab--active' : ''}`}
            onClick={() => setActiveTab(TAB_DISPONIBLES)}
          >
            Disponibles para entrega
            {deliveryOrders.length > 0 && (
              <span className="cajero-tienda-online-tab-count" aria-hidden>
                {deliveryOrders.length}
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === TAB_AYUDA}
            aria-controls="cajero-tab-panel-ayuda"
            id="cajero-tab-ayuda"
            className={`cajero-tienda-online-tab cajero-tienda-online-tab--tertiary ${activeTab === TAB_AYUDA ? 'cajero-tienda-online-tab--active' : ''}`}
            onClick={() => setActiveTab(TAB_AYUDA)}
          >
            Ayuda al cliente
          </button>
        </div>
        <button
          type="button"
          className="cajero-tienda-online-refresh"
          onClick={() => void refreshForActiveTab()}
          disabled={loading || activeTab === TAB_AYUDA}
          aria-label={loading ? 'Actualizando pedidos' : 'Actualizar pedidos de esta pestaña'}
          title="Actualizar"
        >
          <IoRefreshOutline
            className={`cajero-tienda-online-refresh-icon${loading ? ' cajero-tienda-online-refresh-icon--spin' : ''}`}
            aria-hidden
          />
        </button>
      </div>

      {loading && activeTab !== TAB_AYUDA && (
        <div className="cajero-tienda-online-loading" aria-live="polite">
          <div className="cajero-tienda-online-spinner" aria-hidden />
          <p>Cargando pedidos...</p>
        </div>
      )}

      {!loading && activeTab === TAB_POR_HACER && !hasPorHacer && (
        <div
          className="cajero-tienda-online-empty"
          id="cajero-tab-panel-por-hacer"
          role="tabpanel"
          aria-labelledby="cajero-tab-por-hacer"
        >
          <span className="cajero-tienda-online-empty-icon" aria-hidden>
            📦
          </span>
          <p>No hay pedidos en revisión.</p>
        </div>
      )}
      {!loading && activeTab === TAB_POR_HACER && hasPorHacer && (
        <div
          className="cajero-tienda-online-sections"
          id="cajero-tab-panel-por-hacer"
          role="tabpanel"
          aria-labelledby="cajero-tab-por-hacer"
        >
          <section className="cajero-tienda-online-section" aria-labelledby="section-review-title">
            <h2 id="section-review-title" className="cajero-tienda-online-section-title">
              En revisión
            </h2>
            <p className="cajero-tienda-online-section-desc">Confirma disponibilidad y notifica al cliente.</p>
            <ul className="cajero-tienda-online-list">
              {reviewOrders.map((order) => {
                const itemCount = order.items?.length ?? 0;
                const clientName = order.user?.name || order.user?.email || '—';
                const showNewBadge = order.status === ORDER_STATUS.UNDER_REVIEW;
                return (
                  <li key={`review-${order.id}`} className="cajero-tienda-online-card">
                    <button
                      type="button"
                      className="cajero-tienda-online-card-inner"
                      onClick={() => setReviewOrderId(order.id)}
                      aria-label={`Revisar pedido ${order.id}, ${clientName}`}
                    >
                      <div className="cajero-tienda-online-card-top">
                        <div className="cajero-tienda-online-card-folio-wrap">
                          <span className="cajero-tienda-online-card-folio">
                            Folio <strong>{order.id}</strong>
                          </span>
                          {showNewBadge && (
                            <span className="cajero-tienda-online-card-badge" aria-hidden>
                              Nuevo
                            </span>
                          )}
                        </div>
                        <span className="cajero-tienda-online-card-time">{getRelativeTime(order.createdAt)}</span>
                      </div>
                      <div className="cajero-tienda-online-card-body">
                        <div className="cajero-tienda-online-card-row">
                          <span className="cajero-tienda-online-card-label">Cliente</span>
                          <span className="cajero-tienda-online-card-value cajero-tienda-online-card-client-name">
                            {clientName}
                          </span>
                        </div>
                        <div className="cajero-tienda-online-card-row cajero-tienda-online-card-row--footer">
                          <span className="cajero-tienda-online-card-meta">
                            {itemCount} {itemCount === 1 ? 'producto' : 'productos'}
                          </span>
                          <span className="cajero-tienda-online-card-total">{formatPrice(order.total)}</span>
                        </div>
                      </div>
                      <span className="cajero-tienda-online-card-cta">Revisar disponibilidad →</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}

      {!loading && activeTab === TAB_CONFIRMADOS && !hasConfirmados && (
        <div
          className="cajero-tienda-online-empty"
          id="cajero-tab-panel-confirmados"
          role="tabpanel"
          aria-labelledby="cajero-tab-confirmados"
        >
          <span className="cajero-tienda-online-empty-icon" aria-hidden>
            📦
          </span>
          <p>No hay pedidos en preparación.</p>
        </div>
      )}
      {!loading && activeTab === TAB_CONFIRMADOS && hasConfirmados && (
        <div
          className="cajero-tienda-online-sections"
          id="cajero-tab-panel-confirmados"
          role="tabpanel"
          aria-labelledby="cajero-tab-confirmados"
        >
          <section className="cajero-tienda-online-section" aria-labelledby="section-prep-title">
            <h2
              id="section-prep-title"
              className="cajero-tienda-online-section-title cajero-tienda-online-section-title--priority"
            >
              Pedidos confirmados
            </h2>
            <p className="cajero-tienda-online-section-desc">
              Prioridad: preparar para recoger en sucursal o enviar a domicilio.
            </p>
            <ul className="cajero-tienda-online-list">
              {preparationOrders.map((order) => {
                const itemCount = order.items?.length ?? 0;
                const clientName = order.user?.name || order.user?.email || '—';
                const deliveryInfo = getDeliveryTypeInfo(order);
                return (
                  <li key={`prep-${order.id}`} className="cajero-tienda-online-card cajero-tienda-online-card--preparation">
                    <button
                      type="button"
                      className="cajero-tienda-online-card-inner"
                      onClick={() => setPreparationOrderId(order.id)}
                      aria-label={`Ver pedido ${order.id}, ${clientName}`}
                    >
                      <div className="cajero-tienda-online-card-top">
                        <div className="cajero-tienda-online-card-folio-wrap">
                          <span className="cajero-tienda-online-card-folio">
                            Folio <strong>{order.id}</strong>
                          </span>
                          <span
                            className="cajero-tienda-online-card-badge cajero-tienda-online-card-badge--confirmado"
                            aria-hidden
                          >
                            Confirmado
                          </span>
                        </div>
                        <span className="cajero-tienda-online-card-time">{getRelativeTime(order.createdAt)}</span>
                      </div>
                      <div className="cajero-tienda-online-card-delivery">
                        <span className="cajero-tienda-online-card-delivery-icon" aria-hidden>
                          {deliveryInfo.icon}
                        </span>
                        <span className="cajero-tienda-online-card-delivery-label">{deliveryInfo.label}</span>
                        <p className="cajero-tienda-online-card-delivery-text">{deliveryInfo.text}</p>
                      </div>
                      <div className="cajero-tienda-online-card-body">
                        <div className="cajero-tienda-online-card-row">
                          <span className="cajero-tienda-online-card-label">Cliente</span>
                          <span className="cajero-tienda-online-card-value cajero-tienda-online-card-client-name">
                            {clientName}
                          </span>
                        </div>
                        <div className="cajero-tienda-online-card-row cajero-tienda-online-card-row--footer">
                          <span className="cajero-tienda-online-card-meta">
                            {itemCount} {itemCount === 1 ? 'producto' : 'productos'}
                          </span>
                          <span className="cajero-tienda-online-card-total">{formatPrice(order.total)}</span>
                        </div>
                      </div>
                      <span className="cajero-tienda-online-card-cta">Ver detalle / Preparar →</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}

      {!loading && activeTab === TAB_DISPONIBLES && !hasDisponibles && (
        <div
          className="cajero-tienda-online-empty"
          id="cajero-tab-panel-disponibles"
          role="tabpanel"
          aria-labelledby="cajero-tab-disponibles"
        >
          <span className="cajero-tienda-online-empty-icon" aria-hidden>
            ✅
          </span>
          <p>No hay pedidos listos para recoger ni en camino.</p>
        </div>
      )}
      {!loading && activeTab === TAB_DISPONIBLES && hasDisponibles && (
        <div
          className="cajero-tienda-online-sections"
          id="cajero-tab-panel-disponibles"
          role="tabpanel"
          aria-labelledby="cajero-tab-disponibles"
        >
          <section className="cajero-tienda-online-section" aria-labelledby="section-delivery-title">
            <h2
              id="section-delivery-title"
              className="cajero-tienda-online-section-title cajero-tienda-online-section-title--delivery"
            >
              Disponibles para entrega
            </h2>
            <p className="cajero-tienda-online-section-desc">
              Listos para recoger en sucursal o en camino a domicilio. Valida con el cliente y marca como entregado o
              cancela si aplica.
            </p>
            <ul className="cajero-tienda-online-list">
              {deliveryOrders.map((order) => {
                const itemCount = order.items?.length ?? 0;
                const clientName = order.user?.name || order.user?.email || '—';
                const deliveryInfo = getDeliveryAvailabilityInfo(order);
                return (
                  <li key={`delivery-${order.id}`} className="cajero-tienda-online-card cajero-tienda-online-card--delivery">
                    <button
                      type="button"
                      className="cajero-tienda-online-card-inner"
                      onClick={() => setDeliveryModalOrderId(order.id)}
                      aria-label={`Entregar pedido ${order.id}, ${clientName}`}
                    >
                      <div className="cajero-tienda-online-card-top">
                        <div className="cajero-tienda-online-card-folio-wrap">
                          <span className="cajero-tienda-online-card-folio">
                            Folio <strong>{order.id}</strong>
                          </span>
                          <span className="cajero-tienda-online-card-badge cajero-tienda-online-card-badge--delivery" aria-hidden>
                            {deliveryInfo.label}
                          </span>
                        </div>
                        <span className="cajero-tienda-online-card-time">
                          {getRelativeTime(order.readyAt || order.updatedAt || order.createdAt)}
                        </span>
                      </div>
                      <div className="cajero-tienda-online-card-delivery">
                        <span className="cajero-tienda-online-card-delivery-icon" aria-hidden>
                          {deliveryInfo.icon}
                        </span>
                        <span className="cajero-tienda-online-card-delivery-label">{deliveryInfo.label}</span>
                        <p className="cajero-tienda-online-card-delivery-text">{deliveryInfo.text}</p>
                      </div>
                      <div className="cajero-tienda-online-card-body">
                        <div className="cajero-tienda-online-card-row">
                          <span className="cajero-tienda-online-card-label">Cliente</span>
                          <span className="cajero-tienda-online-card-value cajero-tienda-online-card-client-name">
                            {clientName}
                          </span>
                        </div>
                        <div className="cajero-tienda-online-card-row cajero-tienda-online-card-row--footer">
                          <span className="cajero-tienda-online-card-meta">
                            {itemCount} {itemCount === 1 ? 'producto' : 'productos'}
                          </span>
                          <span className="cajero-tienda-online-card-total">{formatPrice(order.total)}</span>
                        </div>
                      </div>
                      <span className="cajero-tienda-online-card-cta">Entregar →</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}

      {activeTab === TAB_AYUDA && (
        <div
          className="cajero-tienda-online-ayuda"
          id="cajero-tab-panel-ayuda"
          role="tabpanel"
          aria-labelledby="cajero-tab-ayuda"
        >
          <h2 id="cajero-ayuda-title" className="cajero-tienda-online-ayuda-title">
            Consultar estado del pedido
          </h2>
          <p className="cajero-tienda-online-ayuda-desc">
            El cliente puede indicar su número de folio para ver el estado actual del pedido. Solo consulta, sin
            acciones.
          </p>
          <div className="cajero-tienda-online-ayuda-form">
            <label htmlFor="cajero-ayuda-folio" className="cajero-tienda-online-ayuda-label">
              Número de folio
            </label>
            <div className="cajero-tienda-online-ayuda-row">
              <input
                id="cajero-ayuda-folio"
                type="text"
                inputMode="numeric"
                placeholder="Ej: 42"
                className="cajero-tienda-online-ayuda-input"
                value={lookupFolio}
                onChange={(e) => {
                  setLookupFolio(e.target.value);
                  setLookupError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && void handleLookup()}
                aria-describedby="cajero-ayuda-hint"
              />
              <button
                type="button"
                className="cajero-tienda-online-ayuda-btn"
                onClick={() => void handleLookup()}
                disabled={lookupLoading}
              >
                {lookupLoading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
            <p id="cajero-ayuda-hint" className="cajero-tienda-online-ayuda-hint">
              Ingresa el folio que aparece en la confirmación del pedido.
            </p>
          </div>

          {lookupLoading && (
            <div className="cajero-tienda-online-ayuda-loading" aria-live="polite">
              <div className="cajero-tienda-online-spinner" aria-hidden />
              <p>Buscando pedido...</p>
            </div>
          )}
          {lookupError && !lookupLoading && (
            <div className="cajero-tienda-online-ayuda-error" role="alert">
              <span className="cajero-tienda-online-ayuda-error-icon" aria-hidden>
                ⚠
              </span>
              <p>{lookupError}</p>
            </div>
          )}
          {lookupOrder && !lookupLoading && (
            <div className="cajero-tienda-online-ayuda-result">
              <div
                className="cajero-tienda-online-ayuda-card"
                style={
                  {
                    '--status-color': STATUS_COLORS[lookupOrder.status] || '#64748b',
                  } as React.CSSProperties
                }
              >
                <div className="cajero-tienda-online-ayuda-card-header">
                  <span className="cajero-tienda-online-ayuda-card-folio">
                    Folio <strong>{lookupOrder.id}</strong>
                  </span>
                  <span
                    className="cajero-tienda-online-ayuda-card-status"
                    style={{
                      backgroundColor: `${STATUS_COLORS[lookupOrder.status] || '#64748b'}22`,
                      color: STATUS_COLORS[lookupOrder.status] || '#475569',
                      borderColor: `${STATUS_COLORS[lookupOrder.status] || '#64748b'}44`,
                    }}
                  >
                    {STATUS_LABELS[lookupOrder.status] ?? lookupOrder.status}
                  </span>
                </div>
                <div className="cajero-tienda-online-ayuda-card-body">
                  <div className="cajero-tienda-online-ayuda-card-row">
                    <span className="cajero-tienda-online-ayuda-card-label">Cliente</span>
                    <span className="cajero-tienda-online-ayuda-card-value">
                      {lookupOrder.user?.name || lookupOrder.user?.email || '—'}
                    </span>
                  </div>
                  <div className="cajero-tienda-online-ayuda-card-row">
                    <span className="cajero-tienda-online-ayuda-card-label">Fecha</span>
                    <span className="cajero-tienda-online-ayuda-card-value">
                      {lookupOrder.createdAt
                        ? new Date(lookupOrder.createdAt).toLocaleString('es-MX', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </span>
                  </div>
                  <div className="cajero-tienda-online-ayuda-card-row">
                    <span className="cajero-tienda-online-ayuda-card-label">Entrega</span>
                    <span className="cajero-tienda-online-ayuda-card-value">
                      {lookupOrder.deliveryType?.name ?? '—'}
                    </span>
                  </div>
                  <div className="cajero-tienda-online-ayuda-card-row cajero-tienda-online-ayuda-card-row--total">
                    <span className="cajero-tienda-online-ayuda-card-label">Total</span>
                    <span className="cajero-tienda-online-ayuda-card-value">{formatPrice(lookupOrder.total)}</span>
                  </div>
                </div>
                <p className="cajero-tienda-online-ayuda-card-note" aria-live="polite">
                  Solo consulta. Para gestionar el pedido usa «Pedidos nuevos», «Pedidos confirmados» o «Disponibles para
                  entrega».
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <OnlineStoreDeliveryModal
        open={Boolean(deliveryModalOrderId)}
        orderId={deliveryModalOrderId}
        onClose={() => setDeliveryModalOrderId(null)}
        onSuccess={handleModalSuccess}
      />
      <OnlineStoreReviewModal
        open={Boolean(reviewOrderId)}
        orderId={reviewOrderId}
        onClose={() => setReviewOrderId(null)}
        onSuccess={handleModalSuccess}
      />
      <OnlineStorePreparationModal
        open={Boolean(preparationOrderId)}
        orderId={preparationOrderId}
        onClose={() => setPreparationOrderId(null)}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
};

export default OnlineStoreCajeroPanel;
