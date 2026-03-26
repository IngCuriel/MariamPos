import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { IoRefreshOutline } from 'react-icons/io5';
import {
  fetchCashExpressBalanceHistoryAbonos,
  addCashExpressBalance,
  type CashExpressBalanceHistoryItem,
} from '../../api/cashExpressBalanceHistory';
import { getBusinessTodayYYYYMMDD, BUSINESS_TZ } from '../../utils/businessDate';
import { useCashier } from '../../contexts/CashierContext';
import '../../styles/components/serviciosRecargasAbonosPanel.css';

const STORAGE_SUCURSAL = 'cajero_rs_sucursal';
const STORAGE_CAJERO = 'cajero_rs_cajero';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);

function formatDateTimeMx(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', {
      timeZone: BUSINESS_TZ,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function buildAbonoDescription(sucursal: string, cajero: string, cajaPos: string, detalle: string) {
  const lines = [
    '[Cajero] Recargas y pagos de servicios',
    `Sucursal: ${sucursal.trim()}`,
    `Cajero: ${cajero.trim()}`,
  ];
  if (cajaPos.trim()) {
    lines.push(`Caja: ${cajaPos.trim()}`);
  }
  if (detalle.trim()) {
    lines.push(`Detalle: ${detalle.trim()}`);
  }
  return lines.join('\n');
}

export default function ServiciosRecargasAbonosPanel() {
  const { selectedCashier } = useCashier();
  const today = getBusinessTodayYYYYMMDD();
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [rows, setRows] = useState<CashExpressBalanceHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [sucursal, setSucursal] = useState('');
  const [cajero, setCajero] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [registrationDate, setRegistrationDate] = useState(today);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (dateFrom > dateTo) {
      toast.error('La fecha inicial no puede ser mayor que la final');
      setRows([]);
      setTotal(0);
      setTruncated(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchCashExpressBalanceHistoryAbonos({
        dateFrom,
        dateTo,
        limit: 500,
        offset: 0,
      });
      setRows(data.history ?? []);
      setTotal(typeof data.total === 'number' ? data.total : (data.history ?? []).length);
      setTruncated(Boolean(data.truncated));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo cargar el historial de abonos';
      toast.error(msg);
      setRows([]);
      setTotal(0);
      setTruncated(false);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const openRegistrarModal = () => {
    const fromStorage =
      typeof globalThis.sessionStorage !== 'undefined'
        ? {
            sucursal: globalThis.sessionStorage.getItem(STORAGE_SUCURSAL) || '',
            cajero: globalThis.sessionStorage.getItem(STORAGE_CAJERO) || '',
          }
        : { sucursal: '', cajero: '' };
    const lsSucursal =
      typeof globalThis.localStorage !== 'undefined'
        ? globalThis.localStorage.getItem('sucursal')?.trim() || ''
        : '';
    const cashierName = selectedCashier?.name?.trim() || '';

    setSucursal(fromStorage.sucursal || lsSucursal);
    setCajero(fromStorage.cajero || cashierName);
    setAmount('');
    setDescripcion('Pago de recargas y servicios');
    setRegistrationDate(getBusinessTodayYYYYMMDD());
    setShowForm(true);
  };

  const closeForm = () => {
    if (!submitting) setShowForm(false);
  };

  useEffect(() => {
    if (!showForm) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) setShowForm(false);
    };
    globalThis.addEventListener('keydown', onKey);
    return () => globalThis.removeEventListener('keydown', onKey);
  }, [showForm, submitting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const monto = Number.parseFloat(String(amount).replace(',', '.'));
    if (!monto || monto <= 0) {
      toast.error('Ingresa un total válido mayor a 0');
      return;
    }
    if (!sucursal.trim()) {
      toast.error('Indica el nombre de la sucursal');
      return;
    }
    if (!cajero.trim()) {
      toast.error('Indica el nombre del cajero');
      return;
    }
    if (!registrationDate || !/^\d{4}-\d{2}-\d{2}$/.test(registrationDate)) {
      toast.error('Selecciona una fecha de registro válida');
      return;
    }

    const cajaPos =
      typeof globalThis.localStorage !== 'undefined'
        ? globalThis.localStorage.getItem('caja')?.trim() || ''
        : '';

    try {
      setSubmitting(true);
      globalThis.sessionStorage?.setItem(STORAGE_SUCURSAL, sucursal.trim());
      globalThis.sessionStorage?.setItem(STORAGE_CAJERO, cajero.trim());

      const description = buildAbonoDescription(sucursal, cajero, cajaPos, descripcion);
      await addCashExpressBalance({
        amount: monto,
        description,
        registrationDate,
      });
      toast.success('Registro guardado correctamente.');
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo registrar el abono';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  let metaText = 'Cargando abonos…';
  if (!loading) {
    if (total > rows.length) {
      metaText = `${rows.length} de ${total} abonos (máx. 500 visibles)`;
    } else {
      metaText = `${total} abono${total === 1 ? '' : 's'} en el periodo`;
    }
  }

  return (
    <div className="servicios-abonos">
      <div className="servicios-abonos-toolbar">
        <div className="servicios-abonos-filters" aria-label="Rango de fechas">
          <div className="servicios-abonos-field">
            <label className="servicios-abonos-label" htmlFor="servicios-abonos-from">
              Desde
            </label>
            <input
              id="servicios-abonos-from"
              className="servicios-abonos-input"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="servicios-abonos-field">
            <label className="servicios-abonos-label" htmlFor="servicios-abonos-to">
              Hasta
            </label>
            <input
              id="servicios-abonos-to"
              className="servicios-abonos-input"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
        <div className="servicios-abonos-actions">
          <button
            type="button"
            className="servicios-abonos-register"
            onClick={openRegistrarModal}
          >
            Registrar venta
          </button>
          <button
            type="button"
            className="servicios-abonos-refresh"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Actualizar listado"
          >
            <IoRefreshOutline size={22} aria-hidden />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      <p className="servicios-abonos-meta" aria-live="polite">
        {metaText}
      </p>
      {truncated && !loading && (
        <p className="servicios-abonos-meta servicios-abonos-meta--warn" role="status">
          Hay muchos movimientos en este rango; el servidor analizó como máximo 10&nbsp;000 candidatos.
          Acota las fechas si falta algún abono.
        </p>
      )}

      <div className="servicios-abonos-table-wrap">
        {loading ? (
          <div className="servicios-abonos-empty">Cargando…</div>
        ) : rows.length === 0 ? (
          <div className="servicios-abonos-empty">No hay abonos en este rango de fechas.</div>
        ) : (
          <table className="servicios-abonos-table">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Monto</th>
                <th scope="col">Concepto</th>
                <th scope="col">Registró</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id}>
                  <td className="servicios-abonos-cell-fecha">{formatDateTimeMx(item.createdAt)}</td>
                  <td className="servicios-abonos-cell-monto">{formatCurrency(item.amount)}</td>
                  <td className="servicios-abonos-cell-desc">
                    {item.description?.replace(/\n/g, ' · ') || '—'}
                  </td>
                  <td className="servicios-abonos-cell-user">
                    {item.user?.name || item.user?.email || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div
          className="servicios-reg-overlay"
          onClick={closeForm}
          role="presentation"
        >
          <div
            className="servicios-reg-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="servicios-reg-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="servicios-reg-head">
              <h2 id="servicios-reg-title" className="servicios-reg-title">
                Registrar venta
              </h2>
              <button
                type="button"
                className="servicios-reg-close"
                onClick={closeForm}
                disabled={submitting}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <form className="servicios-reg-form" onSubmit={handleSubmit} noValidate>
              <div className="servicios-reg-field">
                <label className="servicios-reg-label" htmlFor="servicios-reg-total">
                  Total recaudado (MXN) <span className="servicios-reg-req" aria-hidden>*</span>
                </label>
                <input
                  id="servicios-reg-total"
                  className="servicios-reg-input servicios-reg-input--amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="transaction-amount"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-required="true"
                />
              </div>

              <div className="servicios-reg-field">
                <label className="servicios-reg-label" htmlFor="servicios-reg-date">
                  Fecha de registro <span className="servicios-reg-req" aria-hidden>*</span>
                </label>
                <input
                  id="servicios-reg-date"
                  className="servicios-reg-input"
                  type="date"
                  value={registrationDate}
                  onChange={(e) => setRegistrationDate(e.target.value)}
                  aria-required="true"
                />
                <span className="servicios-reg-hint">
                  Por defecto es hoy (México); ajústala si corresponde a otro día.
                </span>
              </div>

              <div className="servicios-reg-field">
                <label className="servicios-reg-label" htmlFor="servicios-reg-sucursal">
                  Nombre de la sucursal <span className="servicios-reg-req" aria-hidden>*</span>
                </label>
                <input
                  id="servicios-reg-sucursal"
                  className="servicios-reg-input"
                  type="text"
                  autoComplete="organization"
                  placeholder="Ej. Papelería Curiel"
                  value={sucursal}
                  onChange={(e) => setSucursal(e.target.value)}
                  aria-required="true"
                />
              </div>

              <div className="servicios-reg-field">
                <label className="servicios-reg-label" htmlFor="servicios-reg-cajero">
                  Nombre del cajero <span className="servicios-reg-req" aria-hidden>*</span>
                </label>
                <input
                  id="servicios-reg-cajero"
                  className="servicios-reg-input"
                  type="text"
                  autoComplete="name"
                  placeholder="Nombre quien registra"
                  value={cajero}
                  onChange={(e) => setCajero(e.target.value)}
                  aria-required="true"
                />
              </div>

              <div className="servicios-reg-field">
                <label className="servicios-reg-label" htmlFor="servicios-reg-desc">
                  Descripción (opcional)
                </label>
                <textarea
                  id="servicios-reg-desc"
                  className="servicios-reg-textarea"
                  rows={3}
                  placeholder="Ej. Pago de recargas y servicios"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
              </div>

              <div className="servicios-reg-actions">
                <button
                  type="button"
                  className="servicios-reg-btn-secondary"
                  onClick={closeForm}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="servicios-reg-btn-primary"
                  disabled={submitting}
                  aria-busy={submitting}
                >
                  {submitting ? 'Guardando…' : 'Guardar registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
