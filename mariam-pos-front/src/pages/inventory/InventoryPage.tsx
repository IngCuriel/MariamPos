import React, { useState, useEffect, useRef } from "react";
import Header from "../../components/Header";
import Card from "../../components/Card";
import Button from "../../components/Button";
import type { Inventory, Product } from "../../types";
import { getInventory, getLowStockProducts } from "../../api/inventory";
import { getProductsFilters } from "../../api/products";
import "../../styles/pages/inventory/inventory.css";
import InventoryEntryModal from "./InventoryEntryModal";
import InventoryAdjustModal from "./InventoryAdjustModal";
import Swal from "sweetalert2";

interface InventoryPageProps {
  onBack: () => void;
}

const InventoryPage: React.FC<InventoryPageProps> = ({ onBack }) => {
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<Inventory[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    fetchInventory();
  }, []);

  useEffect(() => {
    if (searchTerm.length > 2) {
      const handler = setTimeout(() => {
        filterInventory();
      }, 300);
      return () => clearTimeout(handler);
    } else if (searchTerm.length === 0) {
      filterInventory();
    }
  }, [searchTerm, inventory, showLowStockOnly]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const data = await getInventory();
      setInventory(data);
      setFilteredInventory(data);
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

  const filterInventory = async () => {
    let filtered = [...inventory];

    // Filtrar por búsqueda
    if (searchTerm.length > 2) {
      try {
        const products = await getProductsFilters(searchTerm);
        const productIds = new Set(products.map((p) => p.id));
        filtered = filtered.filter((inv) => productIds.has(inv.productId));
      } catch (error) {
        console.error("Error filtering:", error);
      }
    }

    // Filtrar solo productos con inventario bajo
    if (showLowStockOnly) {
      filtered = filtered.filter(
        (inv) => inv.trackInventory && inv.currentStock <= inv.minStock
      );
    }

    // Filtrar solo productos que rastrean inventario
    filtered = filtered.filter((inv) => inv.trackInventory);

    setFilteredInventory(filtered);
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

  return (
    <div className="inventory-page">
      <Header title="📦 Inventario" onBack={onBack} backText="← Volver" />
      
      <div className="inventory-container">
        <Card className="inventory-card">
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

          {/* Tabla de inventario */}
          <div className="inventory-table-container">
            {loading ? (
              <div className="loading">Cargando inventario...</div>
            ) : filteredInventory.length === 0 ? (
              <div className="no-results">
                {searchTerm.length > 0
                  ? "No se encontraron productos"
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
                  {filteredInventory.map((inv) => {
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
                              title="Agregar entrada"
                            >
                              ➕ Entrada
                            </Button>
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={() => handleAdjust(inv)}
                              title="Ajustar stock"
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

          {/* Resumen */}
          {filteredInventory.length > 0 && (
            <div className="inventory-summary">
              <div className="summary-item">
                <span className="summary-label">Total productos:</span>
                <span className="summary-value">{filteredInventory.length}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Stock bajo:</span>
                <span className="summary-value stock-low">
                  {
                    filteredInventory.filter(
                      (inv) => inv.trackInventory && inv.currentStock <= inv.minStock
                    ).length
                  }
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Sin stock:</span>
                <span className="summary-value stock-out">
                  {
                    filteredInventory.filter(
                      (inv) => inv.trackInventory && inv.currentStock <= 0
                    ).length
                  }
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

