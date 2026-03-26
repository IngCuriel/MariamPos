import axios from 'axios';

const ONLINE_STORE_API_URL = 'https://mariam-pos-web-api.onrender.com/api';
// const ONLINE_STORE_API_URL = 'http://localhost:4000/api';

const onlineStoreClient = axios.create({
  baseURL: ONLINE_STORE_API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

onlineStoreClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('online_store_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

onlineStoreClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('Token inválido o expirado para la tienda online');
      localStorage.removeItem('online_store_token');
    }
    return Promise.reject(error);
  },
);

function mapAxiosError(error: unknown, fallback: string): Error {
  if (axios.isAxiosError(error)) {
    const msg = error.response?.data?.error;
    return new Error(typeof msg === 'string' ? msg : fallback);
  }
  if (error instanceof Error) return error;
  return new Error(fallback);
}

export interface StoreOrderItem {
  id: number;
  productId: number | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  isAvailable?: boolean | null;
  confirmedQuantity?: number | null;
  presentationName?: string | null;
  presentationQuantity?: number | null;
}

export interface StoreDeliveryType {
  id: number;
  code?: string;
  name?: string;
}

export interface StoreOrder {
  id: number;
  folio?: string;
  total: number;
  status: string;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string;
  readyAt?: string | null;
  deliveredAt?: string | null;
  /** Dirección de envío (envío a domicilio), viene del API al confirmar el cliente. */
  deliveryAddress?: string | null;
  deliveryCost?: number | null;
  items: StoreOrderItem[];
  branch?: { id: number; name: string } | null;
  user?: { id: number; name?: string; email?: string };
  deliveryType?: StoreDeliveryType | null;
}

export interface OrdersPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface OrdersPageResponse {
  orders: StoreOrder[];
  pagination: OrdersPagination;
}

export async function fetchOnlineStoreOrdersPage(
  status: string | undefined,
  page = 1,
  limit = 100,
): Promise<OrdersPageResponse> {
  try {
    const params: Record<string, string | number> = { page, limit };
    if (status) params.status = status;
    const { data } = await onlineStoreClient.get<OrdersPageResponse>('/orders', { params });
    return data;
  } catch (error: unknown) {
    throw mapAxiosError(error, 'Error al obtener pedidos');
  }
}

export async function fetchOnlineStoreOrderById(id: string | number): Promise<StoreOrder> {
  try {
    const { data } = await onlineStoreClient.get<StoreOrder>(`/orders/${id}`);
    return data;
  } catch (error: unknown) {
    throw mapAxiosError(error, 'Error al obtener el pedido');
  }
}

export interface ReviewAvailabilityItemPayload {
  itemId: number;
  isAvailable: boolean;
  confirmedQuantity: number;
}

export async function reviewOnlineStoreOrderAvailability(
  orderId: number,
  items: ReviewAvailabilityItemPayload[],
): Promise<StoreOrder> {
  try {
    const { data } = await onlineStoreClient.post<{ order: StoreOrder }>(
      `/orders/${orderId}/review-availability`,
      { items },
    );
    return data.order;
  } catch (error: unknown) {
    throw mapAxiosError(error, 'Error al confirmar disponibilidad');
  }
}

export async function markOnlineStoreOrderReady(orderId: number): Promise<StoreOrder> {
  try {
    const { data } = await onlineStoreClient.post<{ order: StoreOrder }>(
      `/orders/${orderId}/mark-ready`,
      {},
    );
    return data.order;
  } catch (error: unknown) {
    throw mapAxiosError(error, 'Error al marcar como listo');
  }
}

export async function patchOnlineStoreOrderStatus(
  orderId: number,
  status: string,
  deliveredAt?: string,
): Promise<StoreOrder> {
  try {
    const body = deliveredAt != null ? { status, deliveredAt } : { status };
    const { data } = await onlineStoreClient.patch<{ order: StoreOrder }>(
      `/orders/${orderId}/status`,
      body,
    );
    return data.order;
  } catch (error: unknown) {
    throw mapAxiosError(error, 'Error al actualizar estado');
  }
}

export async function cancelOnlineStoreOrder(orderId: number, reason: string): Promise<StoreOrder> {
  try {
    const { data } = await onlineStoreClient.post<{ order: StoreOrder }>(`/orders/${orderId}/cancel`, {
      reason: String(reason).trim(),
    });
    return data.order;
  } catch (error: unknown) {
    throw mapAxiosError(error, 'Error al cancelar el pedido');
  }
}

export interface StoreProductPreview {
  id: number;
  name: string;
  code?: string | null;
  icon?: string | null;
  images?: Array<{ url: string }>;
}

export async function fetchOnlineStoreProductById(productId: number): Promise<StoreProductPreview> {
  try {
    const { data } = await onlineStoreClient.get<StoreProductPreview>(`/products/${productId}`);
    return data;
  } catch (error: unknown) {
    throw mapAxiosError(error, 'Error al obtener el producto');
  }
}

export const setOnlineStoreToken = (token: string): void => {
  localStorage.setItem('online_store_token', token);
};

export const getOnlineStoreToken = (): string | null => {
  return localStorage.getItem('online_store_token');
};

export const removeOnlineStoreToken = (): void => {
  localStorage.removeItem('online_store_token');
  localStorage.removeItem('online_store_user');
};

export const loginOnlineStore = async (
  email: string,
  password: string,
): Promise<{ user: Record<string, unknown>; token: string }> => {
  try {
    const response = await onlineStoreClient.post<{ user: Record<string, unknown>; token: string }>(
      '/auth/login',
      { email, password },
    );
    setOnlineStoreToken(response.data.token);
    localStorage.setItem('online_store_user', JSON.stringify(response.data.user));
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      throw new Error('Email o contraseña incorrectos');
    }
    throw mapAxiosError(error, 'Error al iniciar sesión');
  }
};

export const getOnlineStoreUser = (): Record<string, unknown> | null => {
  const userStr = localStorage.getItem('online_store_user');
  if (userStr) {
    try {
      return JSON.parse(userStr) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
};

export const isOnlineStoreAuthenticated = (): boolean => {
  return !!(getOnlineStoreToken() && getOnlineStoreUser());
};
