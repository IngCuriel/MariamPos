import React, { useState, useEffect } from 'react';
import { IoClose, IoPersonCircleOutline, IoChevronForward } from 'react-icons/io5';
import type { Client, ClientCredit } from '../../types';
import { getClientCredits } from '../../api/credits';
import '../../styles/pages/client/creditHistoryModal.css';

interface ClientCreditHistoryModalProps {
  isOpen: boolean;
  client: Client | null;
  onClose: () => void;
}

const formatMXN = (value: number) =>
  (value || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const formatDateTime = (date?: Date | string) => {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

const statusMeta = (status: string): { label: string; cls: string } => {
  switch (status) {
    case 'PENDING':
      return { label: '⏳ Pendiente', cls: 'chist-badge--pending' };
    case 'PARTIALLY_PAID':
      return { label: '💰 Parcial', cls: 'chist-badge--partial' };
    case 'PAID':
      return { label: '✅ Pagado', cls: 'chist-badge--paid' };
    default:
      return { label: status, cls: 'chist-badge--pending' };
  }
};

const ClientCreditHistoryModal: React.FC<ClientCreditHistoryModalProps> = ({
  isOpen,
  client,
  onClose,
}) => {
  const [credits, setCredits] = useState<ClientCredit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCreditId, setSelectedCreditId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && client) {
      loadCredits();
    } else {
      setCredits([]);
      setSelectedCreditId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, client]);

  const loadCredits = async () => {
    if (!client) return;
    setLoading(true);
    try {
      const allCredits = await getClientCredits(client.id);
      setCredits(allCredits);
      // Seleccionar el primer crédito por defecto.
      setSelectedCreditId(allCredits.length > 0 ? allCredits[0].id : null);
    } catch (error) {
      console.error('Error al cargar créditos:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !client) return null;

  const totalDue = credits.reduce((sum, c) => sum + (c.remainingAmount || 0), 0);
  const selectedCredit = credits.find((c) => c.id === selectedCreditId) || null;

  return (
    <div className="chist-overlay" onClick={onClose} role="presentation">
      <div
        className="chist-modal chist-modal--split"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chist-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="chist-header">
          <div className="chist-header-info">
            <h2 id="chist-title" className="chist-title">Historial de crédito</h2>
            <span className="chist-subtitle">
              {client.name}
              {!loading && credits.length > 0 && ` · Saldo total: ${formatMXN(totalDue)}`}
            </span>
          </div>
          <button className="chist-close" onClick={onClose} aria-label="Cerrar">
            <IoClose size={24} />
          </button>
        </div>

        {loading ? (
          <div className="chist-body">
            <p className="chist-state">Cargando historial...</p>
          </div>
        ) : credits.length === 0 ? (
          <div className="chist-body">
            <p className="chist-state">Este cliente no tiene créditos registrados</p>
          </div>
        ) : (
          <div className="chist-split">
            {/* Columna izquierda: lista de créditos */}
            <div className="chist-list" role="listbox" aria-label="Créditos del cliente">
              {credits.map((credit) => {
                const meta = statusMeta(credit.status);
                const isActive = credit.id === selectedCreditId;
                return (
                  <button
                    type="button"
                    key={credit.id}
                    role="option"
                    aria-selected={isActive}
                    className={`chist-list-item ${isActive ? 'chist-list-item--active' : ''}`}
                    onClick={() => setSelectedCreditId(credit.id)}
                  >
                    <div className="chist-list-item-top">
                      <span className="chist-list-item-sale">Venta #{credit.saleId}</span>
                      <span className={`chist-badge ${meta.cls}`}>{meta.label}</span>
                    </div>
                    <span className="chist-list-item-date">{formatDateTime(credit.createdAt)}</span>
                    <div className="chist-list-item-due">
                      <span className="chist-list-item-due-label">Pendiente</span>
                      <span
                        className={`chist-list-item-due-value ${credit.remainingAmount > 0 ? 'chist-amount-value--due' : 'chist-amount-value--paid'}`}
                      >
                        {formatMXN(credit.remainingAmount)}
                      </span>
                    </div>
                    <IoChevronForward size={18} className="chist-list-item-chevron" />
                  </button>
                );
              })}
            </div>

            {/* Columna derecha: detalle del crédito seleccionado */}
            <div className="chist-detail">
              {!selectedCredit ? (
                <p className="chist-state">Selecciona un crédito para ver sus abonos.</p>
              ) : (
                <CreditDetail credit={selectedCredit} />
              )}
            </div>
          </div>
        )}

        <div className="chist-footer">
          <button type="button" className="chist-btn-close" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

/** Detalle de un crédito: montos, progreso y lista de abonos con quién los aplicó. */
const CreditDetail: React.FC<{ credit: ClientCredit }> = ({ credit }) => {
  const meta = statusMeta(credit.status);
  const paidPct = credit.originalAmount > 0
    ? Math.min(100, Math.round((credit.paidAmount / credit.originalAmount) * 100))
    : 0;
  const payments = credit.payments ?? [];

  return (
    <>
      <div className="chist-detail-head">
        <div>
          <h3 className="chist-detail-title">Venta #{credit.saleId}</h3>
          <span className="chist-detail-date">Crédito del {formatDateTime(credit.createdAt)}</span>
        </div>
        <span className={`chist-badge ${meta.cls}`}>{meta.label}</span>
      </div>

      <div className="chist-amounts">
        <div className="chist-amount">
          <span className="chist-amount-label">Total</span>
          <span className="chist-amount-value">{formatMXN(credit.originalAmount)}</span>
        </div>
        <div className="chist-amount">
          <span className="chist-amount-label">Pagado</span>
          <span className="chist-amount-value chist-amount-value--paid">{formatMXN(credit.paidAmount)}</span>
        </div>
        <div className="chist-amount">
          <span className="chist-amount-label">Pendiente</span>
          <span
            className={`chist-amount-value ${credit.remainingAmount > 0 ? 'chist-amount-value--due' : 'chist-amount-value--paid'}`}
          >
            {formatMXN(credit.remainingAmount)}
          </span>
        </div>
      </div>

      <div className="chist-progress" aria-label={`${paidPct}% pagado`}>
        <div className="chist-progress-bar" style={{ width: `${paidPct}%` }} />
      </div>

      <div className="chist-payments">
        <h4 className="chist-payments-title">Abonos ({payments.length})</h4>
        {payments.length === 0 ? (
          <span className="chist-empty-payments">Sin abonos registrados todavía.</span>
        ) : (
          payments.map((payment) => (
            <div key={payment.id} className="chist-payment">
              <div className="chist-payment-left">
                <span className="chist-payment-amount">{formatMXN(payment.amount)}</span>
                <span className="chist-payment-method">
                  {payment.paymentMethod || 'No especificado'}
                </span>
                <div className="chist-payment-meta">
                  <span>{formatDateTime(payment.createdAt)}</span>
                  <span className="chist-payment-by">
                    <IoPersonCircleOutline size={14} />
                    {payment.createdBy || 'Cajero no registrado'}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
};

export default ClientCreditHistoryModal;
