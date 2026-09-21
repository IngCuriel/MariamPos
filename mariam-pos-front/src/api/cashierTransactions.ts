import { onlineStoreClient } from './onlineStoreOrders';

/** Tipos de transacción soportados por el backend. */
export type CashierTransactionType = 'RECARGA' | 'PAGO_SERVICIO' | 'PIN_ELECTRONICO';

export interface CashierTransactionBranch {
  id: number;
  name: string;
}

export interface CashierTransaction {
  id: number;
  type: CashierTransactionType;
  amount: number;
  branchId: number;
  branch?: CashierTransactionBranch | null;
  cashierName: string;
  notes?: string | null;
  registeredAt: string;
}

export interface CashierTransactionTotals {
  byType: Record<CashierTransactionType, number>;
  grandTotal: number;
  count: number;
}

export interface CashierTransactionsResponse {
  transactions: CashierTransaction[];
  totals: CashierTransactionTotals;
}

export interface CashierTransactionsFilters {
  dateFrom?: string;
  dateTo?: string;
  type?: string;
  branchId?: string | number;
}

export interface CashierTransactionPayload {
  type: CashierTransactionType;
  amount: number;
  branchId: number;
  cashierName: string;
  notes?: string;
  registeredAt?: string;
}

export interface ConfigBranch {
  id: number;
  name: string;
  isActive?: boolean;
}

/**
 * Lista las transacciones de cajero con filtros opcionales.
 * Los filtros vacíos se omiten para que el backend aplique sus valores por defecto.
 */
export const getCashierTransactions = async (
  filters: CashierTransactionsFilters = {},
): Promise<CashierTransactionsResponse> => {
  const params: Record<string, string | number> = {};
  const { dateFrom, dateTo, type, branchId } = filters;
  if (dateFrom != null && String(dateFrom).trim() !== '') {
    params.dateFrom = String(dateFrom).trim();
  }
  if (dateTo != null && String(dateTo).trim() !== '') {
    params.dateTo = String(dateTo).trim();
  }
  if (type != null && String(type).trim() !== '') {
    params.type = String(type).trim();
  }
  if (branchId != null && String(branchId).trim() !== '') {
    params.branchId = branchId;
  }
  const response = await onlineStoreClient.get<CashierTransactionsResponse>(
    '/cashier-transactions',
    { params },
  );
  return response.data;
};

/** Crea una transacción de cajero. */
export const createCashierTransaction = async (
  payload: CashierTransactionPayload,
): Promise<CashierTransaction> => {
  const response = await onlineStoreClient.post<CashierTransaction>(
    '/cashier-transactions',
    payload,
  );
  return response.data;
};

/** Actualiza una transacción de cajero existente por id. */
export const updateCashierTransaction = async (
  id: number,
  payload: CashierTransactionPayload,
): Promise<CashierTransaction> => {
  const response = await onlineStoreClient.put<CashierTransaction>(
    `/cashier-transactions/${id}`,
    payload,
  );
  return response.data;
};

/** Elimina una transacción de cajero por id. */
export const deleteCashierTransaction = async (id: number): Promise<void> => {
  await onlineStoreClient.delete(`/cashier-transactions/${id}`);
};

/** Obtiene todas las sucursales para configuración (incluye isActive). */
export const getBranchesForConfig = async (): Promise<ConfigBranch[]> => {
  const response = await onlineStoreClient.get<ConfigBranch[]>('/products/config/branches');
  return response.data;
};
