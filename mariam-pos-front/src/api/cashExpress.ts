import axios from 'axios';
import { onlineStoreClient } from './onlineStoreOrders';

function mapAxiosError(error: unknown, fallback: string): Error {
  if (axios.isAxiosError(error)) {
    const msg = error.response?.data?.error;
    return new Error(typeof msg === 'string' ? msg : fallback);
  }
  if (error instanceof Error) return error;
  return new Error(fallback);
}

export interface CashExpressUser {
  id: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface CashExpressRequestItem {
  id: number;
  folio?: string | null;
  amount: number;
  recipientName?: string | null;
  recipientPhone?: string | null;
  availableFrom?: string | null;
  estimatedDeliveryDate?: string | null;
  status: string;
  user?: CashExpressUser | null;
}

interface CashExpressListResponse {
  requests?: CashExpressRequestItem[];
}

/**
 * Listado para cajero: solicitudes con depósito validado, listas para entregar (mismo criterio que store-admin).
 */
export async function fetchCashExpressCajeroQueue(
  status = 'DEPOSITO_VALIDADO',
  page = 1,
  limit = 100,
): Promise<CashExpressRequestItem[]> {
  try {
    const { data } = await onlineStoreClient.get<CashExpressListResponse>('/cash-express', {
      params: { status, page, limit },
    });
    return Array.isArray(data?.requests) ? data.requests : [];
  } catch (error: unknown) {
    throw mapAxiosError(error, 'Error al cargar solicitudes de Efectivo Express');
  }
}

export async function patchCashExpressRequestStatus(id: number, status: string): Promise<void> {
  try {
    await onlineStoreClient.patch(`/cash-express/${id}/status`, { status });
  } catch (error: unknown) {
    throw mapAxiosError(error, 'No se pudo actualizar el estado de la solicitud');
  }
}
