import React, { useEffect, useState } from "react";
import Card from '../../components/Card';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  CartesianGrid
} from "recharts";
import Header from "../../components/Header";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { 
  getSales,
  getSalesSummary, 
  getDailySales, 
  getTopProducts, 
  getSalesByPaymentMethod,
  getSalesByCategory,
  getSalesByClient,
  getTopProductsByCategory,
  type CategoryTopProducts
} from "../../api/sales";
import "../../styles/pages/report/report.css";

interface Summary {
  totalVentas: number;
  totalDinero: number;
}

interface DailySale {
  date: string;
  total: number;
}

interface TopProduct {
  productName: string;
  code?: string | null;
  _sum: { quantity: number };
}

interface CategorySale {
  categoryName: string;
  total: number;
  quantity: number;
}

interface ClientSale {
  clientName: string;
  total: number;
  count: number;
}

interface DashboardSalesPageProps {
  onBack: () => void;
}

const DashboardSalesPage: React.FC<DashboardSalesPageProps> = ({ onBack }) => {
  const [summary, setSummary] = useState<Summary | null>({ totalVentas: 0, totalDinero: 0 });
  const [dailySales, setDailySales] = useState<DailySale[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [byPayment, setByPayment] = useState<Record<string, unknown>[]>([]);
  const [byCategory, setByCategory] = useState<CategorySale[]>([]);
  const [byClient, setByClient] = useState<ClientSale[]>([]);
  const [topByCategory, setTopByCategory] = useState<CategoryTopProducts[]>([]);
  const [loading, setLoading] = useState(false);

  // Pestaña activa del reporte.
  const [activeTab, setActiveTab] = useState<"resumen" | "productos" | "categorias" | "clientes">(
    "resumen"
  );

  // Filtros
  const [filter, setFilter] = useState<"day" | "week" | "month" | "custom">("day");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedCashRegister, setSelectedCashRegister] = useState<string>("all");
  const [availableCashRegisters, setAvailableCashRegisters] = useState<string[]>([]);

  useEffect(() => {
    loadCashRegisters();
  }, []);

  useEffect(() => {
    fetchData();
  }, [filter, startDate, endDate, selectedCashRegister]);

  const loadCashRegisters = async () => {
    try {
      const sales = await getSales();
      // Obtener cajas únicas de las ventas
      const uniqueCashRegisters = Array.from(
        new Set(sales.map(sale => sale.cashRegister).filter(Boolean))
      ).sort() as string[];
      setAvailableCashRegisters(uniqueCashRegisters);
    } catch (error) {
      console.error("Error al cargar cajas:", error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter === "custom" && startDate && endDate) {
        // Usar toLocaleDateString para obtener la fecha en hora local (YYYY-MM-DD)
        // Esto evita problemas de zona horaria con toISOString()
        params.start = startDate.toLocaleDateString('en-CA');
        params.end = endDate.toLocaleDateString('en-CA');
      } else {
        params.range = filter;
      }
      
      // Agregar filtro de caja si no es "all"
      if (selectedCashRegister && selectedCashRegister !== "all") {
        params.cashRegister = selectedCashRegister;
      }

      const [
        resSummary,
        resDaily,
        resTopProducts,
        resPaymentMethod,
        resCategory,
        resClient,
        resTopByCategory
      ] = await Promise.all([
        getSalesSummary(params),
        getDailySales(params),
        getTopProducts(params),
        getSalesByPaymentMethod(params),
        getSalesByCategory(params),
        getSalesByClient(params),
        getTopProductsByCategory(params)
      ]);

      setSummary(resSummary);
      setDailySales(resDaily);
      setTopProducts(resTopProducts);
      setTopByCategory(resTopByCategory);
      
      const paymentData: Record<string, unknown>[] = resPaymentMethod.map((item) => ({
        name: item.paymentMethod || 'Sin método',
        value: item._sum.total,
      }));
      setByPayment(paymentData);
      
      setByCategory(resCategory);
      setByClient(resClient);
    } catch (error) {
      console.error("Error al cargar dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const colors = ["#4F46E5", "#16A34A", "#F59E0B", "#DC2626", "#2563EB", "#9333EA", "#EC4899", "#14B8A6"];
 
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
  };

  return (
    <div className="report-page">
      <div className="report-container">
        <Header
          title="📊 Reportes de Ventas"
          onBack={onBack}
          backText="← Volver al Menú"
          className="report-header"
        />

        {/* Barra superior: filtros + KPIs en una sola fila */}
        <div className="rep-topbar">
        {/* Filtros */}
        <div className="report-filters">
          <div className="filter-buttons">
            <button
              onClick={() => {
                setFilter("day");
                setStartDate(null);
                setEndDate(null);
              }}
              className={`filter-btn ${filter === "day" ? "active" : ""}`}
            >
              📅 Hoy
            </button>
            <button
              onClick={() => {
                setFilter("week");
                setStartDate(null);
                setEndDate(null);
              }}
              className={`filter-btn ${filter === "week" ? "active" : ""}`}
            >
              📆 Últimos 7 días
            </button>
            <button
              onClick={() => {
                setFilter("month");
                setStartDate(null);
                setEndDate(null);
              }}
              className={`filter-btn ${filter === "month" ? "active" : ""}`}
            >
              📊 Este mes
            </button>
            <button
              onClick={() => setFilter("custom")}
              className={`filter-btn ${filter === "custom" ? "active" : ""}`}
            >
              🗓️ Personalizado
            </button>
          </div>

          {filter === "custom" && (
            <div className="custom-date-filters">
              <div className="date-filter-group">
                <label>Desde:</label>
                <DatePicker
                  selected={startDate}
                  onChange={(date) => setStartDate(date)}
                  dateFormat="dd/MM/yyyy"
                  className="date-picker-input"
                  placeholderText="Seleccionar fecha"
                />
              </div>
              <div className="date-filter-group">
                <label>Hasta:</label>
                <DatePicker
                  selected={endDate}
                  onChange={(date) => setEndDate(date)}
                  dateFormat="dd/MM/yyyy"
                  className="date-picker-input"
                  placeholderText="Seleccionar fecha"
                  minDate={startDate || undefined}
                />
              </div>
            </div>
          )}

          {/* Filtro de Caja */}
          <div className="cash-register-filter">
            <label htmlFor="cashRegister-select">🏪 Caja:</label>
            <select
              id="cashRegister-select"
              value={selectedCashRegister}
              onChange={(e) => setSelectedCashRegister(e.target.value)}
              className="cash-register-select"
            >
              <option value="all">Todas las cajas</option>
              {availableCashRegisters.map((cashRegister) => (
                <option key={cashRegister} value={cashRegister}>
                  {cashRegister}
                </option>
              ))}
            </select>
          </div>
        </div>
        </div>
        {/* /rep-topbar (solo filtros) */}

        {/* Resumen discreto en una sola línea (no estorba los reportes) */}
        <div className="rep-summary-strip">
          <span className="rep-pill">
            💰 <strong>{summary?.totalVentas ?? 0}</strong> ventas
          </span>
          <span className="rep-pill-sep" />
          <span className="rep-pill">
            💵 <strong>{formatCurrency(summary?.totalDinero ?? 0)}</strong> generado
          </span>
          <span className="rep-pill-sep" />
          <span className="rep-pill">
            📦 <strong>{topProducts.reduce((acc, p) => acc + (p._sum.quantity || 0), 0)}</strong> uds
          </span>
          <span className="rep-pill-sep" />
          <span className="rep-pill">
            🎟️{" "}
            <strong>
              {formatCurrency(
                summary && summary.totalVentas > 0
                  ? (summary.totalDinero ?? 0) / summary.totalVentas
                  : 0
              )}
            </strong>{" "}
            ticket
          </span>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Cargando reportes...</p>
          </div>
        ) : (
          <>
            {/* Pestañas */}
            <div className="rep-tabs">
              <button
                className={`rep-tab ${activeTab === "resumen" ? "rep-tab--active" : ""}`}
                onClick={() => setActiveTab("resumen")}
              >
                📈 Resumen
              </button>
              <button
                className={`rep-tab ${activeTab === "productos" ? "rep-tab--active" : ""}`}
                onClick={() => setActiveTab("productos")}
              >
                🏷️ Productos
              </button>
              <button
                className={`rep-tab ${activeTab === "categorias" ? "rep-tab--active" : ""}`}
                onClick={() => setActiveTab("categorias")}
              >
                📂 Por Categoría
              </button>
              <button
                className={`rep-tab ${activeTab === "clientes" ? "rep-tab--active" : ""}`}
                onClick={() => setActiveTab("clientes")}
              >
                👥 Clientes
              </button>
            </div>

            {/* ===== PESTAÑA: RESUMEN ===== */}
            {activeTab === "resumen" && (
              <div className="rep-tab-content">
                <div className="charts-grid">
                  <Card className="chart-card">
                    <div className="chart-header">
                      <h3>📈 Ventas por Día</h3>
                      <p className="chart-subtitle">Evolución diaria de ventas</p>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={dailySales}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: "#6b7280" }}
                          tickFormatter={formatDate}
                        />
                        <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          labelFormatter={(label) => `Fecha: ${formatDate(label)}`}
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="total"
                          stroke="#3B82F6"
                          strokeWidth={3}
                          dot={{ fill: "#3B82F6", r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>

                  <Card className="chart-card">
                    <div className="chart-header">
                      <h3>💳 Métodos de Pago</h3>
                      <p className="chart-subtitle">Distribución de cobros</p>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={byPayment}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={(props: any) => {
                            const { name, percent } = props;
                            return `${name}: ${((percent as number) * 100).toFixed(0)}%`;
                          }}
                        >
                          {byPayment.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card>
                </div>
              </div>
            )}

            {/* ===== PESTAÑA: PRODUCTOS (dos filas apiladas) ===== */}
            {activeTab === "productos" && (
              <div className="rep-tab-content">
                <div className="rep-stack">
                  {/* Fila 1: Ventas por categoría */}
                  <Card className="chart-card">
                    <div className="chart-header">
                      <h3>🏷️ Ventas por Categoría</h3>
                      <p className="chart-subtitle">Rendimiento por departamento</p>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={byCategory.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="categoryName"
                          tick={{ fontSize: 10, fill: "#6b7280" }}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar dataKey="total" fill="#10B981" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>

                  {/* Fila 2: Productos más vendidos (con código) */}
                  <Card className="table-card">
                    <div className="table-header">
                      <h3>🏆 Productos Más Vendidos</h3>
                      <p className="table-subtitle">Top 10 productos</p>
                    </div>
                    <div className="table-content">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Código</th>
                            <th>Producto</th>
                            <th>Cantidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topProducts.slice(0, 10).map((product, index) => (
                            <tr key={index}>
                              <td className="rank-cell">{index + 1}</td>
                              <td className="code-cell">{product.code || "—"}</td>
                              <td className="product-cell">{product.productName}</td>
                              <td className="quantity-cell">
                                <span className="badge">{product._sum.quantity}</span>
                              </td>
                            </tr>
                          ))}
                          {topProducts.length === 0 && (
                            <tr>
                              <td colSpan={4} className="empty-cell">
                                No hay datos disponibles
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* ===== PESTAÑA: POR CATEGORÍA ===== */}
            {activeTab === "categorias" && (
              <div className="rep-tab-content">
                {topByCategory.length === 0 ? (
                  <Card className="chart-card">
                    <div className="empty-cell" style={{ padding: "40px", textAlign: "center" }}>
                      No hay ventas en el periodo seleccionado
                    </div>
                  </Card>
                ) : (
                  <div className="rep-cat-grid">
                    {topByCategory.map((cat, i) => {
                      const maxQty = cat.products[0]?.quantity || 1;
                      return (
                        <Card key={i} className="rep-cat-card">
                          <div className="rep-cat-head">
                            <span className="rep-cat-name">{cat.categoryName}</span>
                            <span className="rep-cat-total">{formatCurrency(cat.total)}</span>
                          </div>
                          <div className="rep-cat-sub">
                            {cat.quantity.toLocaleString("es-MX")} unidades vendidas
                          </div>
                          <ul className="rep-cat-products">
                            {cat.products.map((p, j) => (
                              <li key={j} className="rep-cat-product">
                                <span className="rep-cat-rank">{j + 1}</span>
                                <span className="rep-cat-pname" title={p.productName}>
                                  {p.productName}
                                </span>
                                <span className="rep-cat-bar-wrap">
                                  <span
                                    className="rep-cat-bar"
                                    style={{ width: `${Math.max(8, (p.quantity / maxQty) * 100)}%` }}
                                  />
                                </span>
                                <span className="rep-cat-qty">{p.quantity}</span>
                              </li>
                            ))}
                          </ul>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ===== PESTAÑA: CLIENTES ===== */}
            {activeTab === "clientes" && (
              <div className="rep-tab-content">
                <div className="rep-split">
                  <Card className="chart-card">
                    <div className="chart-header">
                      <h3>👥 Ventas por Cliente</h3>
                      <p className="chart-subtitle">Top 10 clientes</p>
                    </div>
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={byClient.slice(0, 10)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} />
                        <YAxis
                          type="category"
                          dataKey="clientName"
                          tick={{ fontSize: 10, fill: "#6b7280" }}
                          width={120}
                        />
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar dataKey="total" fill="#8B5CF6" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>

                  <Card className="table-card">
                    <div className="table-header">
                      <h3>⭐ Top Clientes</h3>
                      <p className="table-subtitle">Clientes con más compras</p>
                    </div>
                    <div className="table-content">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Cliente</th>
                            <th>Ventas</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {byClient.slice(0, 10).map((client, index) => (
                            <tr key={index}>
                              <td className="rank-cell">{index + 1}</td>
                              <td className="client-cell">{client.clientName}</td>
                              <td className="count-cell">
                                <span className="badge">{client.count}</span>
                              </td>
                              <td className="amount-cell">{formatCurrency(client.total)}</td>
                            </tr>
                          ))}
                          {byClient.length === 0 && (
                            <tr>
                              <td colSpan={4} className="empty-cell">
                                No hay datos disponibles
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
};

export default DashboardSalesPage;
