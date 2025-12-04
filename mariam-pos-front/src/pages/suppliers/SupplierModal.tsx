import React, { useState, useEffect } from "react";
import Button from "../../components/Button";
import Card from "../../components/Card";
import type { Supplier } from "../../types";

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (supplier: Omit<Supplier, "id" | "createdAt" | "updatedAt">) => void;
  supplierToEdit?: Supplier | null;
}

const SupplierModal: React.FC<SupplierModalProps> = ({ isOpen, onClose, onSave, supplierToEdit }) => {
  const [formData, setFormData] = useState({
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
  });

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
      setFormData({
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
      });
    }
    setErrors({});
  }, [isOpen, supplierToEdit]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
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
    <div className="modal-overlay" onClick={onClose}>
      <Card className="modal-content" onClick={(e) => e?.stopPropagation()}>
        <div className="modal-header">
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="supplier-form">
          {/* Sección: Información Básica */}
          <div className="form-section">
            <h3 className="form-section-title">
              <span className="section-icon">📋</span>
              Información Básica
            </h3>
            <div className="form-group">
              <label>
                Nombre del Proveedor <span className="required">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={errors.name ? "error" : ""}
                placeholder="Ej: Distribuidora ABC S.A. de C.V."
              />
              {errors.name && <span className="error-message">{errors.name}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Código</label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleInputChange}
                  placeholder="Código único (opcional)"
                />
              </div>

              <div className="form-group">
                <label>Estado</label>
                <select name="status" value={formData.status} onChange={handleInputChange}>
                  <option value={1}>Activo</option>
                  <option value={0}>Inactivo</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sección: Información de Contacto */}
          <div className="form-section">
            <h3 className="form-section-title">
              <span className="section-icon">📞</span>
              Información de Contacto
            </h3>
            <div className="form-group">
              <label>Nombre de Contacto</label>
              <input
                type="text"
                name="contactName"
                value={formData.contactName}
                onChange={handleInputChange}
                placeholder="Ej: Juan Pérez"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Teléfono</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Ej: 555-1234-5678"
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Ej: contacto@proveedor.com"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Dirección</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                rows={3}
                placeholder="Calle, número, colonia, ciudad, estado, CP"
              />
            </div>
          </div>

          {/* Sección: Información Fiscal */}
          <div className="form-section">
            <h3 className="form-section-title">
              <span className="section-icon">🏛️</span>
              Información Fiscal
            </h3>
            <div className="form-row">
              <div className="form-group">
                <label>RFC</label>
                <input
                  type="text"
                  name="rfc"
                  value={formData.rfc}
                  onChange={handleInputChange}
                  placeholder="Ej: ABC123456789"
                  maxLength={13}
                />
                <span className="field-hint">Registro Federal de Contribuyentes (México)</span>
              </div>

              <div className="form-group">
                <label>Tax ID</label>
                <input
                  type="text"
                  name="taxId"
                  value={formData.taxId}
                  onChange={handleInputChange}
                  placeholder="ID fiscal (otros países)"
                />
                <span className="field-hint">Identificador fiscal internacional</span>
              </div>
            </div>
          </div>

          {/* Sección: Notas Adicionales */}
          <div className="form-section">
            <h3 className="form-section-title">
              <span className="section-icon">📝</span>
              Notas Adicionales
            </h3>
            <div className="form-group">
              <label>Notas</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                placeholder="Información adicional sobre el proveedor (opcional)"
              />
            </div>
          </div>

          <div className="form-actions">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              {supplierToEdit ? "Actualizar Proveedor" : "Crear Proveedor"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default SupplierModal;

