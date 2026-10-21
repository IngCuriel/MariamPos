import React, { useState, useEffect, useRef } from "react";
import Header from "../../components/Header";
import Card from "../../components/Card";
import Button from "../../components/Button";
import type { Inventory, Category } from "../../types";
import { getInventory } from "../../api/inventory";
import { getCategories } from "../../api/categories";
import "../../styles/pages/inventory/inventory.css";
// Reutilizamos los estilos de layout del catálogo (filtros, tabla, paginación)
// para unificar el diseño entre ambas pantallas.
import "../../styles/pages/products/catalog.css";
import CategorySelect from "../../components/CategorySelect";
import InventoryEntryModal from "./InventoryEntryModal";
import InitialInventoryModal from "./InitialInventoryModal";
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
  const [showInitial, setShowInitial] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Paginación (tamaño de página fijo: 25 por página, igual que el catálogo)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;
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

  // Descompone el stock (en unidad base/pieza) usando la presentación de mayor
  // tamaño del producto. Ej: 590 pza con reja=24 → "24 rejas + 14 pza".
  // Devuelve null si el producto no tiene presentaciones mayores a 1.
  const getStockBreakdown = (inv: Inventory): string | null => {
    const presentations = inv.product?.presentations ?? [];
    // La presentación "contenedora" más grande con quantity > 1.
    const biggest = presentations
      .filter((p) => p.quantity > 1)
      .sort((a, b) => b.quantity - a.quantity)[0];
    if (!biggest) return null;

    const stock = inv.currentStock || 0;
    const packs = Math.floor(stock / biggest.quantity);
    const rest = stock % biggest.quantity;
    if (packs <= 0) return null; // no alcanza ni para un "pack", no aporta info

    const packName = biggest.name || "paquete";
    const packLabel = `${packs} ${packName}${packs !== 1 ? "s" : ""}`;
    const restLabel = rest > 0 ? ` + ${rest} pza` : "";
    return `${packLabel}${restLabel}`;
  };

  // ¿El producto del inventario tiene presentaciones (más allá de la base)?
  const hasPresentations = (inv: Inventory) =>
    Array.isArray(inv.product?.presentations) &&
    inv.product!.presentations!.some((pr) => pr.quantity > 1);

  // Popup con las presentaciones del producto (nombre, piezas, precio c/u).
  const showPresentations = (inv: Inventory) => {
    const product = inv.product;
    if (!product) return;
    const unitName = product.unit?.name || "pieza";
    const unitAbbr = product.unit?.abbreviation || "pza";
    const presentations = (product.presentations ?? [])
      .slice()
      .sort((a, b) => a.quantity - b.quantity);

    const rowsHtml = presentations
      .map((p) => {
        const isBase = p.quantity === 1 || p.isDefault;
        return `
          <tr style="border-bottom:1px solid #eef2f7;">
            <td style="padding:8px 10px;text-align:left;font-weight:600;color:#1f2937;">
              ${p.name}${isBase ? ' <span style="font-size:0.7rem;color:#2563eb;font-weight:700;">(base)</span>' : ""}
            </td>
            <td style="padding:8px 10px;text-align:center;color:#374151;">
              ${p.quantity} ${unitAbbr}
            </td>
            <td style="padding:8px 10px;text-align:right;font-weight:700;color:#047857;">
              $${Number(p.unitPrice).toFixed(2)}
            </td>
          </tr>`;
      })
      .join("");

    Swal.fire({
      title: product.name,
      html: `
        <div style="text-align:left;font-size:0.9rem;">
          <p style="margin:0 0 10px;color:#6b7280;">
            Unidad de medida: <strong style="color:#374151;">${unitName} (${unitAbbr})</strong>
          </p>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="padding:8px 10px;text-align:left;font-size:0.75rem;text-transform:uppercase;color:#475569;">Presentación</th>
                <th style="padding:8px 10px;text-align:center;font-size:0.75rem;text-transform:uppercase;color:#475569;">Contiene</th>
                <th style="padding:8px 10px;text-align:right;font-size:0.75rem;text-transform:uppercase;color:#475569;">Precio c/u</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      `,
      width: 480,
      confirmButtonText: "Cerrar",
    });
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

      <div className="catalog-content inventory-content">
        {/* Sección de Filtros (mismo bloque que el catálogo) */}
        <Card className="catalog-filters-section">
          <div className="catalog-filters">
            <div className="catalog-filter-group">
              <label htmlFor="inv-search" className="catalog-filter-label">
                Buscar
              </label>
              <input
                ref={inputRef}
                id="inv-search"
                type="text"
                placeholder="Código ó nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="catalog-search-input"
              />
            </div>

            <div className="catalog-filter-group">
              <label className="catalog-filter-label">Categoría</label>
              <CategorySelect
                categories={categories}
                value={selectedCategory}
                onChange={(id) => setSelectedCategory(id)}
                allLabel="Todas las categorías"
                className="csel-wide"
              />
            </div>

            <div className="catalog-filter-group">
              <label className="catalog-filter-label">Stock</label>
              <label className="inv-checkbox">
                <input
                  type="checkbox"
                  checked={showLowStockOnly}
                  onChange={(e) => setShowLowStockOnly(e.target.checked)}
                />
                <span>Solo stock bajo</span>
              </label>
            </div>

            <div className="catalog-filter-group catalog-actions-group">
              <label className="catalog-filter-label" style={{ visibility: "hidden" }}>
                Acciones
              </label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="inv-kardex-btn inv-initial-btn"
                  onClick={() => setShowInitial(true)}
                >
                  🗂️ Inventario inicial
                </button>
                <button
                  type="button"
                  className="inv-kardex-btn"
                  onClick={() => setShowKardex(true)}
                >
                  📋 Ver Kardex
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Tabla de inventario (mismo contenedor que el catálogo) */}
        <Card className="catalog-table-card inventory-table-card">
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
                    <th className="inv-th-num">#</th>
                    <th>Código</th>
                    <th>Producto</th>
                    <th>Stock Actual</th>
                    <th>Stock Mínimo</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((inv, index) => {
                    const status = getStockStatus(inv);
                    return (
                      <tr key={inv.id} className={status.class}>
                        {/* Número consecutivo global según la página actual. */}
                        <td className="inv-td-num">
                          {(currentPage - 1) * itemsPerPage + index + 1}
                        </td>
                        <td>{inv.product?.code || "N/A"}</td>
                        <td>
                          {hasPresentations(inv) ? (
                            <button
                              type="button"
                              className="prod-name--link"
                              title="Ver presentaciones de este producto"
                              onClick={() => showPresentations(inv)}
                              style={{ fontWeight: 700 }}
                            >
                              {inv.product?.name || "Producto desconocido"}
                            </button>
                          ) : (
                            <strong>
                              {inv.product?.name || "Producto desconocido"}
                            </strong>
                          )}
                        </td>
                        <td>
                          <span className="stock-value">{inv.currentStock}</span>
                          {(() => {
                            const bd = getStockBreakdown(inv);
                            return bd ? (
                              <span className="inv-stock-breakdown">{bd}</span>
                            ) : null;
                          })()}
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
        </Card>

        {/* Footer único: Unidades · Stock bajo · Paginación · Valor */}
        {inventory.length > 0 && (
          <div className="inv-summary-bar">
            <div className="inv-summary-stat">
              <span className="inv-summary-label">📦 Unidades (página)</span>
              <span className="inv-summary-value">
                {inventory
                  .reduce((sum, inv) => sum + (inv.currentStock || 0), 0)
                  .toLocaleString("es-MX")}
              </span>
            </div>
            <span className="inv-summary-divider" />
            <div className="inv-summary-stat">
              <span className="inv-summary-label">⚠️ Con stock bajo (página)</span>
              <span className="inv-summary-value inv-summary-value--warn">
                {
                  inventory.filter(
                    (inv) =>
                      inv.trackInventory && inv.currentStock <= inv.minStock
                  ).length
                }
              </span>
            </div>

            {/* Paginación integrada en el footer */}
            {totalPages > 1 && (
              <div className="inv-footer-pagination">
                <button
                  type="button"
                  className="prod-page-btn"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  ← Anterior
                </button>
                <span className="prod-page-info">
                  Página {currentPage} de {totalPages} ·{" "}
                  {totalItems.toLocaleString("es-MX")} productos
                </span>
                <button
                  type="button"
                  className="prod-page-btn"
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Siguiente →
                </button>
              </div>
            )}

            <div className="inv-summary-stat inv-summary-stat--total">
              <span className="inv-summary-label">💰 Valor (página)</span>
              <span className="inv-summary-value inv-summary-value--money">
                $
                {inventory
                  .reduce((sum, inv) => {
                    const cost = inv.product?.cost || 0;
                    const stock = inv.currentStock || 0;
                    return sum + cost * stock;
                  }, 0)
                  .toLocaleString("es-MX", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
              </span>
            </div>
          </div>
        )}
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

      {/* Asistente de inventario inicial por departamento */}
      <InitialInventoryModal
        isOpen={showInitial}
        onClose={() => setShowInitial(false)}
        onSuccess={() => {
          setShowInitial(false);
          fetchInventory();
        }}
      />
    </div>
  );
};

export default InventoryPage;

