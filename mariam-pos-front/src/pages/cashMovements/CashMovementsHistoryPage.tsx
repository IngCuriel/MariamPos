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
  // Ids de movimientos seleccionados para sumar su total (selección manual).
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

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

  // Al cambiar la lista de movimientos (filtros/fecha), limpiar la selección
  // para no arrastrar ids que ya no están en la tabla.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [movements]);

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

  // --- Selección de movimientos ---
  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected =
    movements.length > 0 && selectedIds.size === movements.length;

  const toggleAll = () => {
    setSelectedIds((prev) =>
      prev.size === movements.length
        ? new Set()
        : new Set(movements.map((m) => m.id))
    );
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Total de lo seleccionado (desglosado por tipo + neto + cantidad).
  const selectedTotals = movements.reduce(
    (acc, m) => {
      if (!selectedIds.has(m.id)) return acc;
      acc.count += 1;
      if (m.type === "ENTRADA") acc.entradas += m.amount;
      else acc.salidas += m.amount;
      return acc;
    },
    { count: 0, entradas: 0, salidas: 0 }
  );
  const selectedNeto = selectedTotals.entradas - selectedTotals.salidas;

  const currency = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

  return (
    <div className="cash-movements-history-page">
      <Header
        title="💰 Historial de Movimientos de Efectivo"
        onBack={onBack}
        backText="← Volver al Menu Principal"
        className="movements-header"
      />

      <div className="movements-content">
        {/* Barra de controles compacta: totales (izq) + filtros (der) */}
        <div className="controls-bar">
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
                  <th className="check-col">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      title="Seleccionar todos"
                    />
                  </th>
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
                    className={`movement-row ${movement.type.toLowerCase()} ${
                      selectedIds.has(movement.id) ? "selected" : ""
                    }`}
                    onClick={() => toggleOne(movement.id)}
                  >
                    <td className="check-col" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(movement.id)}
                        onChange={() => toggleOne(movement.id)}
                      />
                    </td>
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
                      {movement.shift?.id
                        ? `#${movement.shift.id}`
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

        {/* Barra de resumen de selección (aparece al seleccionar) */}
        {selectedTotals.count > 0 && (
          <div className="selection-bar">
            <span className="sel-count">
              {selectedTotals.count}{" "}
              {selectedTotals.count === 1 ? "seleccionado" : "seleccionados"}
            </span>
            <div className="sel-totals">
              {selectedTotals.entradas > 0 && (
                <span className="sel-chip entrada">
                  Entradas: {currency(selectedTotals.entradas)}
                </span>
              )}
              {selectedTotals.salidas > 0 && (
                <span className="sel-chip salida">
                  Salidas: {currency(selectedTotals.salidas)}
                </span>
              )}
              <span className="sel-chip neto">
                Total: {currency(selectedNeto)}
              </span>
            </div>
            <button className="sel-clear-btn" onClick={clearSelection}>
              ✕ Limpiar selección
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

