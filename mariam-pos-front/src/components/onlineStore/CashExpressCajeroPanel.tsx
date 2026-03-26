import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { IoRefreshOutline } from 'react-icons/io5';
import {
  fetchCashExpressCajeroQueue,
  patchCashExpressRequestStatus,
  type CashExpressRequestItem,
} from '../../api/cashExpress';
import '../../styles/components/posCashExpressCajero.css';

const STATUS_DEPOSITO_VALIDADO = 'DEPOSITO_VALIDADO';
const STATUS_ENTREGADO = 'ENTREGADO';

const formatPrice = (price: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price ?? 0);

function getDeliveryDate(item: CashExpressRequestItem): Date | null {
  const d = item.availableFrom || item.estimatedDeliveryDate;
  if (!d) return null;
  return new Date(d);
}

function canReleaseDelivery(item: CashExpressRequestItem): boolean {
  const deliveryDate = getDeliveryDate(item);
  if (!deliveryDate) return true;
  return new Date() >= deliveryDate;
}

function formatDeliveryDateTime(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleString('es-MX', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface CashExpressCajeroPanelProps {
  /** URL opcional del sitio cliente (ej. …/cash-express) */
  publicPortalUrl?: string | null;
}

const CashExpressCajeroPanel: React.FC<CashExpressCajeroPanelProps> = ({ publicPortalUrl }) => {
  const [requests, setRequests] = useState<CashExpressRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveringId, setDeliveringId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [senderModalRequest, setSenderModalRequest] = useState<CashExpressRequestItem | null>(null);

  const loadRequests = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    if (!silent) setLoading(true);
    try {
      const list = await fetchCashExpressCajeroQueue(STATUS_DEPOSITO_VALIDADO, 1, 100);
      setRequests(list);
    } catch {
      if (!silent) {
        toast.error('No se pudieron cargar las solicitudes.');
        setRequests([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
    const interval = globalThis.setInterval(() => {
      void loadRequests({ silent: true });
    }, 30000);
    return () => globalThis.clearInterval(interval);
  }, [loadRequests]);

  const handleDeliver = (item: CashExpressRequestItem) => {
    if (!canReleaseDelivery(item)) return;
    setConfirmId(item.id);
  };

  const handleConfirmDeliver = async (id: number) => {
    setDeliveringId(id);
    setIsConfirming(true);
    try {
      await patchCashExpressRequestStatus(id, STATUS_ENTREGADO);
      setConfirmId(null);
      toast.success('Efectivo entregado exitosamente.');
      void loadRequests({ silent: true });
    } catch (err: unknown) {
      setConfirmId(null);
      const msg = err instanceof Error ? err.message : 'No se pudo registrar la entrega.';
      toast.error(msg);
    } finally {
      setDeliveringId(null);
      setIsConfirming(false);
    }
  };

  const cancelConfirm = () => setConfirmId(null);

  const openPublicPortal = () => {
    const url = publicPortalUrl?.trim();
    if (url) globalThis.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="pos-ce-cajero">
      <div className="pos-ce-toolbar">
        <button
          type="button"
          className="pos-ce-toolbar-btn"
          onClick={() => void loadRequests()}
          disabled={loading}
          aria-label={loading ? 'Actualizando' : 'Actualizar lista'}
        >
          <IoRefreshOutline className={`pos-ce-toolbar-icon${loading ? ' pos-ce-toolbar-icon--spin' : ''}`} />
          Actualizar
        </button>
        {publicPortalUrl?.trim() ? (
          <button type="button" className="pos-ce-toolbar-btn pos-ce-toolbar-btn--secondary" onClick={openPublicPortal}>
            Portal cliente
          </button>
        ) : null}
      </div>

      <p className="pos-ce-subtitle">
        Solicitudes liberadas para entregar. Solo puedes registrar la entrega cuando sea día y hora indicados.
      </p>
      <p className="pos-ce-note">
        Si no ves alguna clave de retiro, es porque la solicitud aún no está liberada. Indícale al cliente que se
        comunique con quien le envió el efectivo.
      </p>

      {loading ? (
        <div className="pos-ce-loading">
          <div className="pos-ce-spinner" aria-hidden />
          <p>Cargando solicitudes…</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="pos-ce-empty">
          <span className="pos-ce-empty-icon" aria-hidden>
            💵
          </span>
          <p>No hay solicitudes liberadas para entregar en este momento.</p>
        </div>
      ) : (
        <ul className="pos-ce-list">
          {requests.map((item) => {
            const deliveryDate = getDeliveryDate(item);
            const canDeliver = canReleaseDelivery(item);
            const isDelivering = deliveringId === item.id;
            const destinatarioNombre = item.recipientName || item.user?.name || '—';
            const destinatarioTelefono =
              item.recipientPhone || item.user?.phone || item.user?.email || null;

            return (
              <li key={item.id} className="pos-ce-card">
                <div className="pos-ce-card-main">
                  <div className="pos-ce-card-header">
                    <div className="pos-ce-card-header-left">
                      <span className="pos-ce-card-folio">
                        Clave: <strong>{item.folio || `#${item.id}`}</strong>
                      </span>
                      <button
                        type="button"
                        className="pos-ce-btn pos-ce-btn--link"
                        onClick={() => setSenderModalRequest(item)}
                        aria-label="Ver datos de quien envía la solicitud"
                      >
                        Quien envía
                      </button>
                    </div>
                    <div className="pos-ce-card-header-right">
                      <span className="pos-ce-card-amount-label">Monto de envío</span>
                      <span className="pos-ce-card-amount">{formatPrice(item.amount)}</span>
                    </div>
                  </div>
                  <div className="pos-ce-card-destinatario">
                    <span className="pos-ce-card-destinatario-label">Quien recoge:</span>
                    <span className="pos-ce-card-destinatario-value">
                      {destinatarioNombre}
                      {destinatarioTelefono ? ` · ${destinatarioTelefono}` : ''}
                    </span>
                  </div>
                  <div className="pos-ce-card-date">
                    <span className="pos-ce-card-date-label">Entrega:</span>
                    <span className="pos-ce-card-date-value">{formatDeliveryDateTime(deliveryDate)}</span>
                  </div>
                </div>
                <div className="pos-ce-card-actions">
                  {canDeliver ? (
                    <button
                      type="button"
                      className="pos-ce-btn pos-ce-btn--entregar"
                      onClick={() => handleDeliver(item)}
                      disabled={isDelivering}
                    >
                      {isDelivering ? 'Registrando…' : 'Entregar efectivo'}
                    </button>
                  ) : (
                    <div className="pos-ce-blocked">
                      <p className="pos-ce-blocked-text">Disponible a partir de</p>
                      <p className="pos-ce-blocked-date">{formatDeliveryDateTime(deliveryDate)}</p>
                      <button type="button" className="pos-ce-btn pos-ce-btn--disabled" disabled>
                        Aún no es hora de entregar
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {confirmId !== null && (
        <div
          className="pos-ce-overlay"
          role="presentation"
          onClick={isConfirming ? undefined : cancelConfirm}
        >
          <div
            className="pos-ce-overlay-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pos-ce-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            {isConfirming ? (
              <div className="pos-ce-overlay-loading" aria-live="polite">
                <div className="pos-ce-spinner" aria-hidden />
                <p className="pos-ce-overlay-loading-text">Registrando entrega…</p>
              </div>
            ) : (
              <>
                <h3 id="pos-ce-confirm-title" className="pos-ce-overlay-title">
                  ¿Registrar entrega de efectivo?
                </h3>
                <p className="pos-ce-overlay-text">Confirma que entregaste el efectivo al destinatario.</p>
                <p className="pos-ce-overlay-reminder">
                  Recuerda solicitar al cliente que firme el comprobante de entrega.
                </p>
                <div className="pos-ce-overlay-actions">
                  <button type="button" className="pos-ce-btn pos-ce-btn--secondary" onClick={cancelConfirm}>
                    Cancelar
                  </button>
                  <button type="button" className="pos-ce-btn pos-ce-btn--entregar" onClick={() => void handleConfirmDeliver(confirmId)}>
                    Sí, entregado
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {senderModalRequest !== null && (
        <div
          className="pos-ce-overlay"
          role="presentation"
          onClick={() => setSenderModalRequest(null)}
        >
          <div
            className="pos-ce-overlay-card pos-ce-overlay-card--sender"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pos-ce-sender-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pos-ce-sender-head">
              <span className="pos-ce-sender-icon" aria-hidden>
                👤
              </span>
              <h3 id="pos-ce-sender-title" className="pos-ce-sender-title">
                Envía
              </h3>
            </div>
            <dl className="pos-ce-sender-list">
              <div className="pos-ce-sender-row">
                <dt className="pos-ce-sender-label">Nombre</dt>
                <dd className="pos-ce-sender-value">{senderModalRequest.user?.name || '—'}</dd>
              </div>
              <div className="pos-ce-sender-row">
                <dt className="pos-ce-sender-label">Correo</dt>
                <dd className="pos-ce-sender-value">
                  {senderModalRequest.user?.email ? (
                    <a href={`mailto:${senderModalRequest.user.email}`} className="pos-ce-sender-link">
                      {senderModalRequest.user.email}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div className="pos-ce-sender-row">
                <dt className="pos-ce-sender-label">Teléfono</dt>
                <dd className="pos-ce-sender-value">
                  {senderModalRequest.user?.phone ? (
                    <a href={`tel:${senderModalRequest.user.phone}`} className="pos-ce-sender-link">
                      {senderModalRequest.user.phone}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
            </dl>
            <div className="pos-ce-sender-actions">
              <button
                type="button"
                className="pos-ce-btn pos-ce-btn--outline"
                onClick={() => setSenderModalRequest(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashExpressCajeroPanel;
