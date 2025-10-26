import React, { useState, useEffect } from 'react';
import Header from '../../components/Header';
import Button from '../../components/Button';
import Card from '../../components/Card';
//types
import type { Product,Category} from '../../types';

//apis
import { getCategories } from '../../api/categories';
import { createProduct} from "../../api/products";

import '../../styles/pages/products/newproductpage.css'

interface NewProductPageProps {
  onBack: () => void;
}
 
const NewProductPage: React.FC<NewProductPageProps> = ({ onBack }) => {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    status: 1,
    price: '',
    saleType: '',
    cost: '',
    icon:'',
    description: '',
    category: ''
    });
  const [saleType, setSaleType] = useState("Pieza");
  const [status, setStatus] = useState<number>(1);
  const [categories, setCategories] = useState<Category[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
     fetchCategories();
  }, [])
  
  const fetchCategories = async () => {
    try {
       const data = await getCategories();
       setCategories(data)
    } catch (error) {
      console.log('Error', error)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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

    if (!formData.price || parseFloat(formData.price) <= 0) {
      newErrors.price = 'El precio debe ser mayor a 0';
    }

    if (!formData.icon.trim()) {
      newErrors.image = 'La imagen es requerida';
    }


    if (!formData.cost || parseInt(formData.cost) < 0) {
      newErrors.stock = 'El costo debe ser 0 o mayor';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async(e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {

      const product: Omit<Product, 'id' > = {
        code: formData.code.trim(),
        name: formData.name.trim(),
        status: status,
        saleType: saleType,
        price: parseFloat(formData.price),
        cost: parseFloat(formData.cost),
        icon: formData.icon.trim(),
        description: formData.description.trim(),
        categoryId: formData.category,
       };
      
      await createProduct(product);
      onBack();
    }
  };
 

  const emojis = [
    '🍎', '🍌', '🍊', '🍇', '🍓', '🥝', '🍑', '🥭',
    '🥕', '🥔', '🍅', '🥒', '🥬', '🥦', '🧅', '🧄',
    '🥛', '🧀', '🥚', '🍞', '🥖', '🥐', '🧈',
    '🥩', '🍗', '🥓', '🍖', '🦐', '🐟',
    '🥤', '🧃', '☕', '🍵', '🍺', '🍷',
    '🍿', '🍪', '🍰', '🍫', '🍭', '🍬',
    '🧽', '🧴', '🧼', '🧻', '🧺', '🧹'
  ];

  return (
    <div className="app">
      <div className="new-product-container">
        <Header
          title="Nuevo Producto"
          onBack={onBack}
          backText="← Volver a Productos"
          className="new-product-header"
        />
        
        <div className="new-product-content">
          <Card className="form-card">
            <p>Completa todos los campos para agregar un nuevo producto</p>
            
            <form onSubmit={handleSubmit} className="product-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="code">Codigo del Producto *</label>
                  <input
                    type="text"
                    id="code"
                    name="code"
                    value={formData.code}
                    onChange={handleInputChange}
                    className={errors.name ? 'error' : ''}
                    placeholder="Ej: 232323"
                  />
                  {errors.code && <span className="error-message">{errors.code}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="name">Nombre del Producto *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={errors.name ? 'error' : ''}
                    placeholder="Ej: Manzanas rojas"
                  />
                  {errors.name && <span className="error-message">{errors.name}</span>}
                </div>
              </div>
              <div className="form-row"> 
                <div className="form-group">
                  <label htmlFor="name">Activo*</label>
                  <input
                      type="checkbox"
                      id="status"
                      name="status"
                      checked={status === 1}
                      onChange={() => setStatus(status === 1 ? 0: 1)}
                      />
                </div>
                <div className="form-group">
                  <label> Se vende </label>
                  <div className='radio-group'>
                    <label>
                      <input
                        type="radio"
                        name="saleType"
                        value="Pieza"
                        checked={saleType === "Pieza"}
                        onChange={(e) => setSaleType(e.target.value)}
                      />
                      Por pieza
                    </label> 
                    <label>
                        <input
                          type="radio"
                          name="saleType"
                          value="Granel"
                          checked={saleType === "Granel"}
                          onChange={(e) => setSaleType(e.target.value)}
                        />
                        A granel
                      </label>  
                  </div>              
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="category">Categoría *</label>
                <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className={errors.category ? 'error' : ''}
                  >
                    <option value="">Selecciona una categoría</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                </select>
                {errors.category && <span className="error-message">{errors.category}</span>}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="price">Precio *</label>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    className={errors.price ? 'error' : ''}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                  {errors.price && <span className="error-message">{errors.price}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="cost">Costo *</label>
                  <input
                    type="number"
                    id="cost"
                    name="cost"
                    value={formData.cost}
                    onChange={handleInputChange}
                    className={errors.cost ? 'error' : ''}
                    placeholder="0"
                    min="0"
                  />
                  {errors.cost && <span className="error-message">{errors.cost}</span>}
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="image">Imagen (Emoji) *</label>
                <div className="emoji-selector">
                  <input
                    type="text"
                    id="icon"
                    name="icon"
                    value={formData.icon}
                    onChange={handleInputChange}
                    className={errors.icon ? 'error' : ''}
                    placeholder="Selecciona un emoji"
                    maxLength={2}
                  />
                  <div className="emoji-grid">
                    {emojis.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        className="emoji-option"
                        onClick={() => setFormData(prev => ({ ...prev, icon: emoji }))}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                {errors.image && <span className="error-message">{errors.image}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="description">Descripción</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Descripción opcional del producto"
                  rows={3}
                />
              </div>

              <div className="form-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onBack}
                  className="cancel-btn"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="success"
                  className="save-btn"
                >
                  Guardar Producto
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default NewProductPage;
