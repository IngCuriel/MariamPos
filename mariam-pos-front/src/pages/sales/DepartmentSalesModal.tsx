import React, { useEffect, useState, useCallback } from "react";
import {
  getSalesByDepartment,
  type DepartmentSale,
} from "../../api/sales";
import "../../styles/pages/sales/departmentSalesModal.css";

interface DepartmentSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashRegister?: string;
}

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

// Fecha local (México) en formato YYYY-MM-DD para los inputs de tipo date.
// Se usa hora local (no toISOString) para no correr un día por la zona horaria.
const todayLocalISO = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const DepartmentSalesModal: React.FC<DepartmentSalesModalProps> = ({
  isOpen,
  onClose,
  cashRegister,
}) => {
  const today = todayLocalISO();
  // Rango de fechas. Por defecto: hoy (desde = hasta = hoy).
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);

  const [departments, setDepartments] = useState<DepartmentSale[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (start: string, end: string) => {
      try {
        setLoading(true);
        setError(null);
        const params: Record<string, string> = { start, end };
        if (cashRegister) params.cashRegister = cashRegister;
        const res = await getSalesByDepartment(params);
        setDepartments(res.departments ?? []);
        setTotal(res.total ?? 0);
      } catch (e) {
        console.error("Error al cargar ventas por departamento:", e);
        setError("No se pudieron cargar las ventas por departamento");
      } finally {
        setLoading(false);
      }
    },
    [cashRegister]
  );

  // Al abrir, reiniciar a "hoy" y cargar.
  useEffect(() => {
    if (!isOpen) return;
    const t = todayLocalISO();
    setStartDate(t);
    setEndDate(t);
    load(t, t);
  }, [isOpen, load]);

  if (!isOpen) return null;

  const rangeInvalid = startDate > endDate;

  const applyToday = () => {
    const t = todayLocalISO();
    setStartDate(t);
    setEndDate(t);
    load(t, t);
  };

  const applyRange = () => {
    if (rangeInvalid) return;
    load(startDate, endDate);
  };

  return (
    <div className="dsm-overlay" onClick={onClose}>
      <div className="dsm-content" onClick={(e) => e.stopPropagation()}>
        <div className="dsm-header">
          <div className="dsm-header-info">
            <span className="dsm-header-title">Ventas por departamento</span>
            <span className="dsm-header-sub">Resumen general de ventas</span>
          </div>
          <button className="dsm-close" onClick={onClose} title="Cerrar" type="button">
            ✕
          </button>
        </div>

        {/* Filtros de fecha: botón rápido Hoy + rango desde/hasta */}
        <div className="dsm-filters">
          <button className="dsm-today-btn" onClick={applyToday} type="button">
            📅 Hoy
          </button>
          <div className="dsm-date-fields">
            <div className="dsm-date-field">
              <label className="dsm-date-label">Desde</label>
              <input
                type="date"
                className="dsm-date-input"
                value={startDate}
                max={endDate || today}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="dsm-date-field">
              <label className="dsm-date-label">Hasta</label>
              <input
                type="date"
                className="dsm-date-input"
                value={endDate}
                min={startDate}
                max={today}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <button
              className="dsm-apply-btn"
              onClick={applyRange}
              disabled={rangeInvalid || loading}
              type="button"
            >
              Consultar
            </button>
          </div>
          {rangeInvalid && (
            <span className="dsm-range-error">
              La fecha "Desde" no puede ser mayor que "Hasta".
            </span>
          )}
        </div>

        <div className="dsm-body">
          {loading ? (
            <div className="dsm-state">
              <div className="dsm-spinner" />
              <p>Cargando…</p>
            </div>
          ) : error ? (
            <div className="dsm-state dsm-state--error">
              <span className="dsm-state-icon">⚠️</span>
              <p>{error}</p>
            </div>
          ) : departments.length === 0 ? (
            <div className="dsm-state">
              <span className="dsm-state-icon">📊</span>
              <p className="dsm-state-title">Sin ventas en este periodo</p>
              <p className="dsm-state-text">
                Elegí otro rango de fechas para ver información.
              </p>
            </div>
          ) : (
            <div className="dsm-list">
              {departments.map((d) => (
                <div key={d.departmentId ?? d.departmentName} className="dsm-item">
                  <div className="dsm-item-top">
                    <span className="dsm-item-name">
                      {d.icon ? <span className="dsm-item-icon">{d.icon}</span> : null}
                      {d.departmentName}
                    </span>
                    <span className="dsm-item-total">{money(d.total)}</span>
                  </div>
                  <div className="dsm-bar-track">
                    <div
                      className="dsm-bar-fill"
                      style={{ width: `${Math.max(d.percentage, 2)}%` }}
                    />
                  </div>
                  <div className="dsm-item-meta">
                    <span>{d.percentage.toFixed(1)}% del total</span>
                    <span>
                      {d.quantity.toLocaleString("es-MX", {
                        maximumFractionDigits: 2,
                      })}{" "}
                      unidades · {d.items} {d.items === 1 ? "línea" : "líneas"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dsm-footer">
          <div className="dsm-total-row">
            <span className="dsm-total-label">Total del periodo</span>
            <span className="dsm-total-value">{money(total)}</span>
          </div>
          <button className="dsm-btn-close" onClick={onClose} type="button">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DepartmentSalesModal;
