import React, { useState, useEffect, useRef } from "react";
import Header from "../../components/Header";
import Card from "../../components/Card";
import type { InventoryMovement, Product } from "../../types";
import { getProductMovements } from "../../api/inventory";
import { getProductsFilters } from "../../api/products";
import "../../styles/pages/inventory/kardex.css";
// Reutilizamos el layout del inventario y del catálogo para unificar estilos.
import "../../styles/pages/inventory/inventory.css";
import "../../styles/pages/products/catalog.css";
import Swal from "sweetalert2";

interface KardexPageProps {
  onBack: () => void;
}

type MovementTypeFilter = "ALL" | "ENTRADA" | "SALIDA" | "AJUSTE" | "TRANSFERENCIA";

const KardexPage: React.FC<KardexPageProps> = ({ onBack }) => {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [filteredMovements, setFilteredMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [typeFilter, setTypeFilter] = useState<MovementTypeFilter>("ALL");
  // Por defecto, el Kardex arranca mostrando el día de hoy (formato YYYY-MM-DD).
  const today = new Date().toLocaleDateString("en-CA");
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Paginación (25 por página, como inventario/catálogo).
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (selectedProduct) {
      fetchMovements();
    } else {
      setMovements([]);
      setFilteredMovements([]);
    }
  }, [selectedProduct, startDate, endDate]);

  useEffect(() => {
    filterMovements();
  }, [movements, selectedProduct, typeFilter]);

  // Volver a la página 1 cuando cambian los resultados filtrados.
  useEffect(() => {
    setPage(1);
  }, [filteredMovements.length, selectedProduct, typeFilter, startDate, endDate]);

  const fetchMovements = async () => {
    if (!selectedProduct) {
      setMovements([]);
      setFilteredMovements([]);
      return;
    }

    setLoading(true);
    try {
      const data = await getProductMovements(selectedProduct.id);
      setMovements(data);
    } catch (error) {
      console.error("Error fetching movements:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar los movimientos del Kardex",
      });
    } finally {
      setLoading(false);
    }
  };

  const searchProducts = async (term: string) => {
    if (term.length < 2) {
      setProducts([]);
      return;
    }
    try {
      const results = await getProductsFilters(term);
      setProducts(results);
    } catch (error) {
      console.error("Error searching products:", error);
    }
  };

  const filterMovements = () => {
    if (!selectedProduct) {
      setFilteredMovements([]);
      return;
    }

    let filtered = [...movements];

    // Filtrar por tipo
    if (typeFilter !== "ALL") {
      filtered = filtered.filter((m) => m.type === typeFilter);
    }

    // Aplicar filtro de fechas si están definidas
    if (startDate || endDate) {
      filtered = filtered.filter((m) => {
        const movementDate = typeof m.createdAt === "string" ? new Date(m.createdAt) : m.createdAt;
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate + "T23:59:59") : null;
        
        if (start && movementDate < start) return false;
        if (end && movementDate > end) return false;
        return true;
      });
    }

    setFilteredMovements(filtered);
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setShowProductSearch(false);
    setProducts([]);
    setSearchTerm("");
    if (searchInputRef.current) {
      searchInputRef.current.value = product.name;
    }
  };

  const clearProduct = () => {
    setSelectedProduct(null);
    setSearchTerm("");
    setTypeFilter("ALL");
    // Volver al rango por defecto (hoy), no a vacío.
    setStartDate(today);
    setEndDate(today);
    setMovements([]);
    setFilteredMovements([]);
    if (searchInputRef.current) {
      searchInputRef.current.value = "";
    }
  };

  const getMovementTypeLabel = (type: string): { label: string; class: string; icon: string } => {
    switch (type) {
      case "ENTRADA":
        return { label: "Entrada", class: "movement-entrada", icon: "➕" };
      case "SALIDA":
        return { label: "Salida", class: "movement-salida", icon: "➖" };
      case "AJUSTE":
        return { label: "Ajuste", class: "movement-ajuste", icon: "🔧" };
      case "TRANSFERENCIA":
        return { label: "Transferencia", class: "movement-transferencia", icon: "🔄" };
      default:
        return { label: type, class: "", icon: "📦" };
    }
  };

  const formatDate = (date: Date | string): string => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString("es-MX", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Calcular existencia después de cada movimiento
  const calculateStockAfter = (movement: InventoryMovement, allMovements: InventoryMovement[]): number => {
    // Ordenar movimientos por fecha (más antiguos primero), luego por ID para estabilidad
    const sortedMovements = [...allMovements].sort((a, b) => {
      const dateA = typeof a.createdAt === "string" ? new Date(a.createdAt) : a.createdAt;
      const dateB = typeof b.createdAt === "string" ? new Date(b.createdAt) : b.createdAt;
      const dateDiff = dateA.getTime() - dateB.getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.id - b.id; // Si las fechas son iguales, ordenar por ID
    });

    // Filtrar movimientos del mismo producto
    const productMovements = sortedMovements.filter(m => m.productId === movement.productId);

    // Encontrar el índice del movimiento actual
    const currentIndex = productMovements.findIndex(m => m.id === movement.id);

    if (currentIndex === -1) return 0;

    // Calcular stock acumulado hasta este movimiento (incluyéndolo)
    let stock = 0;
    for (let i = 0; i <= currentIndex; i++) {
      const m = productMovements[i];
      switch (m.type) {
        case "ENTRADA":
          stock += m.quantity;
          break;
        case "SALIDA":
          stock -= m.quantity;
          break;
        case "AJUSTE":
          stock = m.quantity; // Ajuste establece el stock absoluto
          break;
        case "TRANSFERENCIA":
          // Las transferencias pueden ser entradas o salidas según el contexto
          // Por ahora, las tratamos como entradas (puedes ajustar según tu lógica)
          stock += m.quantity;
          break;
      }
      // Asegurar que el stock no sea negativo
      if (stock < 0) stock = 0;
    }

    return stock;
  };


  // Movimientos de la página actual.
  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / PAGE_SIZE));
  const pagedMovements = filteredMovements.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  return (
    <div className="inventory-page">
      <Header title="📋 Kardex" onBack={onBack} backText="← Volver" />

      <div className="catalog-content inventory-content">
        {/* Filtros (mismo bloque que inventario/catálogo) */}
        <Card className="catalog-filters-section">
          <div className="catalog-filters">
            <div className="catalog-filter-group" style={{ flex: 2 }}>
              <label className="catalog-filter-label">Producto *</label>
              {selectedProduct ? (
                <div className="kardex-selected-product">
                  <span className="kardex-selected-code">
                    {selectedProduct.code || "N/A"}
                  </span>
                  <span className="kardex-selected-name">
                    {selectedProduct.name}
                  </span>
                  <button
                    type="button"
                    className="kardex-change-btn"
                    onClick={clearProduct}
                  >
                    ✕ Cambiar
                  </button>
                </div>
              ) : (
                <div className="search-wrapper" style={{ position: "relative", flex: 1 }}>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Buscar por código o nombre..."
                    className="catalog-search-input"
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      searchProducts(e.target.value);
                      setShowProductSearch(e.target.value.length > 0);
                    }}
                    onFocus={() => {
                      if (searchTerm.length > 0) setShowProductSearch(true);
                    }}
                  />
                  {showProductSearch && products.length > 0 && (
                    <div className="product-search-dropdown">
                      {products.map((product) => (
                        <div
                          key={product.id}
                          className="product-search-item"
                          onClick={() => handleProductSelect(product)}
                        >
                          <span className="product-code">
                            {product.code || "N/A"}
                          </span>
                          <span className="product-name">{product.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="catalog-filter-group">
              <label className="catalog-filter-label">Tipo</label>
              <select
                className="catalog-category-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as MovementTypeFilter)}
              >
                <option value="ALL">Todos</option>
                <option value="ENTRADA">Entrada</option>
                <option value="SALIDA">Salida</option>
                <option value="AJUSTE">Ajuste</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </select>
            </div>

            <div className="catalog-filter-group">
              <label className="catalog-filter-label">Desde</label>
              <input
                type="date"
                className="catalog-category-select"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="catalog-filter-group">
              <label className="catalog-filter-label">Hasta</label>
              <input
                type="date"
                className="catalog-category-select"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Tabla de movimientos */}
        <Card className="catalog-table-card inventory-table-card">
          <div className="inventory-table-container">
            {!selectedProduct ? (
              <div className="no-product-selected">
                <div className="no-product-icon">📦</div>
                <h3>Selecciona un producto</h3>
                <p>Busca un producto arriba para ver su Kardex de movimientos.</p>
              </div>
            ) : loading ? (
              <div className="loading">Cargando Kardex...</div>
            ) : filteredMovements.length === 0 ? (
              <div className="no-results">
                {typeFilter !== "ALL" || startDate || endDate
                  ? "No se encontraron movimientos con los filtros aplicados"
                  : "No hay movimientos registrados para este producto"}
              </div>
            ) : (
              <table className="inventory-table kardex-table">
                <thead>
                  <tr>
                    <th className="inv-th-num">#</th>
                    <th>Fecha/Hora</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Existencia</th>
                    <th>Motivo</th>
                    <th>Sucursal</th>
                    <th>Caja</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedMovements.map((movement, index) => {
                    const typeInfo = getMovementTypeLabel(movement.type);
                    const stockAfter = calculateStockAfter(
                      movement,
                      filteredMovements
                    );
                    return (
                      <tr key={movement.id} className={typeInfo.class}>
                        <td className="inv-td-num">
                          {(page - 1) * PAGE_SIZE + index + 1}
                        </td>
                        <td>{formatDate(movement.createdAt)}</td>
                        <td>
                          <span className={`movement-type-badge ${typeInfo.class}`}>
                            {typeInfo.icon} {typeInfo.label}
                          </span>
                        </td>
                        <td>
                          <span className="quantity-value">{movement.quantity}</span>
                        </td>
                        <td>
                          <span className="stock-after-value">{stockAfter}</span>
                        </td>
                        <td>{movement.reason || "-"}</td>
                        <td>{movement.branch || "-"}</td>
                        <td>{movement.cashRegister || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Footer: resumen compacto + paginación */}
        {selectedProduct && filteredMovements.length > 0 && (
          <div className="inv-summary-bar">
            <div className="inv-summary-stat">
              <span className="inv-summary-label">📋 Movimientos</span>
              <span className="inv-summary-value">
                {filteredMovements.length}
              </span>
            </div>
            <span className="inv-summary-divider" />
            <div className="inv-summary-stat">
              <span className="inv-summary-label">➕ Entradas</span>
              <span className="inv-summary-value" style={{ color: "#047857" }}>
                {filteredMovements.filter((m) => m.type === "ENTRADA").length}
              </span>
            </div>
            <div className="inv-summary-stat">
              <span className="inv-summary-label">➖ Salidas</span>
              <span className="inv-summary-value" style={{ color: "#b91c1c" }}>
                {filteredMovements.filter((m) => m.type === "SALIDA").length}
              </span>
            </div>

            {/* Paginación integrada */}
            {totalPages > 1 && (
              <div className="inv-footer-pagination">
                <button
                  type="button"
                  className="prod-page-btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  ← Anterior
                </button>
                <span className="prod-page-info">
                  Página {page} de {totalPages}
                </span>
                <button
                  type="button"
                  className="prod-page-btn"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Siguiente →
                </button>
              </div>
            )}

            <div className="inv-summary-stat inv-summary-stat--total">
              <span className="inv-summary-label">🔧 Ajustes</span>
              <span className="inv-summary-value" style={{ color: "#b45309" }}>
                {filteredMovements.filter((m) => m.type === "AJUSTE").length}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KardexPage;

