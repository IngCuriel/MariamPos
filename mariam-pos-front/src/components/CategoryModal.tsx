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
    color: '#667eea',
    icon: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        description: category.description || '',
        color: category.color || '#667eea',
        icon: category.icon || ''
      });
    } else {
      setFormData({
        name: '',
        description: '',
        color: '#667eea',
        icon: ''
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
        color: formData.color,
        icon: formData.icon.trim() || undefined,
      };
      
      onSave(categoryData);
      onClose();
    }
  };

  const colors = [
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#e74c3c',
    '#3498db', '#e67e22', '#9b59b6', '#667eea', '#764ba2',
    '#43e97b', '#38f9d7', '#ff9ff3', '#54a0ff', '#5f27cd'
  ];

  const icons = [
    '🍎', '🍌', '🍊', '🍇', '🍓', '🥝', '🍑', '🥭',
    '🥕', '🥔', '🍅', '🥒', '🥬', '🥦', '🧅', '🧄',
    '🥛', '🧀', '🥚', '🍞', '🥖', '🥐', '🧈',
    '🥩', '🍗', '🥓', '🍖', '🦐', '🐟',
    '🥤', '🧃', '☕', '🍵', '🍺', '🍷',
    '🍿', '🍪', '🍰', '🍫', '🍭', '🍬',
    '🧽', '🧴', '🧼', '🧻', '🧺', '🧹',
    '📱', '💻', '🖥️', '⌨️', '🖱️', '📷','👞','🩴','🎒','👖','🧸','🎁','🎉','🍺','🎩'
  ];

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
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

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="color">Color</label>
                <div className="color-selector">
                  <input
                    type="color"
                    id="color"
                    name="color"
                    value={formData.color}
                    onChange={handleInputChange}
                    className="color-input"
                  />
                  <div className="color-palette">
                    {colors.map(color => (
                      <button
                        key={color}
                        type="button"
                        className="color-option"
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData(prev => ({ ...prev, color }))}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="icon">Icono</label>
                <div className="icon-selector">
                  <input
                    type="text"
                    id="icon"
                    name="icon"
                    value={formData.icon}
                    onChange={handleInputChange}
                    placeholder="Selecciona un emoji"
                    maxLength={2}
                  />
                  <div className="icon-grid">
                    {icons.map(icon => (
                      <button
                        key={icon}
                        type="button"
                        className="icon-option"
                        onClick={() => setFormData(prev => ({ ...prev, icon }))}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
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
