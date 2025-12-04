import React, { useState, useEffect, useRef } from "react";
import Header from "../../components/Header";
import Card from "../../components/Card";
import Button from "../../components/Button";
import type { Inventory, Category } from "../../types";
import { getInventory } from "../../api/inventory";
import { getCategories } from "../../api/categories";
import "../../styles/pages/inventory/inventory.css";
import InventoryEntryModal from "./InventoryEntryModal";
import InventoryAdjustModal from "./InventoryAdjustModal";
import KardexPage from "./KardexPage";
import Swal from "sweetalert2";

interface InventoryPageProps {
  onBack: () => void;
}

const InventoryPage: React.FC<InventoryPageProps> = ({ onBack }) => {
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showKardex, setShowKardex] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    fetchCategories();
    fetchInventory();
  }, [currentPage, itemsPerPage, selectedCategory, showLowStockOnly]);

  useEffect(() => {
    if (searchTerm.length > 2) {
      const handler = setTimeout(() => {
        setCurrentPage(1); // Resetear a primera página al buscar
        fetchInventory();
      }, 500);
      return () => clearTimeout(handler);
    } else if (searchTerm.length === 0) {
      setCurrentPage(1);
      fetchInventory();
    }
  }, [searchTerm]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const search = searchTerm.length > 2 ? searchTerm : undefined;
      const response = await getInventory(
        currentPage,
        itemsPerPage,
        search,
        selectedCategory || undefined,
        showLowStockOnly
      );
      
      setInventory(response.data);
      setTotalItems(response.pagination.total);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo cargar el inventario",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const handleEntry = (inventory: Inventory) => {
    setSelectedInventory(inventory);
    setShowEntryModal(true);
  };

  const handleAdjust = (inventory: Inventory) => {
    setSelectedInventory(inventory);
    setShowAdjustModal(true);
  };

  const handleModalClose = () => {
    setShowEntryModal(false);
    setShowAdjustModal(false);
    setSelectedInventory(null);
    fetchInventory(); // Refrescar inventario después de cambios
  };

  const getStockStatus = (inv: Inventory): { class: string; label: string } => {
    if (!inv.trackInventory) {
      return { class: "stock-disabled", label: "Sin control" };
    }
    if (inv.currentStock <= 0) {
      return { class: "stock-out", label: "Sin stock" };
    }
    if (inv.currentStock <= inv.minStock) {
      return { class: "stock-low", label: "Stock bajo" };
    }
    return { class: "stock-ok", label: "Disponible" };
  };

  // Si se muestra el Kardex, renderizar ese componente
  if (showKardex) {
    return <KardexPage onBack={() => setShowKardex(false)} />;
  }

  return (
    <div className="inventory-page">
      <Header title="📦 Inventario" onBack={onBack} backText="← Volver" />
      
      <div className="inventory-container">
        <Card className="inventory-card">
          {/* Botón para acceder al Kardex */}
          <div className="inventory-actions-header">
            <Button
              variant="primary"
              onClick={() => setShowKardex(true)}
              style={{ marginBottom: "1rem" }}
            >
              📋 Ver Kardex de Inventario
            </Button>
          </div>

          {/* Barra de búsqueda y filtros */}
          <div className="inventory-filters">
            <div className="search-section">
              <input
                ref={inputRef}
                type="text"
                placeholder="Buscar producto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            <div className="filter-section">
              <select
                className="filter-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">Todas las categorías</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-section">
              <label className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={showLowStockOnly}
                  onChange={(e) => setShowLowStockOnly(e.target.checked)}
                />
                <span>Mostrar solo stock bajo</span>
              </label>
            </div>
          </div>

          {/* Información de paginación */}
          {!loading && inventory.length > 0 && (
            <div className="inventory-pagination-info">
              <span>
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems.toLocaleString('es-MX')} productos
                {totalItems > 1000 && (
                  <span className="performance-note">
                    {" "}⚡ Sistema optimizado para grandes volúmenes
                  </span>
                )}
              </span>
              <select
                className="items-per-page-select"
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={25}>25 por página</option>
                <option value={50}>50 por página</option>
                <option value={100}>100 por página</option>
                <option value={200}>200 por página</option>
              </select>
            </div>
          )}

          {/* Tabla de inventario */}
          <div className="inventory-table-container">
            {loading ? (
              <div className="loading">Cargando inventario...</div>
            ) : inventory.length === 0 ? (
              <div className="no-results">
                {searchTerm.length > 0 || selectedCategory || showLowStockOnly
                  ? "No se encontraron productos con los filtros aplicados"
                  : "No hay productos con inventario activo"}
              </div>
            ) : (
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Producto</th>
                    <th>Stock Actual</th>
                    <th>Stock Mínimo</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((inv) => {
                    const status = getStockStatus(inv);
                    return (
                      <tr key={inv.id} className={status.class}>
                        <td>{inv.product?.code || "N/A"}</td>
                        <td>
                          <strong>{inv.product?.name || "Producto desconocido"}</strong>
                        </td>
                        <td>
                          <span className="stock-value">{inv.currentStock}</span>
                        </td>
                        <td>{inv.minStock}</td>
                        <td>
                          <span className={`status-badge ${status.class}`}>
                            {status.label}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <Button
                              variant="primary"
                              size="small"
                              onClick={() => handleEntry(inv)}
                            >
                              ➕ Entrada
                            </Button>
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={() => handleAdjust(inv)}
                            >
                              🔧 Ajustar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Controles de paginación */}
          {!loading && totalPages > 1 && (
            <div className="inventory-pagination">
              <Button
                variant="secondary"
                size="small"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                ⏮️ Primera
              </Button>
              <Button
                variant="secondary"
                size="small"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                ◀️ Anterior
              </Button>
              <span className="pagination-info">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="secondary"
                size="small"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Siguiente ▶️
              </Button>
              <Button
                variant="secondary"
                size="small"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                Última ⏭️
              </Button>
            </div>
          )}

          {/* Resumen */}
          {inventory.length > 0 && (
            <div className="inventory-summary">
              <div className="summary-item">
                <span className="summary-label">Total productos:</span>
                <span className="summary-value">{totalItems.toLocaleString('es-MX')}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">En esta página:</span>
                <span className="summary-value">{inventory.length}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Total unidades (página):</span>
                <span className="summary-value">
                  {inventory.reduce((sum, inv) => sum + (inv.currentStock || 0), 0).toLocaleString('es-MX')}
                </span>
              </div>
              <div className="summary-item summary-item-total">
                <span className="summary-label">Valor total (página):</span>
                <span className="summary-value summary-total-value">
                  ${inventory.reduce((sum, inv) => {
                    const cost = inv.product?.cost || 0;
                    const stock = inv.currentStock || 0;
                    return sum + (cost * stock);
                  }, 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Modales */}
      {showEntryModal && selectedInventory && (
        <InventoryEntryModal
          inventory={selectedInventory}
          isOpen={showEntryModal}
          onClose={handleModalClose}
          onSuccess={handleModalClose}
        />
      )}

      {showAdjustModal && selectedInventory && (
        <InventoryAdjustModal
          inventory={selectedInventory}
          isOpen={showAdjustModal}
          onClose={handleModalClose}
          onSuccess={handleModalClose}
        />
      )}
    </div>
  );
};

export default InventoryPage;

