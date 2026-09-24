import React, { useState, useEffect } from 'react';
import Button from '../../components/Button';
import type { Client } from '../../types';
import { getClientCreditSummary } from '../../api/credits';
import '../../styles/pages/client/clientModal.css';

const formatMXN = (value: number) =>
  (value || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
interface ClientModalProps {
  isOpen: boolean; 
  onClose: () => void;
  onSave: (client: Omit<Client, 'id'>) => void;
  clientToEdit?: Client | null; // Cliente a editar (opcional)
}

const ClientModal:React.FC<ClientModalProps> = ({isOpen, onClose, onSave, clientToEdit})=> {
    const [formData, setFormData] = useState({
       name: '',
       alias: '',
       phone: '',
       allowCredit: false,
       creditLimit: 0,
     });
    
    const [errors, setErrors] = useState<Record<string, string>>({});
    // Crédito ya utilizado (saldo pendiente) del cliente en edición.
    const [creditUsed, setCreditUsed] = useState<number | null>(null);
    const [loadingCredit, setLoadingCredit] = useState(false);

    useEffect(() => {
        if (clientToEdit) {
          // Modo edición: cargar datos del cliente
          setFormData({
            name: clientToEdit.name || '',
            alias: clientToEdit.alias || '',
            phone: clientToEdit.phone || '',
            allowCredit: clientToEdit.allowCredit || false,
            creditLimit: clientToEdit.creditLimit || 0,
          });
        } else {
          // Modo creación: resetear formulario
          setFormData({
            name: '',
            alias: '',
            phone: '',
            allowCredit: false,
            creditLimit: 0,
          });
        }
        
        setErrors({});
        setCreditUsed(null);
      }, [isOpen, clientToEdit]);

    // Al editar un cliente con crédito activo, consultar cuánto ya utilizó
    // (saldo pendiente). Una sola llamada, solo cuando aplica.
    useEffect(() => {
        let cancelled = false;
        const loadUsed = async () => {
            if (isOpen && clientToEdit?.id && clientToEdit.allowCredit) {
                setLoadingCredit(true);
                try {
                    const summary = await getClientCreditSummary(clientToEdit.id);
                    if (!cancelled) setCreditUsed(summary.totalPending || 0);
                } catch (error) {
                    console.error('Error al cargar crédito utilizado:', error);
                    if (!cancelled) setCreditUsed(null);
                } finally {
                    if (!cancelled) setLoadingCredit(false);
                }
            }
        };
        loadUsed();
        return () => {
            cancelled = true;
        };
      }, [isOpen, clientToEdit]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
        }));
    };    

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.name.trim()) {
          newErrors.name = 'El nombre es requerido';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validateForm()) {
            const clientData: Omit<Client, 'id'> = {
                name: formData.name.trim(),
                alias: formData.alias.trim() || undefined,
                phone: formData.phone.trim() || undefined,
                allowCredit: formData.allowCredit,
                creditLimit: formData.allowCredit ? parseFloat(formData.creditLimit.toString()) || 0 : 0,
            };
            
            onSave(clientData);
            onClose();
        }
    };

   if(!isOpen) return null;
   return (
     <div className="modal-overlay">
      <div className="modal-container client-form-modal">
        <div className="client-form-panel">
          <div className="client-form-header">
             <h1>{clientToEdit ? 'Editar Cliente' : 'Nuevo Cliente'}</h1>
             <button className="client-form-close" onClick={onClose}>×</button>
           </div>
            <form onSubmit={handleSubmit} className="client-form">
                <div className="client-form-group client-form-group--row">
                    <label htmlFor="name">
                      Nombre completo <span className="client-form-required">*</span>
                    </label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className={errors.name ? 'error' : ''}
                        placeholder="Ej: Eleazar Curiel Monjaraz"
                    />
                    {errors.name && <span className="client-form-error client-form-error--row">{errors.name}</span>}
                </div>
                <div className="client-form-group client-form-group--row">
                    <label htmlFor="alias">Alias (Opcional)</label>
                    <input
                        type="text"
                        id="alias"
                        name="alias"
                        value={formData.alias}
                        onChange={handleInputChange}
                        placeholder="Ej: Eleazar, Don Eleazar, etc."
                    />
                </div>
                <div className="client-form-group client-form-group--row">
                    <label htmlFor="phone">Número de Celular (Opcional)</label>
                    <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="Ej: 521234567890"
                    />
                </div>
                <div className="client-form-group">
                    <label className="client-form-check">
                        <input
                            type="checkbox"
                            id="allowCredit"
                            name="allowCredit"
                            checked={formData.allowCredit}
                            onChange={handleInputChange}
                        />
                        <span>Permitir compras a crédito</span>
                    </label>
                    <small className="client-form-hint client-form-check-hint">
                        Si está habilitado, el cliente podrá finalizar ventas con faltante registrándolo como crédito
                    </small>
                </div>
                {formData.allowCredit && clientToEdit && (
                    <div className="client-credit-usage">
                        {loadingCredit ? (
                            <span className="client-credit-usage-loading">
                                Consultando crédito utilizado...
                            </span>
                        ) : creditUsed !== null ? (
                            <>
                                <div className="client-credit-usage-row">
                                    <span className="client-credit-usage-label">Crédito utilizado</span>
                                    <span className="client-credit-usage-value client-credit-usage-value--used">
                                        {formatMXN(creditUsed)}
                                    </span>
                                </div>
                                <div className="client-credit-usage-row">
                                    <span className="client-credit-usage-label">Límite</span>
                                    <span className="client-credit-usage-value">
                                        {formatMXN(Number(formData.creditLimit) || 0)}
                                    </span>
                                </div>
                                <div className="client-credit-usage-row client-credit-usage-row--strong">
                                    <span className="client-credit-usage-label">Disponible</span>
                                    <span
                                        className={`client-credit-usage-value ${
                                            (Number(formData.creditLimit) || 0) - creditUsed <= 0
                                                ? 'client-credit-usage-value--used'
                                                : 'client-credit-usage-value--available'
                                        }`}
                                    >
                                        {formatMXN((Number(formData.creditLimit) || 0) - creditUsed)}
                                    </span>
                                </div>
                            </>
                        ) : null}
                    </div>
                )}
                {formData.allowCredit && (
                    <div className="client-form-group">
                        <label htmlFor="creditLimit">
                          Límite de crédito <span className="client-form-required">*</span>
                        </label>
                        <input
                            type="number"
                            id="creditLimit"
                            name="creditLimit"
                            value={formData.creditLimit}
                            onChange={handleInputChange}
                            min="0"
                            step="0.01"
                            placeholder="Ej: 100.00"
                            required={formData.allowCredit}
                        />
                        <small className="client-form-hint">
                            Monto máximo que el cliente puede deber en créditos pendientes
                        </small>
                    </div>
                )}
                <div className="client-form-actions">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        className="cancel-btn"
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        variant="success"
                        className="save-btn"
                    > {clientToEdit ? 'Guardar Cambios' : 'Crear'}
                    </Button>
                </div>
            </form>
        </div>
      </div>
    </div>
   )
}

export default ClientModal;
