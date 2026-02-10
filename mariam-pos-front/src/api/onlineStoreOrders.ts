import axios from 'axios';

// URL del API de la tienda online
const ONLINE_STORE_API_URL = 'https://mariam-pos-web-api.onrender.com/api';
// const ONLINE_STORE_API_URL = 'http://localhost:4000/api'; // Para desarrollo local

// Crear cliente axios para la tienda online
const onlineStoreClient = axios.create({
  baseURL: ONLINE_STORE_API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token de autenticación
onlineStoreClient.interceptors.request.use(
  (config) => {
    // Obtener token del localStorage (si existe)
    const token = localStorage.getItem('online_store_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores
onlineStoreClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('Token inválido o expirado para la tienda online');
      // Limpiar token si es inválido
      localStorage.removeItem('online_store_token');
    }
    return Promise.reject(error);
  }
);

export interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  isAvailable?: boolean;
}

export interface Order {
  id: number;
  folio: string;
  total: number;
  status: 'PENDIENTE' | 'CONFIRMADO' | 'EN_PREPARACION' | 'LISTO' | 'ENTREGADO' | 'CANCELADO';
  notes: string | null;
  userId: number;
  branchId: number | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  branch?: {
    id: number;
    name: string;
  } | null;
  user?: {
    id: number;
    name: string;
    email: string;
  };
}

/**
 * Obtener todas las órdenes de la tienda online
 * @param status - (Opcional) Filtrar por estado
 * @returns Promise con array de órdenes
 */
export const getOnlineStoreOrders = async (status?: string): Promise<Order[]> => {
  try {
    const params = status ? { status } : {};
    const response = await onlineStoreClient.get<Order[]>('/orders', { params });
    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data?.error || 'Error al obtener órdenes');
    } else if (error.request) {
      throw new Error('Error de conexión. Verifica tu conexión a internet.');
    } else {
      throw new Error('Error al procesar la solicitud');
    }
  }
};

/**
 * Obtener una orden específica por ID
 * @param id - ID de la orden
 * @returns Promise con la orden
 */
export const getOnlineStoreOrderById = async (id: number): Promise<Order> => {
  try {
    const response = await onlineStoreClient.get<Order>(`/orders/${id}`);
    return response.data;
  } catch (error: any) {
    if (error.response) {
      if (error.response.status === 404) {
        throw new Error('Orden no encontrada');
      } else if (error.response.status === 403) {
        throw new Error('No tienes permiso para ver esta orden');
      }
      throw new Error(error.response.data?.error || 'Error al obtener la orden');
    } else if (error.request) {
      throw new Error('Error de conexión. Verifica tu conexión a internet.');
    } else {
      throw new Error('Error al procesar la solicitud');
    }
  }
};

/**
 * Actualizar estado de una orden (solo admin)
 * @param id - ID de la orden
 * @param status - Nuevo estado
 * @returns Promise con la orden actualizada
 */
export const updateOnlineStoreOrderStatus = async (
  id: number,
  status: Order['status']
): Promise<Order> => {
  try {
    const response = await onlineStoreClient.patch(`/orders/${id}/status`, { status });
    return response.data.order;
  } catch (error: any) {
    if (error.response) {
      if (error.response.status === 403) {
        throw new Error('Solo los administradores pueden actualizar el estado');
      }
      throw new Error(error.response.data?.error || 'Error al actualizar el estado');
    } else if (error.request) {
      throw new Error('Error de conexión. Verifica tu conexión a internet.');
    } else {
      throw new Error('Error al procesar la solicitud');
    }
  }
};

/**
 * Guardar token de autenticación para la tienda online
 * @param token - Token JWT
 */
export const setOnlineStoreToken = (token: string): void => {
  localStorage.setItem('online_store_token', token);
};

/**
 * Obtener token de autenticación para la tienda online
 * @returns Token o null si no existe
 */
export const getOnlineStoreToken = (): string | null => {
  return localStorage.getItem('online_store_token');
};

/**
 * Eliminar token de autenticación
 */
export const removeOnlineStoreToken = (): void => {
  localStorage.removeItem('online_store_token');
  localStorage.removeItem('online_store_user');
};

/**
 * Login en la tienda online
 * @param email - Email del usuario
 * @param password - Contraseña
 * @returns Promise con user y token
 */
export const loginOnlineStore = async (email: string, password: string): Promise<{ user: any; token: string }> => {
  try {
    const response = await onlineStoreClient.post<{ user: any; token: string }>('/auth/login', {
      email,
      password,
    });
    
    // Guardar token y usuario
    setOnlineStoreToken(response.data.token);
    localStorage.setItem('online_store_user', JSON.stringify(response.data.user));
    
    return response.data;
  } catch (error: any) {
    if (error.response) {
      if (error.response.status === 401) {
        throw new Error('Email o contraseña incorrectos');
      }
      throw new Error(error.response.data?.error || 'Error al iniciar sesión');
    } else if (error.request) {
      throw new Error('Error de conexión. Verifica tu conexión a internet.');
    } else {
      throw new Error('Error al procesar la solicitud');
    }
  }
};

/**
 * Obtener usuario autenticado
 * @returns Usuario o null si no existe
 */
export const getOnlineStoreUser = (): any | null => {
  const userStr = localStorage.getItem('online_store_user');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * Verificar si hay un usuario autenticado
 * @returns true si hay token y usuario
 */
export const isOnlineStoreAuthenticated = (): boolean => {
  return !!(getOnlineStoreToken() && getOnlineStoreUser());
};

