import React, { useState, useEffect, useRef } from "react";
import Button from "../../components/Button";
import Card from "../../components/Card";
import type { Product, Category } from "../../types/index";
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      }
      setErrors({});
    }
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

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.code.trim()) newErrors.code = "Codigo es requerido";
    if (!formData.name.trim()) newErrors.name = "El nombre es requerido";
    if (!formData.price || Number(formData.price) <= 0)
      newErrors.price = "El precio debe ser mayor a 0";
    if (!formData.category.trim())
      newErrors.category = "La categoria es requerida";
    if (!formData.cost || Number(formData.cost) < 0)
      newErrors.cost = "El costo debe ser 0 o mayor";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      const productToSave: Omit<Product, "createdAt"> = {
        id: formData.id,
        code: formData.code.trim(),
        name: formData.name.trim(),
        status: status,
        saleType: saleType,
        price: Number(formData.price),
        cost: Number(formData.cost),
        icon: '',
        description: formData.description.trim(),
        categoryId: formData.category,
        category: categories.find((cat) => cat.id === formData.category),
      };
      onSave(productToSave);
    }
  };
  
  const handleGenerateLabel = () => {
      if (!product) return;

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "cm",
        format: "a4",
      });

      // 🔹 Tamaño de cada etiqueta
      const labelWidth = 4;
      const labelHeight = 2;

      // 🔹 Márgenes entre etiquetas
      const marginX = 0.5;
      const marginY = 0.5;

      // 🔹 Número de etiquetas por fila y columna
      const pageWidth = 21; // A4 ancho (cm)
      const pageHeight = 29.7; // A4 alto (cm)
      const labelsPerRow = Math.floor(pageWidth / (labelWidth + marginX));
      const labelsPerCol = Math.floor(pageHeight / (labelHeight + marginY));

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
      const totalLabelsPerPage = labelsPerRow * labelsPerCol;

      for (let i = 0; i < totalLabelsPerPage; i++) {
        doc.setLineWidth(0.05);
        // Dibuja el contorno de la etiqueta (opcional)
        doc.rect(x, y, labelWidth, labelHeight);

        // Dibuja el código de barras
        doc.addImage(barcodeImg, "PNG", x + 0.2, y + 0.2, labelWidth - 0.4, 0.8);

        // Agrega el código numérico
        doc.setFontSize(8);
        doc.text(product.code.toString(), x + labelWidth / 2, y + 1.2, { align: "center" });

        // Agrega el nombre del producto
        doc.setFontSize(7);
        const name = product.name.length > 20 ? product.name.slice(0, 20) + "..." : product.name;
        doc.text(name, x + labelWidth / 2, y + 1.6, { align: "center" });

        // Agrega el precio
        doc.setFontSize(8);
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
                <label htmlFor="price">Precio *</label>
                <input
                  ref={(el) => (inputRefs.current[3] = el as any)}
                  type="number"
                  id="price"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  onKeyDown={handleEnterFocusNext(3)}
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

            <div className="form-group">
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
            </div>

            <div className="form-actions">
              { product &&
              <Button
                type="button"
                variant="primary"
                onClick={handleGenerateLabel}
                className="cancel-btn"
              >
                Generar etiqueta
              </Button>
              }
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

