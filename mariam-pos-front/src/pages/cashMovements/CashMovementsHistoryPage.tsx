import { useEffect, useState } from "react";
import Header from "../../components/Header";
import type { CashMovement } from "../../types/index";
import { getCashMovementsHistory } from "../../api/cashRegister";
import DatePicker, { registerLocale } from "react-datepicker";
import { es } from "date-fns/locale/es";
import "react-datepicker/dist/react-datepicker.css";
import "../../styles/pages/cashMovements/cashMovementsHistory.css";

registerLocale("es", es);

interface CashMovementsHistoryPageProps {
  onBack: () => void;
}

export default function CashMovementsHistoryPage({
  onBack,
}: CashMovementsHistoryPageProps) {
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [startDate, setStartDate] = useState<Date>(
    new Date(new Date().setDate(new Date().getDate() - 7))
  );
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMovements();
  }, [startDate, endDate]);

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const start = startDate.toLocaleDateString("en-CA");
      const end = endDate.toLocaleDateString("en-CA");

      const data = await getCashMovementsHistory(start, end);
      setMovements(data);
    } catch (error) {
      console.error("Error al cargar movimientos:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString("es-MX", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Calcular totales
  const totals = movements.reduce(
    (acc, movement) => {
      if (movement.type === "ENTRADA") {
        acc.totalEntradas += movement.amount;
      } else {
        acc.totalSalidas += movement.amount;
      }
      acc.neto +=
        movement.type === "ENTRADA" ? movement.amount : -movement.amount;
      return acc;
    },
    { totalEntradas: 0, totalSalidas: 0, neto: 0 }
  );

  return (
    <div className="cash-movements-history-page">
      <Header
        title="💰 Historial de Movimientos de Efectivo"
        onBack={onBack}
        backText="← Volver"
        className="movements-header"
      />

      <div className="movements-content">
        {/* Filtros */}
        <div className="filters-section">
          <div className="filter-group">
            <label className="filter-label">Desde:</label>
            <DatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date || new Date())}
              locale="es"
              dateFormat="yyyy-MM-dd"
              className="datepicker-input"
            />
          </div>
          <div className="filter-group">
            <label className="filter-label">Hasta:</label>
            <DatePicker
              selected={endDate}
              onChange={(date) => setEndDate(date || new Date())}
              locale="es"
              dateFormat="yyyy-MM-dd"
              className="datepicker-input"
            />
          </div>
          <div className="filter-group">
            <button
              className="refresh-btn"
              onClick={fetchMovements}
              disabled={loading}
            >
              🔄 Actualizar
            </button>
          </div>
        </div>

        {/* Resumen de totales */}
        <div className="totals-summary">
          <div className="total-item entrada">
            <span className="total-label">💰 Total Entradas:</span>
            <span className="total-value">
              {totals.totalEntradas.toLocaleString("es-MX", {
                style: "currency",
                currency: "MXN",
              })}
            </span>
          </div>
          <div className="total-item salida">
            <span className="total-label">💸 Total Salidas:</span>
            <span className="total-value">
              {totals.totalSalidas.toLocaleString("es-MX", {
                style: "currency",
                currency: "MXN",
              })}
            </span>
          </div>
          <div className="total-item neto">
            <span className="total-label">📊 Neto:</span>
            <span
              className="total-value"
              style={{
                color: totals.neto >= 0 ? "#059669" : "#dc2626",
                fontWeight: "700",
              }}
            >
              {totals.neto >= 0 ? "+" : ""}
              {totals.neto.toLocaleString("es-MX", {
                style: "currency",
                currency: "MXN",
              })}
            </span>
          </div>
          <div className="total-item count">
            <span className="total-label">📋 Total Movimientos:</span>
            <span className="total-value">{movements.length}</span>
          </div>
        </div>

        {/* Tabla de movimientos */}
        {loading ? (
          <div className="loading-state">
            <p>Cargando movimientos...</p>
          </div>
        ) : movements.length > 0 ? (
          <div className="table-wrapper">
            <table className="movements-table">
              <thead>
                <tr>
                  <th>Fecha/Hora</th>
                  <th>Tipo</th>
                  <th>Monto</th>
                  <th>Razón</th>
                  <th>Turno</th>
                  <th>Cajero</th>
                  <th>Sucursal/Caja</th>
                  <th>Registrado por</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr
                    key={movement.id}
                    className={`movement-row ${movement.type.toLowerCase()}`}
                  >
                    <td className="date-cell">{formatDate(movement.createdAt)}</td>
                    <td className="type-cell">
                      <span
                        className={`type-badge ${
                          movement.type === "ENTRADA" ? "entrada" : "salida"
                        }`}
                      >
                        {movement.type === "ENTRADA" ? "💰 Entrada" : "💸 Salida"}
                      </span>
                    </td>
                    <td
                      className="amount-cell"
                      style={{
                        color:
                          movement.type === "ENTRADA" ? "#059669" : "#dc2626",
                        fontWeight: "600",
                      }}
                    >
                      {movement.type === "ENTRADA" ? "+" : "-"}
                      {movement.amount.toLocaleString("es-MX", {
                        style: "currency",
                        currency: "MXN",
                      })}
                    </td>
                    <td className="reason-cell">
                      {movement.reason || "-"}
                    </td>
                    <td className="shift-cell">
                      {movement.shiftId ? (
                        <div>
                          <strong>#{movement.shiftId}</strong>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="cashier-cell">
                      {movement.createdBy || "Anónimo"}
                    </td>
                    <td className="location-cell">
                      -
                    </td>
                    <td className="created-by-cell">
                      {movement.createdBy || "-"}
                    </td>
                    <td className="notes-cell">
                      {movement.notes || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No se encontraron movimientos en el rango de fechas seleccionado</p>
          </div>
        )}
      </div>
    </div>
  );
}

