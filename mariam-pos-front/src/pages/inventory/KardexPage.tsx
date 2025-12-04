import React, { useState, useEffect, useRef } from "react";
import Header from "../../components/Header";
import Card from "../../components/Card";
import Button from "../../components/Button";
import type { InventoryMovement, Product } from "../../types";
import { getProductMovements } from "../../api/inventory";
import { getProductsFilters } from "../../api/products";
import "../../styles/pages/inventory/kardex.css";
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
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  
  const [products, setProducts] = useState<Product[]>([]);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    setStartDate("");
    setEndDate("");
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


  return (
    <div className="kardex-page">
      <Header title="📋 Kardex de Inventario" onBack={onBack} backText="← Volver" />
      
      <div className="kardex-container">
        <Card className="kardex-card">
          {/* Filtros */}
          <div className="kardex-filters">
            <div className="filter-row">
              <div className="filter-group" style={{ flex: 1 }}>
                <label>
                  Seleccionar Producto <span style={{ color: "#dc2626" }}>*</span>
                </label>
                {selectedProduct ? (
                  <div className="selected-product-display">
                    <div className="selected-product-info">
                      <span className="selected-product-code">{selectedProduct.code || "N/A"}</span>
                      <span className="selected-product-name">{selectedProduct.name}</span>
                    </div>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={clearProduct}
                      style={{ marginLeft: "1rem" }}
                    >
                      ✕ Cambiar
                    </Button>
                  </div>
                ) : (
                  <div className="search-wrapper">
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Buscar por código o nombre del producto..."
                      className="search-input"
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        searchProducts(e.target.value);
                        setShowProductSearch(e.target.value.length > 0);
                      }}
                      onFocus={() => {
                        if (searchTerm.length > 0) {
                          setShowProductSearch(true);
                        }
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
                            <span className="product-code">{product.code || "N/A"}</span>
                            <span className="product-name">{product.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="filter-group">
                <label>Tipo de Movimiento</label>
                <select
                  className="filter-select"
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
            </div>

            <div className="filter-row">
              <div className="filter-group">
                <label>Fecha Inicio</label>
                <input
                  type="date"
                  className="filter-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="filter-group">
                <label>Fecha Fin</label>
                <input
                  type="date"
                  className="filter-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div className="filter-group">
                {selectedProduct && (
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => {
                      setTypeFilter("ALL");
                      setStartDate("");
                      setEndDate("");
                    }}
                    style={{ marginTop: "24px" }}
                  >
                    🔄 Limpiar Filtros
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Resumen */}
          {selectedProduct && filteredMovements.length > 0 && (
            <div className="kardex-summary">
              <div className="summary-item">
                <span className="summary-label">Total Movimientos:</span>
                <span className="summary-value">{filteredMovements.length}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Entradas:</span>
                <span className="summary-value movement-entrada">
                  {filteredMovements.filter((m) => m.type === "ENTRADA").length}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Salidas:</span>
                <span className="summary-value movement-salida">
                  {filteredMovements.filter((m) => m.type === "SALIDA").length}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Ajustes:</span>
                <span className="summary-value movement-ajuste">
                  {filteredMovements.filter((m) => m.type === "AJUSTE").length}
                </span>
              </div>
            </div>
          )}

          {/* Tabla de movimientos */}
          <div className="kardex-table-container">
            {!selectedProduct ? (
              <div className="no-product-selected">
                <div className="no-product-icon">📦</div>
                <h3>Selecciona un Producto</h3>
                <p>Para ver el Kardex, primero debes seleccionar un producto usando el buscador arriba.</p>
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
              <table className="kardex-table">
                <thead>
                  <tr>
                    <th>Fecha/Hora</th>
                    <th>Producto</th>
                    <th>Código</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Existencia</th>
                    <th>Motivo</th>
                    <th>Sucursal</th>
                    <th>Caja</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map((movement) => {
                    const typeInfo = getMovementTypeLabel(movement.type);
                    const stockAfter = calculateStockAfter(movement, filteredMovements);
                    return (
                      <tr key={movement.id} className={typeInfo.class}>
                        <td>{formatDate(movement.createdAt)}</td>
                        <td>
                          <strong>{movement.product?.name || "Producto desconocido"}</strong>
                        </td>
                        <td>{movement.product?.code || "N/A"}</td>
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
      </div>
    </div>
  );
};

export default KardexPage;

