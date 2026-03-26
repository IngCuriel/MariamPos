import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import { fetchOnlineStoreOrdersPage, type StoreOrder, type OrdersPagination } from '../../api/onlineStoreOrders';
import { ORDER_STATUS } from '../../constants/onlineStoreOrderStatus';
import OnlineStoreReviewModal from './OnlineStoreReviewModal';
import OnlineStorePreparationModal from './OnlineStorePreparationModal';
import OnlineStoreDeliveryModal from './OnlineStoreDeliveryModal';
import { IoRefreshOutline } from 'react-icons/io5';
import '../../styles/components/onlineStoreCajero.css';

const TAB_POR_HACER = 'por-hacer';
const TAB_CONFIRMADOS = 'confirmados';
const TAB_DISPONIBLES = 'disponibles';
const TAB_VENTAS_CONCRETADAS = 'ventas-concretadas';

/** Zona usada al interpretar el rango en servidor y al mostrar fechas de pedidos. */
const MEXICO_TIMEZONE = 'America/Mexico_City';

function formatYYYYMMDDInMexico(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MEXICO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${y}-${m}-${day}`;
}

/** Rango por defecto: el día civil actual en Ciudad de México (desde y hasta el mismo día). */
function todayMexicoDateRange(): { dateFrom: string; dateTo: string } {
  const d = formatYYYYMMDDInMexico(new Date());
  return { dateFrom: d, dateTo: d };
}

function deliveryCostNumber(order: StoreOrder): number | null {
  const c = order.deliveryCost;
  if (c == null) return null;
  const n = Number(c);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function summarizeCompletedSales(orders: StoreOrder[]) {
  let totalVentas = 0;
  let totalEnvios = 0;
  let pedidosConEnvio = 0;
  for (const o of orders) {
    totalVentas += Number(o.total) || 0;
    const dc = deliveryCostNumber(o);
    if (dc != null) {
      totalEnvios += dc;
      pedidosConEnvio += 1;
    }
  }
  return { totalVentas, totalEnvios, pedidosConEnvio, count: orders.length };
}

function formatOrderDateTimeMexico(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-MX', {
      timeZone: MEXICO_TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

const ORDER_AVAILABILITY_ONLINE_PICKUP = 'online_pickup';

/** Etiqueta cuando el pedido viene del catálogo pickup en tienda online (orderAvailability). */
function OrderOnlinePickupBadge({ order }: Readonly<{ order: StoreOrder }>) {
  if (order.orderAvailability !== ORDER_AVAILABILITY_ONLINE_PICKUP) {
    return null;
  }
  return (
    <span className="cajero-tienda-online-card-badge cajero-tienda-online-card-badge--online-pickup">
      Disponible solo en tienda Online
    </span>
  );
}

/** Sucursal del pedido según API (`branch.name`). */
function OrderBranchBadge({ order }: Readonly<{ order: StoreOrder }>) {
  const name = order.branch?.name?.trim();
  if (!name) return null;
  return (
    <span
      className="cajero-tienda-online-card-badge cajero-tienda-online-card-badge--branch"
      title={`Sucursal: ${name}`}
      aria-label={`Sucursal del pedido: ${name}`}
    >
      {name}
    </span>
  );
}

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

/** Orden para reporte por fecha de entrega (más reciente primero). */
function sortOrdersByDeliveredNewest(orderList: StoreOrder[]) {
  return [...orderList].sort((a, b) => {
    const dateA = new Date(a.deliveredAt || a.createdAt || 0).getTime();
    const dateB = new Date(b.deliveredAt || b.createdAt || 0).getTime();
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
  const [rangeDateFrom, setRangeDateFrom] = useState(() => todayMexicoDateRange().dateFrom);
  const [rangeDateTo, setRangeDateTo] = useState(() => todayMexicoDateRange().dateTo);
  const [rangeResults, setRangeResults] = useState<StoreOrder[] | null>(null);
  const [rangePagination, setRangePagination] = useState<OrdersPagination | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);

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
        toast.error('No se pudieron cargar los pedidos, Revisa tu conexión a internet.');
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

    if (activeTab === TAB_VENTAS_CONCRETADAS) {
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

  const loadSalesReport = useCallback(async (from: string, to: string) => {
    const f = from.trim();
    const t = to.trim();
    if (!f || !t) {
      toast.error('Selecciona fecha inicial y fecha final.');
      return;
    }
    if (f > t) {
      toast.error('La fecha inicial no puede ser posterior a la final.');
      return;
    }
    setRangeError(null);
    setRangeLoading(true);
    setRangeResults(null);
    setRangePagination(null);
    try {
      const data = await fetchOnlineStoreOrdersPage(ORDER_STATUS.COMPLETED, 1, 100, {
        dateFrom: f,
        dateTo: t,
        dateField: 'deliveredAt',
      });
      setRangeResults(sortOrdersByDeliveredNewest(data.orders));
      setRangePagination(data.pagination);
    } catch (e) {
      setRangeResults(null);
      setRangeError(e instanceof Error ? e.message : 'Error al cargar el reporte.');
    } finally {
      setRangeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== TAB_VENTAS_CONCRETADAS) return;
    const { dateFrom, dateTo } = todayMexicoDateRange();
    setRangeDateFrom(dateFrom);
    setRangeDateTo(dateTo);
    void loadSalesReport(dateFrom, dateTo);
  }, [activeTab, loadSalesReport]);

  const refreshForActiveTab = useCallback(async () => {
    if (activeTab === TAB_VENTAS_CONCRETADAS) {
      const { dateFrom, dateTo } = todayMexicoDateRange();
      setRangeDateFrom(dateFrom);
      setRangeDateTo(dateTo);
      await loadSalesReport(dateFrom, dateTo);
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

  const handleSalesReportSubmit = useCallback(() => {
    void loadSalesReport(rangeDateFrom, rangeDateTo);
  }, [loadSalesReport, rangeDateFrom, rangeDateTo]);

  const salesSummary = useMemo(() => {
    if (rangeResults === null) return null;
    return summarizeCompletedSales(rangeResults);
  }, [rangeResults]);

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
            aria-selected={activeTab === TAB_VENTAS_CONCRETADAS}
            aria-controls="cajero-tab-panel-ventas"
            id="cajero-tab-ventas"
            className={`cajero-tienda-online-tab cajero-tienda-online-tab--tertiary ${activeTab === TAB_VENTAS_CONCRETADAS ? 'cajero-tienda-online-tab--active' : ''}`}
            onClick={() => setActiveTab(TAB_VENTAS_CONCRETADAS)}
          >
            Ventas concretadas
          </button>
        </div>
        <button
          type="button"
          className="cajero-tienda-online-refresh"
          onClick={() => void refreshForActiveTab()}
          disabled={loading || rangeLoading}
          aria-label={
            loading || rangeLoading ? 'Actualizando…' : 'Actualizar pedidos o reporte de esta pestaña'
          }
          title="Actualizar"
        >
          <IoRefreshOutline
            className={`cajero-tienda-online-refresh-icon${loading ? ' cajero-tienda-online-refresh-icon--spin' : ''}`}
            aria-hidden
          />
        </button>
      </div>

      {loading && activeTab !== TAB_VENTAS_CONCRETADAS && (
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
                          <OrderBranchBadge order={order} />
                          <OrderOnlinePickupBadge order={order} />
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
                          <OrderBranchBadge order={order} />
                          <OrderOnlinePickupBadge order={order} />
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
                          <OrderBranchBadge order={order} />
                          <OrderOnlinePickupBadge order={order} />
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

      {activeTab === TAB_VENTAS_CONCRETADAS && (
        <div
          className="cajero-tienda-online-ayuda"
          id="cajero-tab-panel-ventas"
          role="tabpanel"
          aria-labelledby="cajero-tab-ventas"
        > 

          <section className="cajero-tienda-online-ayuda-range" aria-labelledby="cajero-ventas-range-title">
            <div className="cajero-tienda-online-ayuda-range-grid cajero-tienda-online-ventas-range-grid">
              <div className="cajero-tienda-online-ayuda-range-field">
                <label htmlFor="cajero-ventas-range-from" className="cajero-tienda-online-ayuda-label">
                  Desde
                </label>
                <input
                  id="cajero-ventas-range-from"
                  type="date"
                  className="cajero-tienda-online-ayuda-input cajero-tienda-online-ayuda-input--date"
                  value={rangeDateFrom}
                  onChange={(e) => {
                    setRangeDateFrom(e.target.value);
                    setRangeError(null);
                  }}
                  aria-describedby="cajero-ventas-range-tz-hint"
                />
              </div>
              <div className="cajero-tienda-online-ayuda-range-field">
                <label htmlFor="cajero-ventas-range-to" className="cajero-tienda-online-ayuda-label">
                  Hasta
                </label>
                <input
                  id="cajero-ventas-range-to"
                  type="date"
                  className="cajero-tienda-online-ayuda-input cajero-tienda-online-ayuda-input--date"
                  value={rangeDateTo}
                  onChange={(e) => {
                    setRangeDateTo(e.target.value);
                    setRangeError(null);
                  }}
                  aria-describedby="cajero-ventas-range-tz-hint"
                />
              </div>
            </div>
            <p id="cajero-ventas-range-tz-hint" className="cajero-tienda-online-ayuda-hint">
              Zona horaria del filtro: América/Ciudad de México (inicio y fin de cada día civil).
            </p>
            <div className="cajero-tienda-online-ventas-actions">
              <button
                type="button"
                className="cajero-tienda-online-ayuda-btn cajero-tienda-online-ayuda-btn--secondary"
                onClick={() => {
                  const { dateFrom, dateTo } = todayMexicoDateRange();
                  setRangeDateFrom(dateFrom);
                  setRangeDateTo(dateTo);
                  setRangeError(null);
                  void loadSalesReport(dateFrom, dateTo);
                }}
                disabled={rangeLoading}
              >
                Hoy (México)
              </button>
              <button
                type="button"
                className="cajero-tienda-online-ayuda-btn"
                onClick={() => void handleSalesReportSubmit()}
                disabled={rangeLoading}
              >
                {rangeLoading ? 'Generando…' : 'Generar reporte'}
              </button>
            </div>
          </section>

          {rangeLoading && (
            <div className="cajero-tienda-online-ayuda-loading" aria-live="polite">
              <div className="cajero-tienda-online-spinner" aria-hidden />
              <p>Cargando ventas concretadas…</p>
            </div>
          )}
          {rangeError && !rangeLoading && (
            <div className="cajero-tienda-online-ayuda-error" role="alert">
              <span className="cajero-tienda-online-ayuda-error-icon" aria-hidden>
                ⚠
              </span>
              <p>{rangeError}</p>
            </div>
          )}
          {rangeResults !== null && !rangeLoading && !rangeError && salesSummary && (
            <div className="cajero-tienda-online-ventas-report">
              <div className="cajero-tienda-online-ventas-totals" aria-live="polite">
                <div className="cajero-tienda-online-ventas-total-card">
                  <span className="cajero-tienda-online-ventas-total-label">Total ventas</span>
                  <span className="cajero-tienda-online-ventas-total-value">
                    {formatPrice(salesSummary.totalVentas)}
                  </span>
                  <span className="cajero-tienda-online-ventas-total-hint">
                    Suma del total de {salesSummary.count} pedido(s) mostrado(s)
                  </span>
                </div>
                <div className="cajero-tienda-online-ventas-total-card">
                  <span className="cajero-tienda-online-ventas-total-label">Total envíos</span>
                  <span className="cajero-tienda-online-ventas-total-value">
                    {formatPrice(salesSummary.totalEnvios)}
                  </span>
                  <span className="cajero-tienda-online-ventas-total-hint">
                    Suma de costo de envío en {salesSummary.pedidosConEnvio} pedido(s) con costo mayor a cero
                  </span>
                </div>
              </div>

              {rangePagination?.hasNext ? (
                <p className="cajero-tienda-online-ventas-truncation" role="status">
                  Hay más de 100 pedidos en el periodo: los totales y la tabla corresponden solo a esta primera página.
                  Acota las fechas o exporta desde administración si necesitas el universo completo.
                </p>
              ) : null}

              {rangeResults.length === 0 ? (
                <p className="cajero-tienda-online-ventas-empty">No hay ventas concretadas en el periodo seleccionado.</p>
              ) : (
                <div className="cajero-tienda-online-ventas-table-wrap">
                  <table className="cajero-tienda-online-ventas-table">
                    <caption className="cajero-tienda-online-ventas-table-caption">
                      Detalle de pedidos entregados en el periodo
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Folio</th>
                        <th scope="col">Sucursal</th>
                        <th scope="col">Cliente</th>
                        <th scope="col">Creación</th>
                        <th scope="col">Entrega</th>
                        <th scope="col">Total</th>
                        <th scope="col">Envío</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rangeResults.map((order) => {
                        const clientName = order.user?.name || order.user?.email || '—';
                        const dc = deliveryCostNumber(order);
                        return (
                          <tr key={`ventas-${order.id}`}>
                            <td>{order.id}</td>
                            <td>{order.branch?.name?.trim() || '—'}</td>
                            <td>{clientName}</td>
                            <td>{formatOrderDateTimeMexico(order.createdAt)}</td>
                            <td>
                              {order.deliveredAt
                                ? formatOrderDateTimeMexico(order.deliveredAt)
                                : '—'}
                            </td>
                            <td>{formatPrice(Number(order.total) || 0)}</td>
                            <td>{dc != null ? formatPrice(dc) : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
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
