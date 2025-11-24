import React, { useState, useEffect } from 'react';
import Button from './Button';
import Card from './Card';
import type { Category } from '../types';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (category: Omit<Category, 'id' | 'createdAt'>) => void;
  category?: Category | null;
  title: string;
}

const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  category,
  title
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    showInPOS: true
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        description: category.description || '',
        showInPOS: category.showInPOS !== undefined ? category.showInPOS : true
      });
    } else {
      setFormData({
        name: '',
        description: '',
        showInPOS: true
      });
    }
    setErrors({});
  }, [category, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Limpiar error cuando el usuario empiece a escribir
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: checked
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
      const categoryData: Omit<Category, 'id' | 'createdAt'> = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        showInPOS: formData.showInPOS
      };
      
      onSave(categoryData);
      onClose();
    }
  };
  
  if (!isOpen) return null;

  return (
    <div className="modal-overlay category-modal-overlay">
      <div className="modal-container category-modal-container">
        <Card className="modal-card">
          <div className="modal-header">
            <h2>{title}</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
          
          <form onSubmit={handleSubmit} className="category-form">
            <div className="form-group">
              <label htmlFor="name">Nombre de la Categoría *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={errors.name ? 'error' : ''}
                placeholder="Ej: Frutas"
              />
              {errors.name && <span className="error-message">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="description">Descripción</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Descripción opcional de la categoría"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="showInPOS"
                  checked={formData.showInPOS}
                  onChange={handleCheckboxChange}
                  className="checkbox-input"
                />
                <span className="checkbox-text">Mostrar en POS</span>
              </label>
              <p className="checkbox-hint">Si está activado, esta categoría aparecerá en el punto de venta</p>
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
              >
                {category ? 'Actualizar' : 'Crear'} Categoría
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default CategoryModal;
