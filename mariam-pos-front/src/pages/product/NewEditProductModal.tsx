import React, { useState, useEffect, useRef } from "react";
import Button from "../../components/Button";
import Card from "../../components/Card";
import type { Product, Category, ProductPresentation } from "../../types/index";
import jsPDF from "jspdf";
import JsBarcode from "jsbarcode";

import { getCategories } from "../../api/categories";

import "../../styles/pages/products/newproductpage.css";
import "../../styles/pages/products/productModal.css";

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
    id: 0,
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
  const [trackInventory, setTrackInventory] = useState<boolean>(false);
  const [initialStock, setInitialStock] = useState<number>(0);
  const [minStock, setMinStock] = useState<number>(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [labelQuantity, setLabelQuantity] = useState(5);
  const [activeTab, setActiveTab] = useState("producto");
  const [presentations, setPresentations] = useState<ProductPresentation[]>([]);
  const [editingPresentationIndex, setEditingPresentationIndex] = useState<number | null>(null);
  const [newPresentation, setNewPresentation] = useState<Omit<ProductPresentation, 'isDefault'>>({
    name: "",
    quantity: 1,
    unitPrice: 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [presentationErrors, setPresentationErrors] = useState<Record<number, Record<string, string>>>({});

  // 👇 Refs para todos los inputs importantes
  const inputRefs = useRef<(HTMLInputElement | HTMLTextAreaElement | null)[]>([]);
  
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
    if (isOpen) {
      // Foco inicial en primer input
      inputRefs.current[0]?.focus();
      inputRefs.current[0]?.select();

      if (product) {
        setFormData({
          id: product.id,
          code: product.code.trim(),
          name: product.name.trim(),
          status: product.status,
          saleType: product.saleType,
          price: product.price,
          cost: product.cost,
          icon: product.icon,
          description: product?.description || "",
          category: product.category?.id || "",
        });
        setSaleType(product.saleType)
        setStatus(product.status)
        
        // Cargar configuración de inventario
        setTrackInventory(product.inventory?.trackInventory || false);
        setInitialStock(product.inventory?.currentStock || 0);
        setMinStock(product.inventory?.minStock || 0);
        
        // Cargar presentaciones si existen, sino crear la presentación base
        if (product.presentations && product.presentations.length > 0) {
          setPresentations(product.presentations);
        } else {
          // Crear presentación base (1 pieza) si no hay presentaciones
          setPresentations([{
            name: "Pieza",
            quantity: 1,
            unitPrice: product.price,
            isDefault: true,
          }]);
        }
      } else {
        setFormData({
          id: 0,
          code: "",
          name: "",
          status: 1,
          price: 0,
          saleType: "Pieza",
          cost: 0,
          icon: "",
          description: "",
          category: "",
        });
        setStatus(1);
        setSaleType("Pieza");
        
        // Inicializar inventario
        setTrackInventory(false);
        setInitialStock(0);
        setMinStock(0);
        
        // Inicializar con presentación base
        setPresentations([{
          name: "Pieza",
          quantity: 1,
          unitPrice: 0,
          isDefault: true,
        }]);
      }
      setErrors({});
      setPresentationErrors({});
      setEditingPresentationIndex(null);
      setNewPresentation({
        name: "",
        quantity: 1,
        unitPrice: 0,
      });
    }
  }, [isOpen, product]);

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

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  // 👇 Mover foco al siguiente input al presionar Enter y seleccionar valor
  const handleEnterFocusNext = (index: number) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nextInput = inputRefs.current[index + 1];
      if (nextInput) {
        nextInput.focus();
        if ("select" in nextInput) nextInput.select();
      }
    }
  };

  const validatePresentation = (presentation: Omit<ProductPresentation, 'isDefault'>, index?: number): boolean => {
    const presErrors: Record<string, string> = {};
    
    if (!presentation.name.trim()) {
      presErrors.name = "El nombre es requerido";
    }
    if (!presentation.quantity || Number(presentation.quantity) <= 0) {
      presErrors.quantity = "La cantidad debe ser mayor a 0";
    }
    if (!presentation.unitPrice || Number(presentation.unitPrice) <= 0) {
      presErrors.unitPrice = "El precio unitario debe ser mayor a 0";
    }
    
    // Validar nombres duplicados
    const duplicateName = presentations.some((p, i) => 
      p.name.toLowerCase() === presentation.name.toLowerCase().trim() && 
      i !== index &&
      i !== editingPresentationIndex
    );
    if (duplicateName) {
      presErrors.name = "Ya existe una presentación con este nombre";
    }
    
    if (index !== undefined || editingPresentationIndex !== null) {
      const idx = index !== undefined ? index : editingPresentationIndex!;
      if (Object.keys(presErrors).length > 0) {
        setPresentationErrors(prev => ({ ...prev, [idx]: presErrors }));
      } else {
        setPresentationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[idx];
          return newErrors;
        });
      }
    }
    
    return Object.keys(presErrors).length === 0;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.code.trim()) newErrors.code = "Codigo es requerido";
    if (!formData.name.trim()) newErrors.name = "El nombre es requerido";
    
    // Validar que haya al menos una presentación válida
    if (presentations.length === 0) {
      newErrors.presentations = "Debe tener al menos una presentación";
    } else {
      // Validar que la presentación base tenga precio válido
      const defaultPresentation = presentations.find(p => p.isDefault || p.quantity === 1);
      if (!defaultPresentation || !defaultPresentation.unitPrice || defaultPresentation.unitPrice <= 0) {
        newErrors.price = "El precio base (1 pieza) debe ser mayor a 0";
      }
    }
    
    if (!formData.category.trim())
      newErrors.category = "La categoria es requerida";
    if (!formData.cost || Number(formData.cost) < 0)
      newErrors.cost = "El costo debe ser 0 o mayor";

    // Validar campos de inventario si está activado
    if (trackInventory) {
      if (initialStock < 0) {
        newErrors.initialStock = "El stock inicial no puede ser negativo";
      }
      if (minStock < 0) {
        newErrors.minStock = "El stock mínimo no puede ser negativo";
      }
    }

    // Validar todas las presentaciones
    const allPresentationsValid = presentations.every((p, index) => validatePresentation(p, index));

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0 && allPresentationsValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      // Obtener el precio base de la presentación por defecto
      const defaultPresentation = presentations.find(p => p.isDefault || p.quantity === 1);
      const basePrice = defaultPresentation?.unitPrice || Number(formData.price);
      
      const productToSave: Omit<Product, "createdAt"> = {
        id: formData.id,
        code: formData.code.trim(),
        name: formData.name.trim(),
        status: status,
        saleType: saleType,
        price: basePrice, // Precio base para compatibilidad
        cost: Number(formData.cost),
        icon: '',
        description: formData.description.trim(),
        categoryId: formData.category,
        category: categories.find((cat) => cat.id === formData.category),
        presentations: presentations.length > 1 ? presentations : undefined, // Solo incluir si hay más de una presentación
        inventory: trackInventory ? {
          id: 0,
          productId: formData.id,
          trackInventory: trackInventory,
          currentStock: initialStock,
          minStock: minStock,
        } : undefined,
        trackInventory: trackInventory
      };
      onSave(productToSave);
    }
  };

  // Funciones para gestionar presentaciones
  const validateNewPresentation = (): boolean => {
    const presErrors: Record<string, string> = {};
    
    if (!newPresentation.name.trim()) {
      presErrors.name = "El nombre es requerido";
    }
    if (!newPresentation.quantity || Number(newPresentation.quantity) <= 0) {
      presErrors.quantity = "La cantidad debe ser mayor a 0";
    }
    if (!newPresentation.unitPrice || Number(newPresentation.unitPrice) <= 0) {
      presErrors.unitPrice = "El precio unitario debe ser mayor a 0";
    }
    
    // Validar nombres duplicados
    const duplicateName = presentations.some((p) => 
      p.name.toLowerCase() === newPresentation.name.toLowerCase().trim()
    );
    if (duplicateName) {
      presErrors.name = "Ya existe una presentación con este nombre";
    }
    
    if (Object.keys(presErrors).length > 0) {
      // Usar un índice temporal para mostrar errores
      setPresentationErrors(prev => ({ ...prev, [-1]: presErrors }));
      return false;
    } else {
      setPresentationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[-1];
        return newErrors;
      });
      return true;
    }
  };

  const handleAddPresentation = () => {
    if (validateNewPresentation()) {
      setPresentations(prev => [...prev, {
        ...newPresentation,
        name: newPresentation.name.trim(),
        quantity: Number(newPresentation.quantity),
        unitPrice: Number(newPresentation.unitPrice),
      }]);
      setNewPresentation({
        name: "",
        quantity: 1,
        unitPrice: 0,
      });
      setPresentationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[-1];
        return newErrors;
      });
    }
  };

  const handleEditPresentation = (index: number) => {
    setEditingPresentationIndex(index);
    setNewPresentation({
      name: presentations[index].name,
      quantity: presentations[index].quantity,
      unitPrice: presentations[index].unitPrice,
    });
  };

  const handleUpdatePresentation = () => {
    if (editingPresentationIndex === null) return;
    
    if (validatePresentation(newPresentation, editingPresentationIndex)) {
      const updated = [...presentations];
      updated[editingPresentationIndex] = {
        ...updated[editingPresentationIndex],
        name: newPresentation.name.trim(),
        quantity: Number(newPresentation.quantity),
        unitPrice: Number(newPresentation.unitPrice),
      };
      setPresentations(updated);
      setEditingPresentationIndex(null);
      setNewPresentation({
        name: "",
        quantity: 1,
        unitPrice: 0,
      });
      setPresentationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[editingPresentationIndex];
        return newErrors;
      });
    }
  };

  const handleDeletePresentation = (index: number) => {
    const presentation = presentations[index];
    // No permitir eliminar la presentación base (1 pieza)
    if (presentation.isDefault || presentation.quantity === 1) {
      return;
    }
    
    setPresentations(prev => prev.filter((_, i) => i !== index));
    setPresentationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[index];
      // Reindexar errores
      const reindexed: Record<number, Record<string, string>> = {};
      Object.keys(newErrors).forEach(key => {
        const keyNum = Number(key);
        if (keyNum > index) {
          reindexed[keyNum - 1] = newErrors[keyNum];
        } else if (keyNum < index) {
          reindexed[keyNum] = newErrors[keyNum];
        }
      });
      return reindexed;
    });
  };

  const handleCancelEditPresentation = () => {
    setEditingPresentationIndex(null);
    setNewPresentation({
      name: "",
      quantity: 1,
      unitPrice: 0,
    });
    setPresentationErrors(prev => {
      const newErrors = { ...prev };
      if (editingPresentationIndex !== null) {
        delete newErrors[editingPresentationIndex];
      }
      return newErrors;
    });
  };

  const calculateTotalPrice = (presentation: ProductPresentation): number => {
    return presentation.quantity * presentation.unitPrice;
  };
  
  const handleGenerateLabel = (cantidad: number) => {
      if (!product) return;

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "cm",
        format: "a4",
      });

      // 🔹 Tamaño de cada etiqueta
      const labelWidth = 4.2;
      const labelHeight = 2.2;

      // 🔹 Márgenes entre etiquetas
      const marginX = 0 //0.5;
      const marginY = 0 //0.5;

      // 🔹 Número de etiquetas por fila y columna
      const pageWidth = 21; // A4 ancho (cm)
      const pageHeight = 29.7; // A4 alto (cm)
      //const _labelsPerRow = Math.floor(pageWidth / (labelWidth + marginX));
      //const _labelsPerCol = Math.floor(pageHeight / (labelHeight + marginY));

      let x = marginX;
      let y = marginY;

      // 🔹 Generar imagen del código de barras
      const canvas = document.createElement("canvas");
      JsBarcode(canvas, product.code || "000000", {
        format: "CODE128",
        displayValue: false,
        width: 1,
        height: 25,
        margin: 0,
      });
      const barcodeImg = canvas.toDataURL("image/png");

      // 🔹 Calcular cuántas etiquetas caben por hoja
      //const totalLabelsPerPage = labelsPerRow * labelsPerCol;
      const totalLabelsPerPage = cantidad;
      for (let i = 0; i < totalLabelsPerPage; i++) {
        doc.setLineWidth(0.05);
        // Dibuja el contorno de la etiqueta (opcional)
        doc.rect(x, y, labelWidth, labelHeight);

        // Dibuja el código de barras
        doc.addImage(barcodeImg, "PNG", x + 0.2, y + 0.2, labelWidth - 0.4, 0.8);

        // Agrega el código numérico
        doc.setFontSize(6);
        doc.text(product.code.toString(), x + labelWidth / 2, y + 1.2, { align: "center" });

        // Agrega el nombre del producto
        doc.setFontSize(7);
        const name = product.name.length > 25 ? product.name.slice(0, 25) + "..." : product.name;
        doc.text(name, x + labelWidth / 2, y + 1.6, { align: "center" });

        // Agrega el precio
        doc.setFontSize(10);
        doc.text(`$${product.price.toFixed(2)}`, x + labelWidth / 2, y + 1.9, { align: "center" });

        // Mueve coordenadas a la siguiente etiqueta
        x += labelWidth + marginX;
        if (x + labelWidth > pageWidth) {
          x = marginX;
          y += labelHeight + marginY;
        }

        // Si se termina la hoja
        if (y + labelHeight > pageHeight && i < totalLabelsPerPage - 1) {
          doc.addPage();
          x = marginX;
          y = marginY;
        }
      }

      doc.save(`etiquetas-${product.code}.pdf`);
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="product-modal-overlay">
      <div className="product-modal-container">
        <Card className="product-modal-card">
          {/*<div className="modal-header">
            <h2>{title}</h2>
            <button className="close-btn" onClick={onClose}>
              ×
            </button>
          </div>*/}
          <div className="product-modal-tab-header">
            <button
              type="button"
              className={`product-modal-tab-btn ${activeTab === "producto" ? "active" : ""}`}
              onClick={() => setActiveTab("producto")}
            >
              {title}
            </button>
             {product && (<button
              type="button"
              className={`product-modal-tab-btn ${activeTab === "avanzado" ? "active" : ""}`}
              onClick={() => setActiveTab("avanzado")}
            >
              Avanzado
            </button>)}
          </div>
           {activeTab === "producto" && (
            <div className="product-modal-tab-content">
              <form onSubmit={handleSubmit} className="product-modal-form">
                {/* Layout en dos columnas */}
                <div className="product-modal-form-grid">
                  {/* Columna izquierda - Información del Producto */}
                  <div className="product-modal-form-left">
                    <div className="product-modal-form-group">
                      <label htmlFor="code">Codigo del Producto *</label>
                      <input
                        ref={(el) => (inputRefs.current[0] = el  as any)}
                        type="text"
                        id="code"
                        name="code"
                        value={formData.code}
                        onChange={handleInputChange}
                        onKeyDown={handleEnterFocusNext(0)}
                        className={errors.code ? "error" : ""}
                        placeholder="Ej: 232323"
                      />
                      {errors.code && (
                        <span className="product-modal-error-message">{errors.code}</span>
                      )}
                    </div>

                    <div className="product-modal-form-group">
                      <label htmlFor="name">Nombre del Producto *</label>
                      <input
                        ref={(el) => (inputRefs.current[1] = el as any)}
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        onKeyDown={handleEnterFocusNext(1)}
                        className={errors.name ? "error" : ""}
                        placeholder="Ej: Manzanas rojas"
                      />
                      {errors.name && (
                        <span className="product-modal-error-message">{errors.name}</span>
                      )}
                    </div>

                    <div className="product-modal-form-row">
                      <div className="product-modal-form-group">
                        <label htmlFor="status" className="product-modal-checkbox-group">
                          <input
                            type="checkbox"
                            id="status"
                            name="status"
                            checked={status === 1}
                            onChange={() => setStatus(status === 1 ? 0 : 1)}
                          />
                          <span>Activo *</span>
                        </label>
                      </div>
                      <div className="product-modal-form-group">
                        <label> Se vende </label>
                        <div className="product-modal-radio-group">
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

                    <div className="product-modal-form-group">
                      <label htmlFor="category">Categoría *</label>
                      <select
                        id="category"
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        ref={(el) => (inputRefs.current[2] = el as any)}
                        onKeyDown={handleEnterFocusNext(2)}
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
                        <span className="product-modal-error-message">{errors.category}</span>
                      )}
                    </div>

                    <div className="product-modal-form-row">
                      <div className="product-modal-form-group">
                        <label htmlFor="price">Precio Base (1 Pieza) *</label>
                        <input
                          ref={(el) => (inputRefs.current[3] = el as any)}
                          type="number"
                          id="price"
                          name="price"
                          value={(() => {
                            const basePresentation = presentations.find(p => p.isDefault || p.quantity === 1);
                            return basePresentation ? basePresentation.unitPrice : formData.price;
                          })()}
                          onChange={(e) => {
                            const newPrice = Number(e.target.value);
                            setFormData(prev => ({ ...prev, price: newPrice }));
                            // Actualizar la presentación base
                            setPresentations(prev => prev.map(p => 
                              (p.isDefault || p.quantity === 1) 
                                ? { ...p, unitPrice: newPrice }
                                : p
                            ));
                          }}
                          onKeyDown={handleEnterFocusNext(3)}
                          className={errors.price ? "error" : ""}
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                        />
                        {errors.price && (
                          <span className="product-modal-error-message">{errors.price}</span>
                        )}
                        <small>Este es el precio de venta por pieza individual</small>
                      </div>

                      <div className="product-modal-form-group">
                        <label htmlFor="cost">Costo *</label>
                        <input
                          ref={(el) => (inputRefs.current[4] = el as any)}
                          type="number"
                          id="cost"
                          name="cost"
                          value={formData.cost}
                          onChange={handleInputChange}
                          onKeyDown={handleEnterFocusNext(4)}
                          className={errors.cost ? "error" : ""}
                          placeholder="0"
                          min="0"
                        />
                        {errors.cost && (
                          <span className="product-modal-error-message">{errors.cost}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Columna derecha - Presentaciones de Venta */}
                  <div className="product-modal-form-right">
                    <div className="product-modal-form-group">
                      <label>Presentaciones de Venta *</label>
                      <div className="product-modal-presentations-section">
                    <div className="product-modal-presentations-list">
                      {presentations.map((presentation, index) => (
                        <div key={index} className="product-modal-presentation-item">
                          <div className="product-modal-presentation-info">
                            <div className="product-modal-presentation-name">
                              <strong>{presentation.name}</strong>
                              {presentation.isDefault && <span className="product-modal-badge-default">Base</span>}
                            </div>
                            <div className="product-modal-presentation-details">
                              <span>{presentation.quantity} unidad{presentation.quantity !== 1 ? 'es' : ''}</span>
                              <span className="product-modal-separator">•</span>
                              <span>${presentation.unitPrice.toFixed(2)} c/u</span>
                              <span className="product-modal-separator">•</span>
                              <span className="product-modal-total-price">Total: ${calculateTotalPrice(presentation).toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="product-modal-presentation-actions">
                            {!(presentation.isDefault /*|| presentation.quantity === 1*/) ? (
                              <>
                                <button
                                  type="button"
                                  className="product-modal-btn-edit"
                                  onClick={() => handleEditPresentation(index)}
                                  disabled={editingPresentationIndex !== null}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className="product-modal-btn-delete"
                                  onClick={() => handleDeletePresentation(index)}
                                  disabled={editingPresentationIndex !== null}
                                >
                                  Eliminar
                                </button>
                              </>
                            ) : (
                              <span className="product-modal-presentation-base-note">Presentación base</span>
                            )}
                          </div>
                          {presentationErrors[index] && (
                            <div style={{ width: '100%', marginTop: '0.5rem' }}>
                              {Object.values(presentationErrors[index]).map((error, errIdx) => (
                                <span key={errIdx} className="product-modal-error-message">{error}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Formulario para agregar/editar presentación */}
                    {editingPresentationIndex === null ? (
                      <div className="product-modal-add-presentation-form">
                        <h4>Agregar Nueva Presentación</h4>
                        <div className="product-modal-presentation-form-row">
                          <div className="product-modal-form-group small">
                            <label htmlFor="presentationName">Nombre</label>
                            <input
                              type="text"
                              id="presentationName"
                              value={newPresentation.name}
                              onChange={(e) => setNewPresentation(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="Ej: Cono, Six, Caja"
                              className={presentationErrors[-1]?.name ? "error" : ""}
                            />
                            {presentationErrors[-1]?.name && (
                              <span className="product-modal-error-message">{presentationErrors[-1].name}</span>
                            )}
                          </div>
                          <div className="product-modal-form-group small">
                            <label htmlFor="presentationQuantity">Cantidad</label>
                            <input
                              type="number"
                              id="presentationQuantity"
                              value={newPresentation.quantity}
                              onChange={(e) => setNewPresentation(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                              min="1"
                              step="1"
                              className={presentationErrors[-1]?.quantity ? "error" : ""}
                            />
                            {presentationErrors[-1]?.quantity && (
                              <span className="product-modal-error-message">{presentationErrors[-1].quantity}</span>
                            )}
                          </div>
                          <div className="product-modal-form-group small">
                            <label htmlFor="presentationUnitPrice">Precio Unitario</label>
                            <input
                              type="number"
                              id="presentationUnitPrice"
                              value={newPresentation.unitPrice}
                              onChange={(e) => setNewPresentation(prev => ({ ...prev, unitPrice: Number(e.target.value) }))}
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              className={presentationErrors[-1]?.unitPrice ? "error" : ""}
                            />
                            {presentationErrors[-1]?.unitPrice && (
                              <span className="product-modal-error-message">{presentationErrors[-1].unitPrice}</span>
                            )}
                          </div>
                          <div className="product-modal-form-group small">
                            <label>&nbsp;</label>
                            <Button
                              type="button"
                              variant="primary"
                              onClick={handleAddPresentation}
                              className="add-presentation-btn"
                            >
                              Agregar
                            </Button>
                          </div>
                        </div>
                        {newPresentation.quantity > 0 && newPresentation.unitPrice > 0 && (
                          <div className="product-modal-presentation-preview">
                            <small>
                              Total de esta presentación: <strong>${calculateTotalPrice(newPresentation as ProductPresentation).toFixed(2)}</strong>
                            </small>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="product-modal-add-presentation-form">
                        <h4>Editar Presentación</h4>
                        <div className="product-modal-presentation-form-row">
                          <div className="product-modal-form-group small">
                            <label htmlFor="editPresentationName">Nombre</label>
                            <input
                              type="text"
                              id="editPresentationName"
                              value={newPresentation.name}
                              onChange={(e) => setNewPresentation(prev => ({ ...prev, name: e.target.value }))}
                              className={presentationErrors[editingPresentationIndex]?.name ? "error" : ""}
                            />
                            {presentationErrors[editingPresentationIndex]?.name && (
                              <span className="product-modal-error-message">{presentationErrors[editingPresentationIndex].name}</span>
                            )}
                          </div>
                          <div className="product-modal-form-group small">
                            <label htmlFor="editPresentationQuantity">Cantidad</label>
                            <input
                              type="number"
                              id="editPresentationQuantity"
                              value={newPresentation.quantity}
                              onChange={(e) => setNewPresentation(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                              min="1"
                              step="1"
                              className={presentationErrors[editingPresentationIndex]?.quantity ? "error" : ""}
                            />
                            {presentationErrors[editingPresentationIndex]?.quantity && (
                              <span className="product-modal-error-message">{presentationErrors[editingPresentationIndex].quantity}</span>
                            )}
                          </div>
                          <div className="product-modal-form-group small">
                            <label htmlFor="editPresentationUnitPrice">Precio Unitario</label>
                            <input
                              type="number"
                              id="editPresentationUnitPrice"
                              value={newPresentation.unitPrice}
                              onChange={(e) => setNewPresentation(prev => ({ ...prev, unitPrice: Number(e.target.value) }))}
                              min="0"
                              step="0.01"
                              className={presentationErrors[editingPresentationIndex]?.unitPrice ? "error" : ""}
                            />
                            {presentationErrors[editingPresentationIndex]?.unitPrice && (
                              <span className="product-modal-error-message">{presentationErrors[editingPresentationIndex].unitPrice}</span>
                            )}
                          </div>
                          <div className="product-modal-form-group small">
                            <label>&nbsp;</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <Button
                                type="button"
                                variant="success"
                                onClick={handleUpdatePresentation}
                                className="update-presentation-btn"
                              >
                                Guardar
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={handleCancelEditPresentation}
                                className="cancel-edit-btn"
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        </div>
                        {newPresentation.quantity > 0 && newPresentation.unitPrice > 0 && (
                          <div className="product-modal-presentation-preview">
                            <small>
                              Total de esta presentación: <strong>${calculateTotalPrice(newPresentation as ProductPresentation).toFixed(2)}</strong>
                            </small>
                          </div>
                        )}
                      </div>
                    )}
                      </div>
                      {errors.presentations && (
                        <span className="product-modal-error-message">{errors.presentations}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="product-modal-form-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onClose}
                    className="product-modal-cancel-btn"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" variant="success" className="product-modal-save-btn">
                    {product ? "Actualizar" : "Crear"} Producto
                  </Button>
                </div>
              </form>
            </div>
          )}
         {activeTab === "avanzado" && (
            <div className="product-modal-tab-content">
              <form onSubmit={handleSubmit} className="product-modal-form">
                    {/* Sección de Control de Inventario */}
                    <div className="product-modal-inventory-section">
                      <div className="product-modal-section-header">
                        <h3>📦 Control de Inventario</h3>
                        <p className="product-modal-section-description">
                          Activa el control de inventario para rastrear el stock de este producto automáticamente
                        </p>
                      </div>

                      <div className="product-modal-inventory-toggle-card">
                        <div className="product-modal-toggle-header">
                          <div className="product-modal-toggle-info">
                            <label htmlFor="inventory" className="product-modal-toggle-label">
                              <strong>Activar control de inventario</strong>
                            </label>
                            <p className="product-modal-toggle-description">
                              {trackInventory 
                                ? "El sistema rastreará automáticamente las entradas y salidas de este producto"
                                : "Sin control de inventario. El producto se puede vender sin límite de stock"}
                            </p>
                          </div>
                          <div className="product-modal-toggle-switch">
                            <input
                              type="checkbox"
                              id="inventory"
                              name="inventory"
                              checked={trackInventory}
                              onChange={() => setTrackInventory(!trackInventory)}
                              className="product-modal-switch-input"
                            />
                            <label htmlFor="inventory" className="product-modal-switch-label">
                              <span className="product-modal-switch-slider"></span>
                            </label>
                          </div>
                        </div>

                        {trackInventory && (
                          <div className="product-modal-inventory-fields">
                            <div className="product-modal-inventory-fields-grid">
                              <div className="product-modal-form-group">
                                <label htmlFor="initialStock">
                                  Stock Inicial *
                                  <span className="product-modal-field-hint">Cantidad disponible al crear el producto</span>
                                </label>
                                <input
                                  type="number"
                                  id="initialStock"
                                  name="initialStock"
                                  min="0"
                                  step="0.01"
                                  value={initialStock}
                                  onChange={(e) => setInitialStock(Number(e.target.value))}
                                  placeholder="Ej: 100"
                                  className={`product-modal-inventory-input ${errors.initialStock ? "error" : ""}`}
                                />
                                {errors.initialStock && (
                                  <span className="product-modal-error-message">{errors.initialStock}</span>
                                )}
                                <small className="product-modal-field-help">
                                  Establece la cantidad inicial de productos en inventario
                                </small>
                              </div>

                              <div className="product-modal-form-group">
                                <label htmlFor="minStock">
                                  Stock Mínimo *
                                  <span className="product-modal-field-hint">Nivel mínimo antes de alertar</span>
                                </label>
                                <input
                                  type="number"
                                  id="minStock"
                                  name="minStock"
                                  min="0"
                                  step="0.01"
                                  value={minStock}
                                  onChange={(e) => setMinStock(Number(e.target.value))}
                                  placeholder="Ej: 10"
                                  className={`product-modal-inventory-input ${errors.minStock ? "error" : ""}`}
                                />
                                {errors.minStock && (
                                  <span className="product-modal-error-message">{errors.minStock}</span>
                                )}
                                <small className="product-modal-field-help">
                                  Recibirás alertas cuando el stock esté por debajo de este valor
                                </small>
                              </div>
                            </div>

                            <div className="product-modal-inventory-preview">
                              <div className="product-modal-preview-item">
                                <span className="product-modal-preview-label">Stock inicial:</span>
                                <span className="product-modal-preview-value">{initialStock}</span>
                              </div>
                              <div className="product-modal-preview-item">
                                <span className="product-modal-preview-label">Stock mínimo:</span>
                                <span className="product-modal-preview-value">{minStock}</span>
                              </div>
                              {initialStock <= minStock && initialStock > 0 && (
                                <div className="product-modal-preview-warning">
                                  ⚠️ El stock inicial está en o por debajo del mínimo
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sección de Generación de Etiquetas */}
                    <div className="product-modal-label-section">
                      <div className="product-modal-section-header">
                        <h3>🏷️ Generar Etiquetas</h3>
                        <p className="product-modal-section-description">
                          Genera etiquetas con código de barras para este producto
                        </p>
                      </div>
                      <div className="product-modal-label-controls">
                        <div className="product-modal-form-group">
                          <label htmlFor="labelQuantity">Cantidad de etiquetas</label>
                          <input
                            type="number"
                            id="labelQuantity"
                            name="labelQuantity"
                            min="1"
                            value={labelQuantity}
                            onChange={(e) => setLabelQuantity(Number(e.target.value))}
                            placeholder="Ej: 5"
                          />
                        </div>

                        <Button
                          type="button"
                          variant="primary"
                          onClick={() => handleGenerateLabel(labelQuantity)}
                          className="generate-btn"
                        >
                          🖨️ Generar etiquetas PDF
                        </Button>
                      </div>
                    </div>
                <div className="product-modal-form-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onClose}
                    className="product-modal-cancel-btn"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" variant="success" className="product-modal-save-btn">
                    {product ? "Actualizar" : "Crear"} Producto
                  </Button>
                </div>
              </form>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default NewEditProductModal;

