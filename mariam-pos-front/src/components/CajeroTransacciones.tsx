import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Swal from 'sweetalert2';
import {
  getCashierTransactions,
  createCashierTransaction,
  updateCashierTransaction,
  deleteCashierTransaction,
  getBranchesForConfig,
  type CashierTransaction,
  type CashierTransactionType,
  type CashierTransactionTotals,
  type CashierTransactionPayload,
  type ConfigBranch,
} from '../api/cashierTransactions';
import { useCashier } from '../contexts/CashierContext';
import { getBusinessTodayYYYYMMDD } from '../utils/businessDate';
import '../styles/components/cajeroTransacciones.css';

// Opciones del selector de tipo. El valor vacío representa "Todos".
const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'RECARGA', label: 'Recarga' },
  { value: 'PAGO_SERVICIO', label: 'Pago de servicio' },
  { value: 'PIN_ELECTRONICO', label: 'Pin' },
];

const EMPTY_TOTALS: CashierTransactionTotals = {
  byType: { RECARGA: 0, PAGO_SERVICIO: 0, PIN_ELECTRONICO: 0 },
  grandTotal: 0,
  count: 0,
};

const TYPE_META: Record<CashierTransactionType, { label: string; badgeClass: string }> = {
  RECARGA: { label: 'Recarga', badgeClass: 'cajero-tx-badge--recarga' },
  PAGO_SERVICIO: { label: 'Pago de servicio', badgeClass: 'cajero-tx-badge--servicio' },
  PIN_ELECTRONICO: { label: 'Pin', badgeClass: 'cajero-tx-badge--pin' },
};

const TYPE_ORDER: CashierTransactionType[] = ['RECARGA', 'PAGO_SERVICIO', 'PIN_ELECTRONICO'];

const FORM_TYPE_OPTIONS = TYPE_ORDER.map((value) => ({
  value,
  label: TYPE_META[value].label,
}));

// Límites de monto alineados con el backend.
const AMOUNT_MIN = 0.01;
const AMOUNT_MAX = 999999999.99;
const NOTES_MAX = 500;
const CASHIER_MAX = 100;

interface TransactionForm {
  type: string;
  amount: string;
  branchId: string;
  cashierName: string;
  notes: string;
  registeredAt: string;
}

const buildEmptyForm = (): TransactionForm => ({
  type: '',
  amount: '',
  branchId: '',
  cashierName: '',
  notes: '',
  registeredAt: '',
});

/** Convierte un valor de fecha a `YYYY-MM-DDTHH:mm` (hora de negocio MX) para datetime-local. */
const toDateTimeLocalValue = (value?: string): string => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const pick = (t: string) => parts.find((p) => p.type === t)?.value || '';
  const hour = pick('hour') === '24' ? '00' : pick('hour');
  return `${pick('year')}-${pick('month')}-${pick('day')}T${hour}:${pick('minute')}`;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const maybe = error as { response?: { data?: { error?: unknown } }; message?: unknown };
    const apiMsg = maybe.response?.data?.error;
    if (typeof apiMsg === 'string') return apiMsg;
    if (typeof maybe.message === 'string') return maybe.message;
  }
  return fallback;
}

/** True cuando el backend responde 401 (token inválido/expirado). */
function isUnauthorized(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const maybe = error as { response?: { status?: number } };
    return maybe.response?.status === 401;
  }
  return false;
}

/**
 * Muestra una alerta de error, salvo que el error sea un 401.
 * En ese caso el interceptor ya desloguea y envía al login, así que la
 * alerta sería ruido redundante.
 */
function notifyError(error: unknown, fallback: string): void {
  if (isUnauthorized(error)) return;
  void Swal.fire('Error', getErrorMessage(error, fallback), 'error');
}

