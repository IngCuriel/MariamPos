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
  getSalesSummary, 
  getDailySales, 
  getTopProducts, 
  getSalesByPaymentMethod,
  getSalesByCategory,
  getSalesByClient
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
  const [loading, setLoading] = useState(false);
  
  // Filtros
  const [filter, setFilter] = useState<"day" | "week" | "month" | "custom">("day");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  useEffect(() => {
    fetchData();
  }, [filter, startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter === "custom" && startDate && endDate) {
        params.start = startDate.toISOString().split('T')[0];
        params.end = endDate.toISOString().split('T')[0];
      } else {
        params.range = filter;
      }

      const [
        resSummary,
        resDaily,
        resTopProducts,
        resPaymentMethod,
        resCategory,
        resClient
      ] = await Promise.all([
        getSalesSummary(params),
        getDailySales(params),
        getTopProducts(params),
        getSalesByPaymentMethod(params),
        getSalesByCategory(params),
        getSalesByClient(params)
      ]);

      setSummary(resSummary);
      setDailySales(resDaily);
      setTopProducts(resTopProducts);
      
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
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Cargando reportes...</p>
          </div>
        ) : (
          <>
            {/* Resumen General */}
            <div className="summary-cards">
              <div className="summary-card primary">
                <div className="summary-icon">💰</div>
                <div className="summary-content">
                  <h3>Total Ventas</h3>
                  <p className="summary-value">{summary?.totalVentas ?? 0}</p>
                  <p className="summary-label">ventas registradas</p>
                </div>
              </div>
              <div className="summary-card success">
                <div className="summary-icon">💵</div>
                <div className="summary-content">
                  <h3>Total Generado</h3>
                  <p className="summary-value">{formatCurrency(summary?.totalDinero ?? 0)}</p>
                  <p className="summary-label">monto total</p>
                </div>
              </div>
              <div className="summary-card info">
                <div className="summary-icon">📦</div>
                <div className="summary-content">
                  <h3>Productos Vendidos</h3>
                  <p className="summary-value">
                    {topProducts.reduce((acc, p) => acc + (p._sum.quantity || 0), 0)}
                  </p>
                  <p className="summary-label">unidades totales</p>
                </div>
              </div>
            </div>

            {/* Gráficas principales */}
            <div className="charts-grid">
              {/* Ventas por día */}
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
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      tickFormatter={formatDate}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => `Fecha: ${formatDate(label)}`}
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="total" 
                      stroke="#3B82F6" 
                      strokeWidth={3}
                      dot={{ fill: '#3B82F6', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              {/* Ventas por método de pago */}
              <Card className="chart-card">
                <div className="chart-header">
                  <h3>💳 Ventas por Método de Pago</h3>
                  <p className="chart-subtitle">Distribución de pagos</p>
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

              {/* Ventas por categoría */}
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
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="total" fill="#10B981" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Ventas por cliente */}
              <Card className="chart-card">
                <div className="chart-header">
                  <h3>👥 Ventas por Cliente</h3>
                  <p className="chart-subtitle">Top 10 clientes</p>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={byClient.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis 
                      type="category" 
                      dataKey="clientName" 
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      width={120}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="total" fill="#8B5CF6" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* Tablas de detalles */}
            <div className="tables-grid">
              {/* Productos más vendidos */}
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
                        <th>Producto</th>
                        <th>Cantidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.slice(0, 10).map((product, index) => (
                        <tr key={index}>
                          <td className="rank-cell">{index + 1}</td>
                          <td className="product-cell">{product.productName}</td>
                          <td className="quantity-cell">
                            <span className="badge">{product._sum.quantity}</span>
                          </td>
                        </tr>
                      ))}
                      {topProducts.length === 0 && (
                        <tr>
                          <td colSpan={3} className="empty-cell">
                            No hay datos disponibles
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Top clientes */}
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
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardSalesPage;
