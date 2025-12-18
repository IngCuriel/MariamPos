import { useEffect, useState, useCallback } from "react";
import Header from "../../components/Header";
import type { CashMovement } from "../../types/index";
import { getCashMovementsHistory, getShiftsByDateRange } from "../../api/cashRegister";
import DatePicker, { registerLocale } from "react-datepicker";
import { es } from "date-fns/locale/es";
import "react-datepicker/dist/react-datepicker.css";
import "../../styles/pages/cashMovements/cashMovementsHistory.css";

registerLocale("es", es);

interface CashMovementsHistoryPageProps {
  onBack: () => void;
}

interface CashMovementWithShift extends CashMovement {
  shift?: {
    id: number;
    shiftNumber: string;
    branch: string;
    cashRegister: string;
    cashierName?: string;
    startTime: Date;
    endTime?: Date;
    status: string;
  };
}

export default function CashMovementsHistoryPage({
  onBack,
}: CashMovementsHistoryPageProps) {
  const [movements, setMovements] = useState<CashMovementWithShift[]>([]);
  const [startDate, setStartDate] = useState<Date>(
    new Date(new Date().setDate(new Date().getDate() /*- 7*/))
  );
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [selectedCashRegister, setSelectedCashRegister] = useState<string>("all");
  const [availableCashRegisters, setAvailableCashRegisters] = useState<string[]>([]);

  const loadCashRegisters = useCallback(async () => {
    try {
      const start = startDate.toLocaleDateString("en-CA");
      const end = endDate.toLocaleDateString("en-CA");
      const shifts = await getShiftsByDateRange({ startDate: start, endDate: end });
      // Obtener cajas únicas de los turnos
      const uniqueCashRegisters = Array.from(
        new Set(shifts.map(shift => shift.cashRegister).filter(Boolean))
      ).sort() as string[];
      setAvailableCashRegisters(uniqueCashRegisters);
    } catch (error) {
      console.error("Error al cargar cajas:", error);
    }
  }, [startDate, endDate]);

  const fetchMovements = useCallback(async () => {
    try {
      setLoading(true);
      const start = startDate.toLocaleDateString("en-CA");
      const end = endDate.toLocaleDateString("en-CA");

      const data = await getCashMovementsHistory(start, end, selectedCashRegister !== "all" ? selectedCashRegister : undefined);
      setMovements(data as CashMovementWithShift[]);
    } catch (error) {
      console.error("Error al cargar movimientos:", error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedCashRegister]);

  useEffect(() => {
    loadCashRegisters();
  }, [loadCashRegisters]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

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

  // Calcular totales (sin neto)
  const totals = movements.reduce(
    (acc, movement) => {
      if (movement.type === "ENTRADA") {
        acc.totalEntradas += movement.amount;
      } else {
        acc.totalSalidas += movement.amount;
      }
      return acc;
    },
    { totalEntradas: 0, totalSalidas: 0 }
  );

  return (
    <div className="cash-movements-history-page">
      <Header
        title="💰 Historial de Movimientos de Efectivo"
        onBack={onBack}
        backText="← Volver al Menu Principal"
        className="movements-header"
      />

      <div className="movements-content">
        {/* Resumen de totales - ARRIBA */}
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
          <div className="total-item count">
            <span className="total-label">📋 Total Movimientos:</span>
            <span className="total-value">{movements.length}</span>
          </div>
        </div>

        {/* Filtros - EN MEDIO */}
        <div className="filters-section">
          <div className="filter-group">
            <label className="filter-label">Desde:</label>
            <DatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date || new Date())}
              locale="es"
              dateFormat="yyyy-MM-dd"
              className="datepicker-input-large"
            />
          </div>
          <div className="filter-group">
            <label className="filter-label">Hasta:</label>
            <DatePicker
              selected={endDate}
              onChange={(date) => setEndDate(date || new Date())}
              locale="es"
              dateFormat="yyyy-MM-dd"
              className="datepicker-input-large"
            />
          </div>
          <div className="filter-group">
            <label className="filter-label">🏪 Caja:</label>
            <select
              value={selectedCashRegister}
              onChange={(e) => setSelectedCashRegister(e.target.value)}
              className="cash-register-select-large"
            >
              <option value="all">Todas las cajas</option>
              {availableCashRegisters.map((cashRegister) => (
                <option key={cashRegister} value={cashRegister}>
                  {cashRegister}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <button
              className="refresh-btn-large"
              onClick={fetchMovements}
              disabled={loading}
            >
              🔄 Actualizar
            </button>
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
                  <th>Caja</th>
                  <th>Cajero</th>
                  <th>Turno</th>
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
                    <td className="cash-register-cell">
                      {movement.shift?.cashRegister || "-"}
                    </td>
                    <td className="cashier-cell">
                      {movement.shift?.cashierName || movement.createdBy || "Anónimo"}
                    </td>
                    <td className="shift-cell">
                      {movement.shift?.shiftNumber 
                        ? `#${movement.shift.shiftNumber}` 
                        : movement.shiftId 
                        ? `#${movement.shiftId}` 
                        : "-"}
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

