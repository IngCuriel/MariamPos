import React, { useState, useEffect } from "react";
import type { Supplier } from "../../types";
import "../../styles/pages/suppliers/suppliers.css";

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (supplier: Omit<Supplier, "id" | "createdAt" | "updatedAt">) => void;
  supplierToEdit?: Supplier | null;
}

const EMPTY_FORM = {
  name: "",
  code: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  rfc: "",
  taxId: "",
  notes: "",
  status: 1,
};

const SupplierModal: React.FC<SupplierModalProps> = ({ isOpen, onClose, onSave, supplierToEdit }) => {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (supplierToEdit) {
      setFormData({
        name: supplierToEdit.name || "",
        code: supplierToEdit.code || "",
        contactName: supplierToEdit.contactName || "",
        phone: supplierToEdit.phone || "",
        email: supplierToEdit.email || "",
        address: supplierToEdit.address || "",
        rfc: supplierToEdit.rfc || "",
        taxId: supplierToEdit.taxId || "",
        notes: supplierToEdit.notes || "",
        status: supplierToEdit.status || 1,
      });
    } else {
      setFormData(EMPTY_FORM);
    }
    setErrors({});
  }, [isOpen, supplierToEdit]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : name === "status" ? Number(value) : value,
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = "El nombre es requerido";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const supplierData: Omit<Supplier, "id" | "createdAt" | "updatedAt"> = {
        name: formData.name.trim(),
        code: formData.code.trim() || undefined,
        contactName: formData.contactName.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
        rfc: formData.rfc.trim() || undefined,
        taxId: formData.taxId.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        status: formData.status,
      };
      onSave(supplierData);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="sup-form-overlay" onClick={onClose}>
      <div className="sup-form-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sup-form-header">
          <h1>{supplierToEdit ? "Editar Proveedor" : "Nuevo Proveedor"}</h1>
          <button type="button" className="sup-form-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="sup-form">
          {/* Información Básica */}
          <div className="sup-form-section">
            <h3 className="sup-form-section-title">
              <span className="section-icon">📋</span>
              Información Básica
            </h3>

            <div className="sup-form-group">
              <label htmlFor="sup-name">
                Nombre del Proveedor <span className="sup-form-required">*</span>
              </label>
              <input
                type="text"
                id="sup-name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={errors.name ? "error" : ""}
                placeholder="Ej: Distribuidora ABC S.A. de C.V."
              />
              {errors.name && <span className="sup-form-error">{errors.name}</span>}
            </div>

            <div className="sup-form-row">
              <div className="sup-form-group">
                <label htmlFor="sup-code">Código</label>
                <input
                  type="text"
                  id="sup-code"
                  name="code"
                  value={formData.code}
                  onChange={handleInputChange}
                  placeholder="Código único (opcional)"
                />
              </div>

              <div className="sup-form-group">
                <label htmlFor="sup-status">Estado</label>
                <select id="sup-status" name="status" value={formData.status} onChange={handleInputChange}>
                  <option value={1}>Activo</option>
                  <option value={0}>Inactivo</option>
                </select>
              </div>
            </div>
          </div>

          {/* Información de Contacto */}
          <div className="sup-form-section">
            <h3 className="sup-form-section-title">
              <span className="section-icon">📞</span>
              Información de Contacto
            </h3>

            <div className="sup-form-group">
              <label htmlFor="sup-contact">Nombre de Contacto</label>
              <input
                type="text"
                id="sup-contact"
                name="contactName"
                value={formData.contactName}
                onChange={handleInputChange}
                placeholder="Ej: Juan Pérez"
              />
            </div>

            <div className="sup-form-row">
              <div className="sup-form-group">
                <label htmlFor="sup-phone">Teléfono</label>
                <input
                  type="text"
                  id="sup-phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Ej: 555-1234-5678"
                />
              </div>

              <div className="sup-form-group">
                <label htmlFor="sup-email">Email</label>
                <input
                  type="email"
                  id="sup-email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Ej: contacto@proveedor.com"
                />
              </div>
            </div>

            <div className="sup-form-group">
              <label htmlFor="sup-address">Dirección</label>
              <textarea
                id="sup-address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                rows={2}
                placeholder="Calle, número, colonia, ciudad, estado, CP"
              />
            </div>
          </div>

          {/* Información Fiscal */}
          <div className="sup-form-section">
            <h3 className="sup-form-section-title">
              <span className="section-icon">🏛️</span>
              Información Fiscal
            </h3>

            <div className="sup-form-row">
              <div className="sup-form-group">
                <label htmlFor="sup-rfc">RFC</label>
                <input
                  type="text"
                  id="sup-rfc"
                  name="rfc"
                  value={formData.rfc}
                  onChange={handleInputChange}
                  placeholder="Ej: ABC123456789"
                  maxLength={13}
                />
                <span className="sup-field-hint">RFC (México)</span>
              </div>

              <div className="sup-form-group">
                <label htmlFor="sup-taxid">Tax ID</label>
                <input
                  type="text"
                  id="sup-taxid"
                  name="taxId"
                  value={formData.taxId}
                  onChange={handleInputChange}
                  placeholder="ID fiscal (otros países)"
                />
                <span className="sup-field-hint">Identificador fiscal internacional</span>
              </div>
            </div>
          </div>

          {/* Notas */}
          <div className="sup-form-section">
            <h3 className="sup-form-section-title">
              <span className="section-icon">📝</span>
              Notas Adicionales
            </h3>
            <div className="sup-form-group">
              <textarea
                id="sup-notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={2}
                placeholder="Información adicional sobre el proveedor (opcional)"
              />
            </div>
          </div>
        </form>

        {/* Acciones (fuera del scroll, ancladas al pie) */}
        <div className="sup-form-actions">
          <button type="button" className="sup-btn sup-btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="sup-btn sup-btn--success" onClick={handleSubmit}>
            {supplierToEdit ? "Guardar Cambios" : "Crear Proveedor"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupplierModal;
