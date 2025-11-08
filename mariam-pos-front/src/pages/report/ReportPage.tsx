import React, { useEffect, useState } from "react";
import Card from '../../components/Card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import Header from "../../components/Header";

import  {getSalesSummary, getDailySales, getTopProducts, getSalesByPaymentMethod} from "../../api/sales" 
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

interface DashboardSalesPageProps {
  onBack: () => void; 

}

const DashboardSalesPage: React.FC<DashboardSalesPageProps> = ({onBack}) => {
  const [summary, setSummary] = useState<Summary | null>({totalVentas:0, totalDinero:0});
  const [dailySales, setDailySales] = useState<DailySale[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [byPayment, setByPayment] = useState<Record<string, unknown>[]>( []);
  //filters
  const [filter, setFilter] = useState<"day" | "week" | "month" | "custom">("day");
  //const [startDate, setStartDate] = useState<string>("");
  //const [endDate, setEndDate] = useState<string>("");
  const startDate=null;
  const endDate = null;
  useEffect(() => { 
    fetchData();
  }, [filter]);

    const fetchData = async () => {
    try {
      const params: Record<string, string> = {};
      if (filter === "custom" && startDate && endDate) {
        params.start = startDate;
        params.end = endDate;
      } else {
        params.range = filter;
      }

      const [resSummary, resDaily, restTopProducts, resPaymentMethod] = await Promise.all([
        getSalesSummary(params),
        getDailySales(params),
        getTopProducts(params),
        getSalesByPaymentMethod(params)
      ]);

      setSummary(resSummary); 
      console.log('resDaily')
      setDailySales(resDaily);
      setTopProducts(restTopProducts);
      const data: Record<string, unknown>[] = resPaymentMethod.map((item) => ({
                name: item.paymentMethod,
                value: item._sum.total,
              }));
      setByPayment(data)
    } catch (error) {
      console.error("Error al cargar dashboard:", error);
    }
  };

  const colors = ["#4F46E5", "#16A34A", "#F59E0B", "#DC2626", "#2563EB"];

  return (
    <div className="app">
      <div className="main-container"> 
        <Header
          title="Reportes de ventas"
          onBack={onBack}
          backText="← Volver al Menú "
          className="pos-header"
        />
        <div style={{display:'flex', gap:'5px', paddingBottom:'5px', alignItems:'center'}}>
            <button
              onClick={() => setFilter("day")}
              className={`${filter === "day" ? "btn touch-btn active-filter-report" : "btn touch-btn inactive-filter-report"}`}
            >
              Hoy
            </button>
            <button
              onClick={() => setFilter("week")}
              className={`${filter === "week" ? "btn touch-btn active-filter-report" : "btn touch-btn inactive-filter-report"}`}
            >
              Últimos 7 días
            </button>
            <button
              onClick={() => setFilter("month")}
              className={`${filter === "month" ? "btn touch-btn active-filter-report" : "btn touch-btn inactive-filter-report"}`}
            >
              Este mes
            </button>
        </div>
        <div className="main-actions">
            {/* Resumen general */}
            <Card className="col-span-3">
                <div>
                    <h2 className="text-xl font-bold text-gray-700">Resumen General</h2>
                    <p className="text-sm text-gray-500">Ventas totales y monto generado</p>
                </div>
                <div className="text-right">
                    <p className="text-3xl font-bold text-indigo-600">{summary?.totalVentas ?? 0}</p>
                    <p className="text-gray-500">ventas registradas</p>
                    <p className="text-2xl font-semibold text-green-600 mt-2">
                    ${summary?.totalDinero?.toLocaleString("es-MX")}
                    </p>
                </div>
            </Card>

            {/* Gráfica de ventas diarias */}
            <Card className="col-span-2">
                <h3 className="font-semibold mb-2">Ventas Diarias</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dailySales}>
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total" fill="#4F46E5" />
                    </BarChart>
                </ResponsiveContainer>
            </Card>

            {/* Ventas por método de pago */}
            <Card>
                <h3 className="font-semibold mb-2">Métodos de Pago</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={byPayment}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        label
                      >
                        {byPayment.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
            </Card>

            {/* Productos más vendidos */}
            <Card>
                <h3>Productos más vendidos</h3>
                <div className="">
                    {topProducts.map((p, i) => (
                    <div key={i} style={{display:'flex', gap:'5px', paddingBottom:'5px', alignItems:'center'}}>
                        <p className="">Cantidad: {p._sum.quantity}</p>
                        <p className="">{p.productName}</p>
                    </div>
                    ))}
                </div>
            </Card>
        </div>
     </div>
    </div>
  );
};

export default DashboardSalesPage;
