import React, { useState, useEffect, useRef, useMemo } from "react";
import Header from "../../components/Header";
import Card from "../../components/Card";
import type { Supplier } from "../../types";
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from "../../api/suppliers";
import SupplierModal from "./SupplierModal";
import Swal from "sweetalert2";
// Reutilizamos los estilos de layout del catálogo (filtros, tabla, paginación)
// para unificar el diseño con el resto de las pantallas del sistema.
import "../../styles/pages/products/catalog.css";
import "../../styles/pages/suppliers/suppliers.css";

interface SuppliersPageProps {
  onBack: () => void;
}

const SUPPLIERS_PER_PAGE = 25;

const SuppliersPage: React.FC<SuppliersPageProps> = ({ onBack }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const data = await getSuppliers();
      setSuppliers(data);
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

  // Filtrado en cliente (la API devuelve la lista completa).
  const filteredSuppliers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.code && s.code.toLowerCase().includes(term)) ||
        (s.contactName && s.contactName.toLowerCase().includes(term)) ||
        (s.phone && s.phone.toLowerCase().includes(term)) ||
        (s.email && s.email.toLowerCase().includes(term))
    );
  }, [searchTerm, suppliers]);

  // Al cambiar la búsqueda, volver a la primera página.
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalItems = filteredSuppliers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / SUPPLIERS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * SUPPLIERS_PER_PAGE;
  const pageSuppliers = filteredSuppliers.slice(pageStart, pageStart + SUPPLIERS_PER_PAGE);

  const handleSave = async (supplierData: Omit<Supplier, "id" | "createdAt" | "updatedAt">) => {
    try {
      if (supplierToEdit) {
        await updateSupplier(supplierToEdit.id, supplierData);
        Swal.fire({ icon: "success", title: "¡Éxito!", text: "Proveedor actualizado correctamente" });
      } else {
        await createSupplier(supplierData);
        Swal.fire({ icon: "success", title: "¡Éxito!", text: "Proveedor creado correctamente" });
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
        Swal.fire({ icon: "success", title: "¡Éxito!", text: "Proveedor eliminado correctamente" });
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
      <Header title="🏭 Proveedores" onBack={onBack} backText="← Volver al Menú Principal" />

      <div className="catalog-content suppliers-content">
        {/* Sección de Filtros (mismo bloque que el catálogo) */}
        <Card className="catalog-filters-section">
          <div className="catalog-filters">
            <div className="catalog-filter-group">
              <label htmlFor="sup-search" className="catalog-filter-label">
                Buscar
              </label>
              <input
                ref={inputRef}
                id="sup-search"
                type="text"
                placeholder="Nombre, código, contacto, teléfono o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="catalog-search-input"
              />
            </div>

            <div className="catalog-filter-group catalog-actions-group">
              <button type="button" className="sup-add-btn" onClick={handleAdd}>
                ➕ Nuevo Proveedor
              </button>
            </div>
          </div>
        </Card>

        {/* Tabla de proveedores (mismo contenedor que el catálogo) */}
        <Card className="catalog-table-card sup-table-card">
          <div className="sup-table-container">
            {loading ? (
              <div className="loading">Cargando proveedores...</div>
            ) : pageSuppliers.length === 0 ? (
              <div className="no-results">
                {searchTerm ? "No se encontraron proveedores" : "No hay proveedores registrados"}
              </div>
            ) : (
              <table className="sup-table">
                <thead>
                  <tr>
                    <th className="sup-th-num">#</th>
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
                  {pageSuppliers.map((supplier, index) => (
                    <tr key={supplier.id}>
                      {/* Número consecutivo global según la página actual. */}
                      <td className="sup-td-num">{pageStart + index + 1}</td>
                      <td>
                        {supplier.code ? (
                          <span className="sup-code-badge">{supplier.code}</span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        <span className="sup-name">{supplier.name}</span>
                      </td>
                      <td>{supplier.contactName || "-"}</td>
                      <td>{supplier.phone || "-"}</td>
                      <td>{supplier.email || "-"}</td>
                      <td>
                        <span
                          className={`sup-status-badge ${
                            supplier.status === 1
                              ? "sup-status-badge--active"
                              : "sup-status-badge--inactive"
                          }`}
                        >
                          {supplier.status === 1 ? "✅ Activo" : "⛔ Inactivo"}
                        </span>
                      </td>
                      <td>
                        <div className="sup-actions">
                          <button
                            type="button"
                            className="sup-action sup-action--edit"
                            onClick={() => handleEdit(supplier)}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            type="button"
                            className="sup-action sup-action--delete"
                            onClick={() => handleDelete(supplier.id)}
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Footer con paginación (estilo catálogo) */}
        {totalItems > 0 && (
          <div className="sup-footer-bar">
            <button
              type="button"
              className="prod-page-btn"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safePage === 1}
            >
              ← Anterior
            </button>
            <span className="prod-page-info">
              Página {safePage} de {totalPages} · {totalItems.toLocaleString("es-MX")} proveedor(es)
            </span>
            <button
              type="button"
              className="prod-page-btn"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safePage === totalPages}
            >
              Siguiente →
            </button>
          </div>
        )}
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
