import React, { useState, useEffect } from 'react';
import Card from '../../components/Card';
import Button from '../../components/Button';
import type { Client, ClientCredit } from '../../types';
import { getClientCredits } from '../../api/credits';
import '../../styles/pages/client.css';

interface ClientCreditHistoryModalProps {
  isOpen: boolean;
  client: Client | null;
  onClose: () => void;
}

const ClientCreditHistoryModal: React.FC<ClientCreditHistoryModalProps> = ({
  isOpen,
  client,
  onClose,
}) => {
  const [credits, setCredits] = useState<ClientCredit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && client) {
      loadCredits();
    } else {
      setCredits([]);
    }
  }, [isOpen, client]);

  const loadCredits = async () => {
    if (!client) return;
    
    setLoading(true);
    try {
      // Cargar todos los créditos (pendientes, parcialmente pagados y pagados)
      const allCredits = await getClientCredits(client.id);
      setCredits(allCredits);
    } catch (error) {
      console.error('Error al cargar créditos:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span style={{ color: '#dc2626', fontWeight: '600' }}>⏳ Pendiente</span>;
      case 'PARTIALLY_PAID':
        return <span style={{ color: '#f59e0b', fontWeight: '600' }}>💰 Parcial</span>;
      case 'PAID':
        return <span style={{ color: '#059669', fontWeight: '600' }}>✅ Pagado</span>;
      default:
        return status;
    }
  };

  const calculateDaysSince = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - d.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (!isOpen || !client) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: '900px', maxHeight: '90vh' }}>
        <Card className="modal-card">
          <div className="modal-header">
            <h1>Historial de Créditos - {client.name}</h1>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>

          <div style={{ padding: '1rem', overflowY: 'auto', maxHeight: 'calc(90vh - 150px)' }}>
            {loading ? (
              <p style={{ textAlign: 'center', padding: '2rem' }}>Cargando créditos...</p>
            ) : credits.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                Este cliente no tiene créditos registrados
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {credits.map((credit) => (
                  <div
                    key={credit.id}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '1rem',
                      backgroundColor: credit.status === 'PAID' ? '#f0fdf4' : credit.status === 'PARTIALLY_PAID' ? '#fffbeb' : '#fef2f2',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
                          Crédito #{credit.id} - Venta #{credit.saleId}
                        </h3>
                        <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#6b7280' }}>
                          Creado: {formatDate(credit.createdAt)}
                          {credit.status === 'PAID' && credit.paidAt && (
                            <span style={{ marginLeft: '12px', color: '#059669' }}>
                              • Pagado: {formatDate(credit.paidAt)}
                            </span>
                          )}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {getStatusBadge(credit.status)}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <div>
                        <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Monto Original:</span>
                        <p style={{ margin: '4px 0', fontWeight: '600', fontSize: '1rem' }}>
                          ${credit.originalAmount.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Pagado:</span>
                        <p style={{ margin: '4px 0', fontWeight: '600', fontSize: '1rem', color: '#059669' }}>
                          ${credit.paidAmount.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Pendiente:</span>
                        <p style={{ margin: '4px 0', fontWeight: '600', fontSize: '1rem', color: credit.remainingAmount > 0 ? '#dc2626' : '#059669' }}>
                          ${credit.remainingAmount.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {credit.notes && (
                      <div style={{ marginBottom: '0.75rem', padding: '0.5rem', backgroundColor: 'white', borderRadius: '4px' }}>
                        <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Notas: </span>
                        <span style={{ fontSize: '0.85rem' }}>{credit.notes}</span>
                      </div>
                    )}

                    {credit.payments && credit.payments.length > 0 && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: '600' }}>
                          Historial de Pagos ({credit.payments.length})
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {credit.payments.map((payment) => {
                            const daysSince = calculateDaysSince(payment.createdAt);
                            return (
                              <div
                                key={payment.id}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '0.5rem',
                                  backgroundColor: 'white',
                                  borderRadius: '4px',
                                  border: '1px solid #e5e7eb',
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <span style={{ fontWeight: '600', color: '#059669' }}>
                                      ${payment.amount.toFixed(2)}
                                    </span>
                                    <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                                      • {payment.paymentMethod || 'No especificado'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>
                                    {formatDate(payment.createdAt)}
                                    {daysSince > 0 && (
                                      <span style={{ marginLeft: '8px' }}>
                                        ({daysSince} día{daysSince !== 1 ? 's' : ''} después)
                                      </span>
                                    )}
                                  </div>
                                  {payment.notes && (
                                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px', fontStyle: 'italic' }}>
                                      {payment.notes}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {credit.status !== 'PAID' && (
                      <div style={{ marginTop: '0.75rem', padding: '0.5rem', backgroundColor: '#fef3c7', borderRadius: '4px', fontSize: '0.85rem' }}>
                        <strong>Tiempo transcurrido:</strong> {calculateDaysSince(credit.createdAt)} día{calculateDaysSince(credit.createdAt) !== 1 ? 's' : ''} desde la creación
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-actions" style={{ marginTop: '1rem' }}>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="cancel-btn"
            >
              Cerrar
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ClientCreditHistoryModal;

