import React, { useState, useEffect } from 'react';
import Button from '../../components/Button';
import Card from '../../components/Card';
import type { Client} from '../../types';
interface ClientModalProps {
  isOpen: boolean; 
  onClose: () => void;
  onSave: (client: Omit<Client, 'id'>) => void;
}

const ClientModal:React.FC<ClientModalProps> = ({isOpen, onClose, onSave})=> {
    const [formData, setFormData] = useState({
       name: '',
       alias: '',
     });
    
    const [errors, setErrors] = useState<Record<string, string>>({});
    
    useEffect(() => {
        setFormData({
            name: '',
            alias: '',
        });
        
        setErrors({});
      }, [isOpen]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
        ...prev,
        [name]: value
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
            };
            
            onSave(clientData);
            onClose();
        }
    };

   if(!isOpen) return null;
   return (
     <div className="modal-overlay">
      <div className="modal-container">
        <Card className="modal-card">
          <div className="modal-header">
             <h1>Cliente</h1>
             <button className="close-btn" onClick={onClose}>×</button>
           </div>
            <form onSubmit={handleSubmit} className="category-form">
                <div className="form-group">
                    <label htmlFor="name">Nombre completo*</label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className={errors.name ? 'error' : ''}
                        placeholder="Ej: Eleazar Curiel Monjaraz"
                    />
                    {errors.name && <span className="error-message">{errors.name}</span>}
                </div>
                <div className="form-group">
                    <label htmlFor="alias">Alias (Opcional)</label>
                    <input
                        type="text"
                        id="alias"
                        name="alias"
                        value={formData.alias}
                        onChange={handleInputChange}
                        placeholder="Ej: Eleazar, Don Eleazar, etc."
                    />
                    <small style={{ display: "block", marginTop: "4px", fontSize: "0.8rem", color: "#6b7280" }}>
                        El alias ayuda a identificar mejor al cliente si hay nombres repetidos
                    </small>
                </div>
                <div className="form-actions">
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
                    > Crear
                    </Button>
                </div>
            </form>
        </Card>
      </div>
    </div>
   )
}

export default ClientModal;