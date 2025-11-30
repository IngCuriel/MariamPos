import React, { useState, useEffect } from 'react';
import Card from '../../components/Card';
import Button from '../../components/Button';
import type { Client } from '../../types';
import { getClientPendingDeposits, returnAllClientContainerDeposits, type ClientContainerDepositsResponse } from '../../api/clientContainerDeposits';
import { getActiveShift, createCashMovement, type CreateCashMovementInput } from '../../api/cashRegister';
import Swal from 'sweetalert2';
import '../../styles/pages/client.css';

interface ClientContainerDepositsModalProps {
  isOpen: boolean;
  client: Client | null;
  onClose: () => void;
  onReturnSuccess?: () => void; // Callback cuando se regresa el importe exitosamente
}

const ClientContainerDepositsModal: React.FC<ClientContainerDepositsModalProps> = ({
  isOpen,
  client,
  onClose,
  onReturnSuccess,
}) => {
  const [depositsData, setDepositsData] = useState<ClientContainerDepositsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    if (isOpen && client) {
      loadDeposits();
    } else {
      setDepositsData(null);
    }
  }, [isOpen, client]);

  const loadDeposits = async () => {
    if (!client) return;
    
    setLoading(true);
    try {
      const data = await getClientPendingDeposits(client.id);
      setDepositsData(data);
    } catch (error) {
      console.error('Error al cargar depósitos de envases:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar los depósitos de envases',
        confirmButtonText: 'Entendido',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReturnDeposit = async () => {
    if (!client || !depositsData || depositsData.totalAmount === 0) return;

    // Confirmar acción
    const result = await Swal.fire({
      icon: 'question',
      title: '💰 Regresar Importe de Envases',
      html: `
        <div style="text-align: left; margin-top: 1rem;">
          <p style="font-weight: 600; margin-bottom: 0.5rem;">Cliente: <strong>${client.name}</strong></p>
          <p style="margin-bottom: 0.5rem;">Total a regresar: <strong style="color: #059669; font-size: 1.2rem;">$${depositsData.totalAmount.toFixed(2)}</strong></p>
          <p style="margin-bottom: 0.5rem;">Total de envases: <strong>${depositsData.totalContainers} envase${depositsData.totalContainers !== 1 ? 's' : ''}</strong></p>
          <div style="margin-top: 1rem; padding: 0.75rem; background: #f0fdf4; border-radius: 4px;">
            <p style="font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">Detalle de envases:</p>
            ${depositsData.summary.map(item => 
              `<p style="margin: 0.25rem 0; font-size: 0.85rem;">• ${item.containerName}: ${item.totalQuantity} envase${item.totalQuantity !== 1 ? 's' : ''} - $${item.totalAmount.toFixed(2)}</p>`
            ).join('')}
          </div>
          <p style="margin-top: 1rem; font-size: 0.9rem; color: #6b7280; font-style: italic;">
            Se registrará como una salida de efectivo y se marcarán los depósitos como devueltos.
          </p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '✅ Confirmar Regreso',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#6b7280',
    });

    if (!result.isConfirmed) return;

    setReturning(true);

    try {
      // Obtener branch y cashRegister del localStorage
      const branch = localStorage.getItem('sucursal') || 'Sucursal Principal';
      const cashRegister = localStorage.getItem('caja') || 'Caja 1';

      // Obtener turno activo
      const activeShift = await getActiveShift(branch, cashRegister);

      if (!activeShift) {
        Swal.fire({
          icon: 'warning',
          title: 'Turno no activo',
          text: 'Debe abrir un turno de caja antes de regresar el importe',
          confirmButtonText: 'Entendido',
        });
        setReturning(false);
        return;
      }

      // Preparar detalles de envases para las notas
      const containersDetails = depositsData.summary
        .map(item => `${item.containerName} (${item.totalQuantity}) - $${item.totalAmount.toFixed(2)}`)
        .join(' | ');

      // Crear movimiento de efectivo (SALIDA)
      const cashMovementInput: CreateCashMovementInput = {
        shiftId: activeShift.id,
        type: 'SALIDA',
        amount: depositsData.totalAmount,
        reason: `Regreso importe de envase - ${client.name}`,
        notes: containersDetails,
      };

      // Crear movimiento de efectivo (SALIDA)
      await createCashMovement(cashMovementInput);

      // Marcar todos los depósitos como devueltos
      await returnAllClientContainerDeposits(client.id);

      Swal.fire({
        icon: 'success',
        title: '✅ Importe Regresado',
        html: `
          <p>Se registró la salida de efectivo por <strong>$${depositsData.totalAmount.toFixed(2)}</strong></p>
          <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #6b7280;">
            Razón: Regreso importe de envase - ${client.name}
          </p>
        `,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#059669',
      });

      // Recargar depósitos
      await loadDeposits();

      // Llamar callback si existe
      if (onReturnSuccess) {
        onReturnSuccess();
      }
    } catch (error: any) {
      console.error('Error al regresar importe:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        html: `
          <p>No se pudo regresar el importe.</p>
          <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #dc2626;">
            ${error?.response?.data?.error || error?.message || 'Error desconocido'}
          </p>
        `,
        confirmButtonText: 'Entendido',
      });
    } finally {
      setReturning(false);
    }
  };

  if (!isOpen || !client) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: '700px', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#1f2937' }}>
            🍺 Envases - {client.name}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '0.25rem 0.5rem',
            }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p>Cargando depósitos...</p>
          </div>
        ) : !depositsData || depositsData.totalContainers === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ fontSize: '1.1rem', color: '#6b7280' }}>
              Este cliente no tiene depósitos de envases pendientes.
            </p>
          </div>
        ) : (
          <>
            {/* Resumen Principal */}
            <Card style={{ marginBottom: '1.5rem', backgroundColor: '#ecfdf5', border: '2px solid #059669' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.9rem', color: '#065f46', fontWeight: '600' }}>
                    Total de Envases:
                  </span>
                  <p style={{ margin: '4px 0', fontWeight: '700', fontSize: '1.5rem', color: '#059669' }}>
                    {depositsData.totalContainers} envase{depositsData.totalContainers !== 1 ? 's' : ''}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '0.9rem', color: '#065f46', fontWeight: '600' }}>
                    Importe Total:
                  </span>
                  <p style={{ margin: '4px 0', fontWeight: '700', fontSize: '1.5rem', color: '#059669' }}>
                    ${depositsData.totalAmount.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Detalle por Tipo de Envase */}
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #059669' }}>
                <p style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#065f46' }}>
                  Detalle por tipo:
                </p>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {depositsData.summary.map((item, idx) => {
                    // Obtener el depósito más reciente de este tipo para mostrar fecha y cajero
                    const latestDeposit = item.deposits && item.deposits.length > 0 
                      ? item.deposits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
                      : null;
                    
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

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '0.75rem',
                          backgroundColor: 'white',
                          borderRadius: '4px',
                          border: '1px solid #e5e7eb',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: '0.9rem', color: '#1f2937', fontWeight: '600', display: 'block', marginBottom: '0.25rem' }}>
                              {item.containerName}
                            </span>
                            <div style={{ fontSize: '0.85rem', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                              <span>
                                {item.totalQuantity} envase{item.totalQuantity !== 1 ? 's' : ''}
                              </span>
                              <span style={{ fontWeight: '600', color: '#4b5563' }}>
                                Precio unitario: ${item.unitPrice.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <strong style={{ fontSize: '1rem', color: '#059669', fontWeight: '700', display: 'block' }}>
                              ${item.totalAmount.toFixed(2)}
                            </strong>
                            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                              (${item.unitPrice.toFixed(2)} × {item.totalQuantity})
                            </span>
                          </div>
                        </div>
                        {latestDeposit && (
                          <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #f3f4f6' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
                              <div>
                                <span style={{ fontWeight: '600', color: '#4b5563' }}>📅 Fecha:</span>
                                <span style={{ marginLeft: '0.25rem' }}>{formatDate(latestDeposit.createdAt)}</span>
                              </div>
                              {latestDeposit.shift?.cashierName && (
                                <div>
                                  <span style={{ fontWeight: '600', color: '#4b5563' }}>👤 Cajero:</span>
                                  <span style={{ marginLeft: '0.25rem' }}>{latestDeposit.shift.cashierName}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>

            {/* Botón para regresar importe */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <Button
                variant="secondary"
                onClick={onClose}
                disabled={returning}
              >
                Cerrar
              </Button>
              <Button
                variant="success"
                onClick={handleReturnDeposit}
                disabled={returning || !depositsData || depositsData.totalAmount === 0}
                style={{
                  backgroundColor: '#059669',
                  color: 'white',
                  fontWeight: '600',
                }}
              >
                {returning ? '⏳ Procesando...' : '💰 Regresar Importe'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ClientContainerDepositsModal;