export default function CajeroTransacciones() {
  const { selectedCashier } = useCashier();

  const today = getBusinessTodayYYYYMMDD();
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [typeFilter, setTypeFilter] = useState('');
  const [branchId, setBranchId] = useState('');

  const [branches, setBranches] = useState<ConfigBranch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);

  const [transactions, setTransactions] = useState<CashierTransaction[]>([]);
  const [totals, setTotals] = useState<CashierTransactionTotals>(EMPTY_TOTALS);
  const [loading, setLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TransactionForm>(buildEmptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<CashierTransaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  const invalidRange = dateFrom > dateTo;

  const loadBranches = useCallback(async () => {
    try {
      setLoadingBranches(true);
      const data = await getBranchesForConfig();
      const list = (data || []).filter((b) => b.isActive !== false);
      setBranches(list);
      if (list.length === 1) {
        setBranchId(String(list[0].id));
      }
    } catch (error) {
      console.error(error);
      notifyError(error, 'No se pudieron cargar las sucursales');
      setBranches([]);
    } finally {
      setLoadingBranches(false);
    }
  }, []);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  const loadTransactions = useCallback(async () => {
    if (dateFrom > dateTo) {
      setTransactions([]);
      setTotals(EMPTY_TOTALS);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await getCashierTransactions({
        dateFrom,
        dateTo,
        type: typeFilter,
        branchId,
      });
      setTransactions(data?.transactions || []);
      setTotals(data?.totals || EMPTY_TOTALS);
    } catch (error) {
      console.error(error);
      notifyError(error, 'No se pudo cargar el listado');
      setTransactions([]);
      setTotals(EMPTY_TOTALS);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, typeFilter, branchId]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const formatCurrency = useMemo(
    () => (value: number | string) =>
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2,
      }).format(Number(value) || 0),
    [],
  );

  const formatDateTime = useMemo(
    () => (value?: string) => {
      if (!value) return '—';
      try {
        return new Date(value).toLocaleString('es-MX', {
          timeZone: 'America/Mexico_City',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return String(value);
      }
    },
    [],
  );

  const defaultFormBranchId = useMemo(
    () => (branches.length === 1 ? String(branches[0].id) : ''),
    [branches],
  );

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm({
      ...buildEmptyForm(),
      branchId: defaultFormBranchId,
      cashierName: selectedCashier?.name ?? '',
      registeredAt: toDateTimeLocalValue(),
    });
    setFormErrors({});
    setShowForm(true);
  }, [defaultFormBranchId, selectedCashier]);

  const handleEdit = useCallback((transaction: CashierTransaction) => {
    if (!transaction) return;
    setEditingId(transaction.id);
    setForm({
      type: transaction.type || '',
      amount:
        transaction.amount != null && String(transaction.amount) !== ''
          ? String(transaction.amount)
          : '',
      branchId: transaction.branchId != null ? String(transaction.branchId) : '',
      cashierName: transaction.cashierName || '',
      notes: transaction.notes || '',
      registeredAt: toDateTimeLocalValue(transaction.registeredAt),
    });
    setFormErrors({});
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    if (submitting) return;
    setShowForm(false);
    setEditingId(null);
    setFormErrors({});
  }, [submitting]);

  const handleDelete = useCallback((transaction: CashierTransaction) => {
    if (!transaction) return;
    setDeleteTarget(transaction);
  }, []);

  const cancelDelete = useCallback(() => {
    if (deleting) return;
    setDeleteTarget(null);
  }, [deleting]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteCashierTransaction(deleteTarget.id);
      void Swal.fire('Listo', 'Transacción eliminada correctamente', 'success');
      setDeleteTarget(null);
      await loadTransactions();
    } catch (error) {
      console.error(error);
      notifyError(error, 'No se pudo eliminar la transacción');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, loadTransactions]);

  const setFormField = useCallback((field: keyof TransactionForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const validateForm = useCallback((values: TransactionForm): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (!values.type) {
      errors.type = 'Selecciona el tipo de transacción.';
    } else if (!TYPE_ORDER.includes(values.type as CashierTransactionType)) {
      errors.type = 'El tipo seleccionado no es válido.';
    }

    const rawAmount = String(values.amount).trim();
    if (rawAmount === '') {
      errors.amount = 'Ingresa el monto.';
    } else {
      const amountNum = Number(rawAmount);
      if (!Number.isFinite(amountNum)) {
        errors.amount = 'El monto debe ser numérico.';
      } else if (amountNum < AMOUNT_MIN || amountNum > AMOUNT_MAX) {
        errors.amount = 'El monto debe estar entre 0.01 y 999,999,999.99.';
      } else if (!/^\d+(\.\d{1,2})?$/.test(rawAmount)) {
        errors.amount = 'El monto admite máximo 2 decimales.';
      }
    }

    if (!values.branchId) {
      errors.branchId = 'Selecciona la sucursal.';
    }

    const cashier = values.cashierName.trim();
    if (cashier === '') {
      errors.cashierName = 'Ingresa el nombre del cajero.';
    } else if (cashier.length > CASHIER_MAX) {
      errors.cashierName = `Máximo ${CASHIER_MAX} caracteres.`;
    }

    if (values.notes && values.notes.length > NOTES_MAX) {
      errors.notes = `Máximo ${NOTES_MAX} caracteres.`;
    }

    if (!values.registeredAt) {
      errors.registeredAt = 'Ingresa la fecha de registro.';
    } else {
      const registered = new Date(values.registeredAt);
      if (Number.isNaN(registered.getTime())) {
        errors.registeredAt = 'La fecha de registro no es válida.';
      } else if (registered.getTime() > Date.now()) {
        errors.registeredAt = 'La fecha de registro no puede ser futura.';
      }
    }

    return errors;
  }, []);

  const handleSubmit = useCallback(
    async (ev: React.FormEvent) => {
      ev.preventDefault();
      const errors = validateForm(form);
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }

      const payload: CashierTransactionPayload = {
        type: form.type as CashierTransactionType,
        amount: Number(String(form.amount).trim()),
        branchId: Number(form.branchId),
        cashierName: form.cashierName.trim(),
        notes: form.notes.trim() ? form.notes.trim() : undefined,
        registeredAt: form.registeredAt
          ? new Date(form.registeredAt).toISOString()
          : undefined,
      };

      try {
        setSubmitting(true);
        if (editingId != null) {
          await updateCashierTransaction(editingId, payload);
          void Swal.fire('Listo', 'Transacción actualizada correctamente', 'success');
        } else {
          await createCashierTransaction(payload);
          void Swal.fire('Listo', 'Transacción registrada correctamente', 'success');
        }
        setShowForm(false);
        setEditingId(null);
        setFormErrors({});
        await loadTransactions();
      } catch (error) {
        console.error(error);
        notifyError(error, 'No se pudo guardar la transacción');
      } finally {
        setSubmitting(false);
      }
    },
    [form, editingId, validateForm, loadTransactions],
  );

  const totalsByType = useMemo(
    () =>
      TYPE_ORDER.map((type) => ({
        type,
        label: TYPE_META[type].label,
        badgeClass: TYPE_META[type].badgeClass,
        amount: Number(totals?.byType?.[type]) || 0,
      })),
    [totals],
  );

  const renderTypeBadge = (type: CashierTransactionType | string) => {
    const meta = TYPE_META[type as CashierTransactionType];
    return (
      <span className={`cajero-tx-badge ${meta ? meta.badgeClass : ''}`}>
        {meta ? meta.label : type || '—'}
      </span>
    );
  };

  const showData = !invalidRange && !loading && transactions.length > 0;

  return (
    <div className="cajero-tx">
      <p className="cajero-tx-lead">
        Registro de recargas, pagos de servicios y pines electrónicos. Filtra por periodo, tipo y
        sucursal.
      </p>

      <div className="cajero-tx-toolbar">
        <div className="cajero-tx-filters" role="group" aria-label="Filtros de transacciones">
          <div className="cajero-tx-filter-field">
            <label className="cajero-tx-filter-label" htmlFor="cajero-tx-from">
              Desde
            </label>
            <input
              id="cajero-tx-from"
              className="cajero-tx-filter-input"
              type="date"
              value={dateFrom}
              onChange={(ev) => setDateFrom(ev.target.value)}
              aria-invalid={invalidRange}
            />
          </div>

          <div className="cajero-tx-filter-field">
            <label className="cajero-tx-filter-label" htmlFor="cajero-tx-to">
              Hasta
            </label>
            <input
              id="cajero-tx-to"
              className="cajero-tx-filter-input"
              type="date"
              value={dateTo}
              onChange={(ev) => setDateTo(ev.target.value)}
              aria-invalid={invalidRange}
            />
          </div>

          <div className="cajero-tx-filter-field">
            <label className="cajero-tx-filter-label" htmlFor="cajero-tx-type">
              Tipo
            </label>
            <select
              id="cajero-tx-type"
              className="cajero-tx-filter-input"
              value={typeFilter}
              onChange={(ev) => setTypeFilter(ev.target.value)}
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value || 'ALL'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="cajero-tx-filter-field">
            <label className="cajero-tx-filter-label" htmlFor="cajero-tx-branch">
              Sucursal
            </label>
            <select
              id="cajero-tx-branch"
              className="cajero-tx-filter-input"
              value={branchId}
              onChange={(ev) => setBranchId(ev.target.value)}
              disabled={loadingBranches}
            >
              <option value="">Todas</option>
              {branches.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button type="button" className="cajero-tx-btn-register" onClick={openCreate}>
          Registrar
        </button>
      </div>

      {invalidRange && (
        <p className="cajero-tx-meta cajero-tx-meta--error" role="alert">
          El rango de fechas es inválido: la fecha Desde no puede ser posterior a la fecha Hasta.
        </p>
      )}

      <p className="cajero-tx-meta" aria-live="polite">
        {invalidRange
          ? 'Corrige el rango de fechas para consultar.'
          : loading
            ? 'Cargando transacciones…'
            : `${totals.count} transacci${totals.count === 1 ? 'ón' : 'ones'} en el periodo · Total ${formatCurrency(totals.grandTotal)}`}
      </p>

      {showData && (
        <div className="cajero-tx-summary" aria-label="Resumen de totales del periodo">
          <div className="cajero-tx-summary-card cajero-tx-summary-card--grand">
            <span className="cajero-tx-summary-label">Total del periodo</span>
            <span className="cajero-tx-summary-value">{formatCurrency(totals.grandTotal)}</span>
            <span className="cajero-tx-summary-sub">
              {totals.count} transacci{totals.count === 1 ? 'ón' : 'ones'}
            </span>
          </div>
          {totalsByType.map((entry) => (
            <div key={entry.type} className="cajero-tx-summary-card">
              <span className={`cajero-tx-badge ${entry.badgeClass}`}>{entry.label}</span>
              <span className="cajero-tx-summary-value">{formatCurrency(entry.amount)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="cajero-tx-table-wrap">
        {invalidRange ? (
          <div className="cajero-tx-table-empty">Rango de fechas inválido.</div>
        ) : loading ? (
          <div className="cajero-tx-table-loading">Cargando…</div>
        ) : transactions.length === 0 ? (
          <div className="cajero-tx-table-empty">No hay transacciones en este periodo.</div>
        ) : (
          <>
            <table className="cajero-tx-table">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Sucursal</th>
                  <th scope="col">Monto</th>
                  <th scope="col">Cajero</th>
                  <th scope="col">Notas</th>
                  <th scope="col" className="cajero-tx-col-actions">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="cajero-tx-cell-fecha">{formatDateTime(tx.registeredAt)}</td>
                    <td>{renderTypeBadge(tx.type)}</td>
                    <td className="cajero-tx-cell-branch">{tx.branch?.name || '—'}</td>
                    <td className="cajero-tx-cell-monto">{formatCurrency(tx.amount)}</td>
                    <td className="cajero-tx-cell-cajero">{tx.cashierName || '—'}</td>
                    <td className="cajero-tx-cell-notas">{tx.notes || '—'}</td>
                    <td className="cajero-tx-cell-actions">
                      <div className="cajero-tx-actions">
                        <button
                          type="button"
                          className="cajero-tx-action cajero-tx-action--edit"
                          onClick={() => handleEdit(tx)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="cajero-tx-action cajero-tx-action--delete"
                          onClick={() => handleDelete(tx)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="cajero-tx-cards">
              {transactions.map((tx) => (
                <li key={tx.id} className="cajero-tx-card">
                  <div className="cajero-tx-card-top">
                    {renderTypeBadge(tx.type)}
                    <span className="cajero-tx-card-amount">{formatCurrency(tx.amount)}</span>
                  </div>
                  <dl className="cajero-tx-card-body">
                    <div className="cajero-tx-card-row">
                      <dt>Fecha</dt>
                      <dd>{formatDateTime(tx.registeredAt)}</dd>
                    </div>
                    <div className="cajero-tx-card-row">
                      <dt>Sucursal</dt>
                      <dd>{tx.branch?.name || '—'}</dd>
                    </div>
                    <div className="cajero-tx-card-row">
                      <dt>Cajero</dt>
                      <dd>{tx.cashierName || '—'}</dd>
                    </div>
                    <div className="cajero-tx-card-row">
                      <dt>Notas</dt>
                      <dd>{tx.notes || '—'}</dd>
                    </div>
                  </dl>
                  <div className="cajero-tx-card-actions">
                    <button
                      type="button"
                      className="cajero-tx-action cajero-tx-action--edit"
                      onClick={() => handleEdit(tx)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="cajero-tx-action cajero-tx-action--delete"
                      onClick={() => handleDelete(tx)}
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {showForm && (
        <div className="cajero-tx-modal-overlay" onClick={closeForm} role="presentation">
          <div
            className="cajero-tx-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cajero-tx-modal-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="cajero-tx-modal-head">
              <h2 id="cajero-tx-modal-title" className="cajero-tx-modal-title">
                {editingId != null ? 'Editar transacción' : 'Registrar transacción'}
              </h2>
              <button
                type="button"
                className="cajero-tx-modal-close"
                onClick={closeForm}
                disabled={submitting}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <form className="cajero-tx-form" onSubmit={handleSubmit} noValidate>
              <div className="cajero-tx-field">
                <label className="cajero-tx-label" htmlFor="cajero-tx-form-type">
                  Tipo <span aria-hidden>*</span>
                </label>
                <select
                  id="cajero-tx-form-type"
                  className="cajero-tx-input"
                  value={form.type}
                  onChange={(ev) => setFormField('type', ev.target.value)}
                  aria-required="true"
                  aria-invalid={Boolean(formErrors.type)}
                >
                  <option value="">Selecciona un tipo…</option>
                  {FORM_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {formErrors.type && (
                  <span className="cajero-tx-field-error" role="alert">
                    {formErrors.type}
                  </span>
                )}
              </div>

              <div className="cajero-tx-field">
                <label className="cajero-tx-label" htmlFor="cajero-tx-form-amount">
                  Monto (MXN) <span aria-hidden>*</span>
                </label>
                <input
                  id="cajero-tx-form-amount"
                  className="cajero-tx-input cajero-tx-input--amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="transaction-amount"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(ev) => setFormField('amount', ev.target.value)}
                  aria-required="true"
                  aria-invalid={Boolean(formErrors.amount)}
                />
                {formErrors.amount && (
                  <span className="cajero-tx-field-error" role="alert">
                    {formErrors.amount}
                  </span>
                )}
              </div>

              <div className="cajero-tx-field">
                <label className="cajero-tx-label" htmlFor="cajero-tx-form-branch">
                  Sucursal <span aria-hidden>*</span>
                </label>
                <select
                  id="cajero-tx-form-branch"
                  className="cajero-tx-input"
                  value={form.branchId}
                  onChange={(ev) => setFormField('branchId', ev.target.value)}
                  disabled={loadingBranches}
                  aria-required="true"
                  aria-invalid={Boolean(formErrors.branchId)}
                >
                  <option value="">Selecciona una sucursal…</option>
                  {branches.map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {formErrors.branchId && (
                  <span className="cajero-tx-field-error" role="alert">
                    {formErrors.branchId}
                  </span>
                )}
              </div>

              <div className="cajero-tx-field">
                <label className="cajero-tx-label" htmlFor="cajero-tx-form-cashier">
                  Cajero <span aria-hidden>*</span>
                </label>
                <input
                  id="cajero-tx-form-cashier"
                  className="cajero-tx-input"
                  type="text"
                  autoComplete="name"
                  maxLength={CASHIER_MAX}
                  placeholder="Quien registró la operación"
                  value={form.cashierName}
                  onChange={(ev) => setFormField('cashierName', ev.target.value)}
                  aria-required="true"
                  aria-invalid={Boolean(formErrors.cashierName)}
                />
                {formErrors.cashierName && (
                  <span className="cajero-tx-field-error" role="alert">
                    {formErrors.cashierName}
                  </span>
                )}
              </div>

              <div className="cajero-tx-field">
                <label className="cajero-tx-label" htmlFor="cajero-tx-form-registered">
                  Fecha de registro <span aria-hidden>*</span>
                </label>
                <input
                  id="cajero-tx-form-registered"
                  className="cajero-tx-input"
                  type="datetime-local"
                  value={form.registeredAt}
                  onChange={(ev) => setFormField('registeredAt', ev.target.value)}
                  aria-required="true"
                  aria-invalid={Boolean(formErrors.registeredAt)}
                />
                {formErrors.registeredAt && (
                  <span className="cajero-tx-field-error" role="alert">
                    {formErrors.registeredAt}
                  </span>
                )}
              </div>

              {/* Campo "Notas" oculto temporalmente por pedido de producto.
                  La lógica de notes (estado, validación y envío) se conserva. */}

              <div className="cajero-tx-modal-actions">
                <button
                  type="button"
                  className="cajero-tx-btn-secondary"
                  onClick={closeForm}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="cajero-tx-submit"
                  disabled={submitting}
                  aria-busy={submitting}
                >
                  {submitting
                    ? 'Guardando…'
                    : editingId != null
                      ? 'Guardar cambios'
                      : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="cajero-tx-modal-overlay" onClick={cancelDelete} role="presentation">
          <div
            className="cajero-tx-modal cajero-tx-modal--confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cajero-tx-delete-title"
            aria-describedby="cajero-tx-delete-desc"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="cajero-tx-modal-head">
              <h2 id="cajero-tx-delete-title" className="cajero-tx-modal-title">
                Eliminar transacción
              </h2>
              <button
                type="button"
                className="cajero-tx-modal-close"
                onClick={cancelDelete}
                disabled={deleting}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div className="cajero-tx-confirm-body">
              <p id="cajero-tx-delete-desc" className="cajero-tx-confirm-text">
                ¿Seguro que deseas eliminar esta transacción? Esta acción no se puede deshacer.
              </p>
              <dl className="cajero-tx-confirm-details">
                <div className="cajero-tx-card-row">
                  <dt>Fecha</dt>
                  <dd>{formatDateTime(deleteTarget.registeredAt)}</dd>
                </div>
                <div className="cajero-tx-card-row">
                  <dt>Tipo</dt>
                  <dd>{TYPE_META[deleteTarget.type]?.label || deleteTarget.type || '—'}</dd>
                </div>
                <div className="cajero-tx-card-row">
                  <dt>Sucursal</dt>
                  <dd>{deleteTarget.branch?.name || '—'}</dd>
                </div>
                <div className="cajero-tx-card-row">
                  <dt>Monto</dt>
                  <dd>{formatCurrency(deleteTarget.amount)}</dd>
                </div>
              </dl>
            </div>

            <div className="cajero-tx-modal-actions cajero-tx-confirm-actions">
              <button
                type="button"
                className="cajero-tx-btn-secondary"
                onClick={cancelDelete}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="cajero-tx-submit cajero-tx-submit--danger"
                onClick={confirmDelete}
                disabled={deleting}
                aria-busy={deleting}
              >
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
