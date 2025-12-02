import React, { useState, useEffect } from "react";
import Header from "../../components/Header";
import Card from "../../components/Card";
import Button from "../../components/Button";
import type { Supplier } from "../../types";
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from "../../api/suppliers";
import SupplierModal from "./SupplierModal";
import Swal from "sweetalert2";
import "../../styles/pages/suppliers/suppliers.css";

interface SuppliersPageProps {
  onBack: () => void;
}

const SuppliersPage: React.FC<SuppliersPageProps> = ({ onBack }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredSuppliers(suppliers);
    } else {
      const searchLower = searchTerm.toLowerCase();
      setFilteredSuppliers(
        suppliers.filter(
          (s) =>
            s.name.toLowerCase().includes(searchLower) ||
            (s.code && s.code.toLowerCase().includes(searchLower)) ||
            (s.contactName && s.contactName.toLowerCase().includes(searchLower)) ||
            (s.phone && s.phone.toLowerCase().includes(searchLower)) ||
            (s.email && s.email.toLowerCase().includes(searchLower))
        )
      );
    }
  }, [searchTerm, suppliers]);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const data = await getSuppliers();
      setSuppliers(data);
      setFilteredSuppliers(data);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar los proveedores",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (supplierData: Omit<Supplier, "id" | "createdAt" | "updatedAt">) => {
    try {
      if (supplierToEdit) {
        await updateSupplier(supplierToEdit.id, supplierData);
        Swal.fire({
          icon: "success",
          title: "¡Éxito!",
          text: "Proveedor actualizado correctamente",
        });
      } else {
        await createSupplier(supplierData);
        Swal.fire({
          icon: "success",
          title: "¡Éxito!",
          text: "Proveedor creado correctamente",
        });
      }
      fetchSuppliers();
    } catch (error: any) {
      console.error("Error saving supplier:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.error || "No se pudo guardar el proveedor",
      });
    }
  };

  const handleDelete = async (id: number) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar proveedor?",
      text: "Esta acción no se puede deshacer",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      try {
        await deleteSupplier(id);
        Swal.fire({
          icon: "success",
          title: "¡Éxito!",
          text: "Proveedor eliminado correctamente",
        });
        fetchSuppliers();
      } catch (error: any) {
        console.error("Error deleting supplier:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.response?.data?.error || "No se pudo eliminar el proveedor",
        });
      }
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setSupplierToEdit(supplier);
    setShowModal(true);
  };

  const handleAdd = () => {
    setSupplierToEdit(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSupplierToEdit(null);
  };

  return (
    <div className="suppliers-page">
      <Header title="👥 Proveedores" onBack={onBack} backText="← Volver" />

      <div className="suppliers-container">
        <Card className="suppliers-card">
          <div className="suppliers-header">
            <div className="search-section">
              <input
                type="text"
                placeholder="Buscar proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            <Button variant="primary" onClick={handleAdd}>
              ➕ Nuevo Proveedor
            </Button>
          </div>

          {loading ? (
            <div className="loading">Cargando proveedores...</div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="no-results">
              {searchTerm ? "No se encontraron proveedores" : "No hay proveedores registrados"}
            </div>
          ) : (
            <div className="suppliers-table-container">
              <table className="suppliers-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nombre</th>
                    <th>Contacto</th>
                    <th>Teléfono</th>
                    <th>Email</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((supplier) => (
                    <tr key={supplier.id}>
                      <td>{supplier.code || "N/A"}</td>
                      <td>
                        <strong>{supplier.name}</strong>
                      </td>
                      <td>{supplier.contactName || "-"}</td>
                      <td>{supplier.phone || "-"}</td>
                      <td>{supplier.email || "-"}</td>
                      <td>
                        <span className={`status-badge ${supplier.status === 1 ? "active" : "inactive"}`}>
                          {supplier.status === 1 ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <Button variant="secondary" size="small" onClick={() => handleEdit(supplier)}>
                            ✏️ Editar
                          </Button>
                          <Button variant="danger" size="small" onClick={() => handleDelete(supplier.id)}>
                            🗑️ Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredSuppliers.length > 0 && (
            <div className="suppliers-summary">
              <span>Total: {filteredSuppliers.length} proveedor(es)</span>
            </div>
          )}
        </Card>
      </div>

      {showModal && (
        <SupplierModal
          isOpen={showModal}
          onClose={handleCloseModal}
          onSave={handleSave}
          supplierToEdit={supplierToEdit}
        />
      )}
    </div>
  );
};

export default SuppliersPage;

