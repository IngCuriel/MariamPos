import React, { useState, useEffect, useRef} from "react";
import Button from "../../components/Button";
import Card from "../../components/Card";
import type { Product, Category } from "../../types/index";

import { getCategories } from "../../api/categories";

import "../../styles/pages/products/newproductpage.css";

interface NewEditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Omit<Product, "createdAt">) => void;
  product?: Product | null;
  title: string;
}

const NewEditProductModal: React.FC<NewEditProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  product,
  title,
}) => {
  const [formData, setFormData] = useState({
    id:0,
    code: "",
    name: "",
    status: 1,
    price: 0,
    saleType: "",
    cost: 0,
    icon: "",
    description: "",
    category: "",
  });
  const [saleType, setSaleType] = useState("Pieza");
  const [status, setStatus] = useState<number>(1);
  const [categories, setCategories] = useState<Category[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const inputRef = useRef<HTMLInputElement>(null); // 👈 referencia al input
 

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.log("Error", error);
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
    if (product) {
      setFormData({
        id: product.id,
        code: product.code.trim(),
        name: product.name.trim(),
        status: product.status,
        saleType: saleType,
        price: product.price,
        cost: product.cost,
        icon: product.icon,
        description: product?.description || "",
        category: product.category?.id || "",
      });
    } else {
        setFormData({
            id:0,
            code: "",
            name: "",
            status: 1,
            price: 0,
            saleType: "",
            cost: 0,
            icon: "",
            description: "",
            category: "",
          })
        setStatus(1)
        setSaleType('Pieza')
    }
    setErrors({});
  }, [isOpen]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Limpiar error cuando el usuario empiece a escribir
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    console.log('validateForm', formData)
    if (!formData.code.trim()) {
      newErrors.code = 'Cogido es requerido';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if (!formData.price || Number(formData.price) <= 0) {
      newErrors.price = 'El precio debe ser mayor a 0';
    }

    if (!formData.icon.trim()) {
      newErrors.icon = 'La imagen es requerida';
    }
    if (!formData.category.trim()) {
      newErrors.category = 'La categoria es requerida';
    }

    if (!formData.cost || Number(formData.cost) <= 0) {
      newErrors.cost = 'El costo debe ser 0 o mayor';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      const product: Omit<Product, ""> = {
        id:formData.id,
        code: formData.code.trim(),
        name: formData.name.trim(),
        status: status,
        saleType: saleType,
        price: Number(formData.price),
        cost: Number(formData.cost),
        icon: formData.icon.trim(),
        description: formData.description.trim(),
        categoryId: formData.category,
        category: categories.find((cat)=> cat.id===formData.category)
      };
      onSave(product);
      onClose();
    }
  };

  const emojis = [
    "🍎",
    "🍌",
    "🍊",
    "🍇",
    "🍓",
    "🥝",
    "🍑",
    "🥭",
    "🥕",
    "🥔",
    "🍅",
    "🥒",
    "🥬",
    "🥦",
    "🧅",
    "🧄",
    "🥛",
    "🧀",
    "🥚",
    "🍞",
    "🥖",
    "🥐",
    "🧈",
    "🥩",
    "🍗",
    "🥓",
    "🍖",
    "🦐",
    "🐟",
    "🥤",
    "🧃",
    "☕",
    "🍵",
    "🍺",
    "🍷",
    "🍿",
    "🍪",
    "🍰",
    "🍫",
    "🍭",
    "🍬",
    "🧽",
    "🧴",
    "🧼",
    "🧻",
    "🧺",
    "🧹",
    "❓",
  ];

  if (!isOpen) return null;

  return (
    <div className="modal-overlay-newEdit-product">
      <div className=".modal-newEdit-product-container">
        <Card className="modal-card">
          <div className="modal-header">
            <h2>{title}</h2>
            <button className="close-btn" onClick={onClose}>
              ×
            </button>
          </div>
          <form onSubmit={handleSubmit} className="product-form">
            <div className="form-group">
              <label htmlFor="code">Codigo del Producto *</label>
              <input
                ref={inputRef} // 👈 referencia aquí
                type="text"
                id="code"
                name="code"
                value={formData.code}
                onChange={handleInputChange}
                className={errors.name ? "error" : ""}
                placeholder="Ej: 232323"
              />
              {errors.code && (
                <span className="error-message">{errors.code}</span>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="name">Nombre del Producto *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={errors.name ? "error" : ""}
                placeholder="Ej: Manzanas rojas"
              />
              {errors.name && (
                <span className="error-message">{errors.name}</span>
              )}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">Activo*</label>
                <input
                  type="checkbox"
                  id="status"
                  name="status"
                  checked={status === 1}
                  onChange={() => setStatus(status === 1 ? 0 : 1)}
                />
              </div>
              <div className="form-group">
                <label> Se vende </label>
                <div className="radio-group">
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
                className={errors.category ? "error" : ""}
              >
                <option value="">Selecciona una categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {errors.category && (
                <span className="error-message">{errors.category}</span>
              )}
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
                  className={errors.price ? "error" : ""}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
                {errors.price && (
                  <span className="error-message">{errors.price}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="cost">Costo *</label>
                <input
                  type="number"
                  id="cost"
                  name="cost"
                  value={formData.cost}
                  onChange={handleInputChange}
                  className={errors.cost ? "error" : ""}
                  placeholder="0"
                  min="0"
                />
                {errors.cost && (
                  <span className="error-message">{errors.cost}</span>
                )}
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
                  className={errors.icon ? "error" : ""}
                  placeholder="Selecciona un emoji"
                  maxLength={2}
                />
                <div className="emoji-grid">
                  {emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="emoji-option"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, icon: emoji }))
                      }
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              {errors.icon && (
                <span className="error-message">{errors.icon}</span>
              )}
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
                onClick={onClose}
                className="cancel-btn"
              >
                Cancelar
              </Button>
              <Button type="submit" variant="success" className="save-btn">
                {product ? "Actualizar" : "Crear"} Producto
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default NewEditProductModal;
