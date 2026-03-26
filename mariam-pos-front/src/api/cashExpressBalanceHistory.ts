import axios from 'axios';
import { onlineStoreClient } from './onlineStoreOrders';

function mapAxiosToError(error: unknown, fallback: string): Error {
  if (axios.isAxiosError(error)) {
    const msg = error.response?.data?.error;
    return new Error(typeof msg === 'string' ? msg : fallback);
  }
  if (error instanceof Error) return error;
  return new Error(fallback);
}

export interface BalanceHistoryUser {
  id: number;
  name?: string | null;
  email?: string | null;
}

export interface CashExpressBalanceHistoryItem {
  id: number;
  amount: number;
  description?: string | null;
  createdAt: string;
  user?: BalanceHistoryUser | null;
}

export interface BalanceHistoryResponse {
  history: CashExpressBalanceHistoryItem[];
  total: number;
  limit: number;
  offset: number;
  truncated?: boolean;
}

/**
 * Abonos positivos en cash_express_balance_history (requireAdmin en API).
 * Filtra por rango de fechas en día civil México (dateFrom / dateTo YYYY-MM-DD).
 */
export async function fetchCashExpressBalanceHistoryAbonos(params: {
  dateFrom: string;
  dateTo: string;
  limit?: number;
  offset?: number;
}): Promise<BalanceHistoryResponse> {
  const { data } = await onlineStoreClient.get<BalanceHistoryResponse>('/cash-express/balance/history', {
    params: {
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      onlyAbonos: 'true',
      limit: params.limit ?? 500,
      offset: params.offset ?? 0,
    },
  });
  return data;
}

export interface AddBalanceResponse {
  message?: string;
  balance?: {
    previousBalance: number;
    amount: number;
    newBalance: number;
  };
}

/**
 * Registra un abono en saldo Efectivo Express (requireAdmin). Opcional: registrationDate YYYY-MM-DD.
 */
export async function addCashExpressBalance(params: {
  amount: number;
  description: string;
  registrationDate?: string;
}): Promise<AddBalanceResponse> {
  const body: Record<string, unknown> = {
    amount: params.amount,
    description: params.description,
  };
  if (params.registrationDate != null && String(params.registrationDate).trim() !== '') {
    body.registrationDate = String(params.registrationDate).trim();
  }
  try {
    const { data } = await onlineStoreClient.post<AddBalanceResponse>('/cash-express/balance/add', body);
    return data;
  } catch (e) {
    throw mapAxiosToError(e, 'No se pudo registrar el abono');
  }
}
