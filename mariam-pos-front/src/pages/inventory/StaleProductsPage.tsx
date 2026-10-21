import React, { useState, useEffect, useRef } from "react";
import Header from "../../components/Header";
import Card from "../../components/Card";
import CategorySelect from "../../components/CategorySelect";
import type { Category } from "../../types";
import { getCategories } from "../../api/categories";
import { getStaleProducts, type StaleProduct, type StaleProductsSummary } from "../../api/inventory";
import Swal from "sweetalert2";
import "../../styles/pages/products/catalog.css";
import "../../styles/pages/inventory/staleProducts.css";

interface StaleProductsPageProps {
  onBack: () => void;
}

const DAYS_OPTIONS = [30, 60, 90, 180];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount || 0);

const formatDate = (date: string | null) => {
  if (!date) return "Nunca";
  return new Date(date).toLocaleDateString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

// Clasificación visual de urgencia según días sin vender.
const urgencyClass = (days: number | null, everSold: boolean): string => {
  if (!everSold) return "stale-days--never";
  if (days === null) return "";
  if (days >= 90) return "stale-days--red";
  if (days >= 60) return "stale-days--orange";
  return "stale-days--yellow";
};

const StaleProductsPage: React.FC<StaleProductsPageProps> = ({ onBack }) => {
  const [rows, setRows] = useState<StaleProduct[]>([]);
  const [summary, setSummary] = useState<StaleProductsSummary | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtros. onlyStock arranca en false para que también se vean los
  // productos que NO manejan inventario (modo sin inventario).
  const [days, setDays] = useState(60);
  const [onlyStock, setOnlyStock] = useState(false);
  const [neverSold, setNeverSold] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCategories();
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    fetchStale();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, onlyStock, neverSold, selectedCategory]);

  // Búsqueda con debounce.
  useEffect(() => {
    const handler = setTimeout(() => fetchStale(), searchTerm ? 400 : 0);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const fetchCategories = async () => {
    try {
      setCategories(await getCategories());
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchStale = async () => {
    setLoading(true);
    try {
      const res = await getStaleProducts({
        days,
        onlyStock,
        neverSold,
        limit: 200,
        categoryId: selectedCategory || undefined,
        search: searchTerm.length > 2 ? searchTerm : undefined,
      });
      setRows(res.data);
      setSummary(res.summary);
    } catch (error) {
      console.error("Error fetching stale products:", error);
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo cargar el reporte de rotación" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stale-page">
      <Header title="📉 Rotación de Inventario" onBack={onBack} backText="← Volver" />

      <div className="catalog-content stale-content">
        {/* KPIs */}
        {summary && (
          <div className="stale-kpis">
            <div className="stale-kpi stale-kpi--count">
              <div className="stale-kpi-icon">😴</div>
              <div className="stale-kpi-body">
                <span className="stale-kpi-value">{summary.totalProducts}</span>
                <span className="stale-kpi-label">Productos dormidos</span>
              </div>
            </div>
            <div className="stale-kpi stale-kpi--capital">
              <div className="stale-kpi-icon">💰</div>
              <div className="stale-kpi-body">
                <span className="stale-kpi-value">{formatCurrency(summary.tiedCapital)}</span>
                <span className="stale-kpi-label">Capital inmovilizado</span>
              </div>
            </div>
            <div className="stale-kpi stale-kpi--never">
              <div className="stale-kpi-icon">🚫</div>
              <div className="stale-kpi-body">
                <span className="stale-kpi-value">{summary.neverSold}</span>
                <span className="stale-kpi-label">Nunca vendidos</span>
              </div>
            </div>
            <div className="stale-kpi stale-kpi--units">
              <div className="stale-kpi-icon">📦</div>
              <div className="stale-kpi-body">
                <span className="stale-kpi-value">{summary.totalUnits.toLocaleString("es-MX")}</span>
                <span className="stale-kpi-label">Unidades en stock</span>
              </div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <Card className="catalog-filters-section">
          <div className="catalog-filters">
            <div className="catalog-filter-group">
              <label htmlFor="stale-search" className="catalog-filter-label">
                Buscar
              </label>
              <input
                ref={searchRef}
                id="stale-search"
                type="text"
                placeholder="Código o nombre..."
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
                allLabel="Todas"
                className="csel-wide"
              />
            </div>

            <div className="catalog-filter-group">
              <label htmlFor="stale-days" className="catalog-filter-label">
                Sin vender hace
              </label>
              <select
                id="stale-days"
                className="catalog-category-select"
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value, 10))}
                disabled={neverSold}
              >
                {DAYS_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    + de {d} días
                  </option>
                ))}
              </select>
            </div>

            <div className="catalog-filter-group catalog-actions-group">
              <label className="stale-check" title="Solo productos que manejan inventario con stock > 0">
                <input
                  type="checkbox"
                  checked={onlyStock}
                  onChange={(e) => setOnlyStock(e.target.checked)}
                />
                <span>Solo con stock</span>
              </label>
              <label className="stale-check">
                <input
                  type="checkbox"
                  checked={neverSold}
                  onChange={(e) => setNeverSold(e.target.checked)}
                />
                <span>Solo nunca vendidos</span>
              </label>
            </div>
          </div>
        </Card>

        {/* Tabla */}
        <Card className="catalog-table-card stale-table-card">
          <div className="stale-table-container">
            {loading ? (
              <div className="loading">Analizando rotación...</div>
            ) : rows.length === 0 ? (
              <div className="no-results">
                🎉 No hay productos dormidos con los filtros aplicados. ¡Buena rotación!
              </div>
            ) : (
              <table className="stale-table">
                <thead>
                  <tr>
                    <th className="stale-th-num">#</th>
                    <th>Producto</th>
                    <th className="stale-th-right">Stock</th>
                    <th className="stale-th-right">Días sin vender</th>
                    <th>Última venta</th>
                    <th className="stale-th-right">Costo</th>
                    <th className="stale-th-right">Precio</th>
                    <th className="stale-th-right">Capital parado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, index) => (
                    <tr key={r.id}>
                      <td className="stale-td-num">{index + 1}</td>
                      <td>
                        <span className="stale-name">{r.name}</span>
                        <span className="stale-code">{r.code || "Sin código"}</span>
                        {r.categoryName && (
                          <span className="stale-cat">{r.categoryName}</span>
                        )}
                      </td>
                      <td className="stale-td-right stale-num">
                        {r.tracksInventory ? (
                          r.currentStock
                        ) : (
                          <span className="stale-no-inv">Sin control</span>
                        )}
                      </td>
                      <td className="stale-td-right">
                        <span className={`stale-days ${urgencyClass(r.daysWithoutSale, r.everSold)}`}>
                          {r.everSold ? `${r.daysWithoutSale} días` : "Nunca vendido"}
                        </span>
                      </td>
                      <td>{formatDate(r.lastSale)}</td>
                      <td className="stale-td-right stale-num">{formatCurrency(r.cost)}</td>
                      <td className="stale-td-right stale-num">{formatCurrency(r.price)}</td>
                      <td className="stale-td-right">
                        {r.tracksInventory ? (
                          <span className="stale-capital">{formatCurrency(r.tiedCapital)}</span>
                        ) : (
                          <span className="stale-no-inv">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Aviso cuando la lista se truncó al tope (200). */}
        {summary && summary.truncated && (
          <div className="stale-truncate-note">
            Mostrando los primeros <strong>{summary.shown}</strong> de{" "}
            <strong>{summary.totalProducts.toLocaleString("es-MX")}</strong> productos dormidos
            (ordenados por capital parado). Afiná los filtros para ver el resto.
          </div>
        )}
      </div>
    </div>
  );
};

export default StaleProductsPage;
