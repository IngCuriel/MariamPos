import React, { useState, useEffect, useRef } from "react";
import Button from "../../components/Button";
import Card from "../../components/Card";
import type { Product, Category, ProductPresentation } from "../../types/index";
import jsPDF from "jspdf";
import JsBarcode from "jsbarcode";

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
    <div className="modal-overlay-newEdit-product">
      <div className=".modal-newEdit-product-container">
        <Card className="modal-card">
          {/*<div className="modal-header">
            <h2>{title}</h2>
            <button className="close-btn" onClick={onClose}>
              ×
            </button>
          </div>*/}
          <div className="tab-header">
            <button
              type="button"
              className={`tab-btn ${activeTab === "producto" ? "active" : ""}`}
              onClick={() => setActiveTab("producto")}
            >
              {title}
            </button>
             {product && (<button
              type="button"
              className={`tab-btn ${activeTab === "avanzado" ? "active" : ""}`}
              onClick={() => setActiveTab("avanzado")}
            >
              Avanzado
            </button>)}
          </div>
           {activeTab === "producto" && (
            <div className="tab-content">
              <form onSubmit={handleSubmit} className="product-form">
                <div className="form-group">
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
                    <span className="error-message">{errors.code}</span>
                  )}
                </div>

                <div className="form-group">
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
                    <span className="error-message">{errors.name}</span>
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="status">Activo*</label>
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
                    <span className="error-message">{errors.category}</span>
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group">
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
                      <span className="error-message">{errors.price}</span>
                    )}
                    <small className="form-hint">Este es el precio de venta por pieza individual</small>
                  </div>

                  <div className="form-group">
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
                      <span className="error-message">{errors.cost}</span>
                    )}
                  </div>
                </div>

                {/*<div className="form-group">
                  <label htmlFor="description">Descripción</label>
                  <textarea
                    ref={(el) => (inputRefs.current[5] = el as any)}
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    onKeyDown={handleEnterFocusNext(5)}
                    placeholder="Descripción opcional del producto"
                    rows={3}
                  />
                </div>*/}

                {/* Sección de Presentaciones */}
                <div className="form-group">
                  <label>Presentaciones de Venta *</label>
                  <div className="presentations-section">
                    <div className="presentations-list">
                      {presentations.map((presentation, index) => (
                        <div key={index} className="presentation-item">
                          <div className="presentation-info">
                            <div className="presentation-name">
                              <strong>{presentation.name}</strong>
                              {presentation.isDefault && <span className="badge-default">Base</span>}
                            </div>
                            <div className="presentation-details">
                              <span>{presentation.quantity} unidad{presentation.quantity !== 1 ? 'es' : ''}</span>
                              <span className="separator">•</span>
                              <span>${presentation.unitPrice.toFixed(2)} c/u</span>
                              <span className="separator">•</span>
                              <span className="total-price">Total: ${calculateTotalPrice(presentation).toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="presentation-actions">
                            {!(presentation.isDefault || presentation.quantity === 1) ? (
                              <>
                                <button
                                  type="button"
                                  className="btn-edit"
                                  onClick={() => handleEditPresentation(index)}
                                  disabled={editingPresentationIndex !== null}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className="btn-delete"
                                  onClick={() => handleDeletePresentation(index)}
                                  disabled={editingPresentationIndex !== null}
                                >
                                  Eliminar
                                </button>
                              </>
                            ) : (
                              <span className="presentation-base-note">Presentación base</span>
                            )}
                          </div>
                          {presentationErrors[index] && (
                            <div className="presentation-errors">
                              {Object.values(presentationErrors[index]).map((error, errIdx) => (
                                <span key={errIdx} className="error-message">{error}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Formulario para agregar/editar presentación */}
                    {editingPresentationIndex === null ? (
                      <div className="add-presentation-form">
                        <h4>Agregar Nueva Presentación</h4>
                        <div className="presentation-form-row">
                          <div className="form-group small">
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
                              <span className="error-message">{presentationErrors[-1].name}</span>
                            )}
                          </div>
                          <div className="form-group small">
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
                              <span className="error-message">{presentationErrors[-1].quantity}</span>
                            )}
                          </div>
                          <div className="form-group small">
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
                              <span className="error-message">{presentationErrors[-1].unitPrice}</span>
                            )}
                          </div>
                          <div className="form-group small">
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
                          <div className="presentation-preview">
                            <small>
                              Total de esta presentación: <strong>${calculateTotalPrice(newPresentation as ProductPresentation).toFixed(2)}</strong>
                            </small>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="edit-presentation-form">
                        <h4>Editar Presentación</h4>
                        <div className="presentation-form-row">
                          <div className="form-group small">
                            <label htmlFor="editPresentationName">Nombre</label>
                            <input
                              type="text"
                              id="editPresentationName"
                              value={newPresentation.name}
                              onChange={(e) => setNewPresentation(prev => ({ ...prev, name: e.target.value }))}
                              className={presentationErrors[editingPresentationIndex]?.name ? "error" : ""}
                            />
                            {presentationErrors[editingPresentationIndex]?.name && (
                              <span className="error-message">{presentationErrors[editingPresentationIndex].name}</span>
                            )}
                          </div>
                          <div className="form-group small">
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
                              <span className="error-message">{presentationErrors[editingPresentationIndex].quantity}</span>
                            )}
                          </div>
                          <div className="form-group small">
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
                              <span className="error-message">{presentationErrors[editingPresentationIndex].unitPrice}</span>
                            )}
                          </div>
                          <div className="form-group small">
                            <label>&nbsp;</label>
                            <div className="edit-actions">
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
                          <div className="presentation-preview">
                            <small>
                              Total de esta presentación: <strong>${calculateTotalPrice(newPresentation as ProductPresentation).toFixed(2)}</strong>
                            </small>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {errors.presentations && (
                    <span className="error-message">{errors.presentations}</span>
                  )}
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
            </div>
          )}
         {activeTab === "avanzado" && (
            <div className="tab-content">
              {product && (
                  <>
                  <form onSubmit={handleSubmit} className="product-form">
                    <div className="form-group">
                      <label htmlFor="inventory">Maneja inventario</label>
                      <input
                        type="checkbox"
                        id="inventory"
                        name="inventory"
                        checked={trackInventory}
                        onChange={() => setTrackInventory(!trackInventory)}
                      />
                    </div>
                    <div className="label-section">
                       <div className="label-controls">
                        <div className="form-group small">
                          <label htmlFor="labelQuantity">Hay en este momento:</label>
                          <input
                            type="number"
                            id="labelQuantity"
                            name="labelQuantity"
                            min="1"
                            disabled
                            value={0}
                            onChange={() => {}}
                            placeholder="Ej: 5"
                          />
                        </div>
                      </div>
                    </div>
                  </form>
                  <div className="label-section">
                    <h4>Generar etiquetas</h4>
                    <div className="label-controls">
                      <div className="form-group small">
                        <label htmlFor="labelQuantity">Cantidad</label>
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
                        Generar etiquetas
                      </Button>
                    </div>
                  </div>
                </>
                )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default NewEditProductModal;

