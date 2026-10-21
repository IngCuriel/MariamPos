import { getAxiosClient } from "./axiosClient";
import type {
  Inventory,
  InventoryMovement,
  CreateInventoryMovementInput,
  UpdateStockInput,
  Product,
} from "../types/index";

// Interfaz para respuesta paginada
export interface PaginatedInventoryResponse {
  data: Inventory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Obtener inventario de todos los productos (con paginación y filtros)
export const getInventory = async (
  page: number = 1,
  limit: number = 50,
  search?: string,
  categoryId?: string,
  lowStockOnly?: boolean
): Promise<PaginatedInventoryResponse> => {
  const clientAxios = await getAxiosClient();
  const params = new URLSearchParams();
  params.append("page", page.toString());
  params.append("limit", limit.toString());
  if (search) params.append("search", search);
  if (categoryId) params.append("categoryId", categoryId);
  if (lowStockOnly) params.append("lowStockOnly", "true");
  
  const { data } = await clientAxios.get<PaginatedInventoryResponse>(
    `/inventory?${params.toString()}`
  );
  return data;
};

// Obtener inventario de un producto específico
export const getProductInventory = async (productId: number): Promise<Inventory | null> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<Inventory>(`/inventory/product/${productId}`);
  return data;
};

// Obtener productos con inventario bajo
export const getLowStockProducts = async (): Promise<Inventory[]> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<Inventory[]>("/inventory/low-stock");
  return data;
};

// Crear un movimiento de inventario
export const createInventoryMovement = async (
  movement: CreateInventoryMovementInput
): Promise<InventoryMovement> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.post<InventoryMovement>("/inventory/movements", movement);
  return data;
};

// Obtener movimientos de inventario de un producto
export const getProductMovements = async (
  productId: number,
  limit?: number
): Promise<InventoryMovement[]> => {
  const clientAxios = await getAxiosClient();
  const params = limit ? `?limit=${limit}` : "";
  const { data } = await clientAxios.get<InventoryMovement[]>(
    `/inventory/movements/product/${productId}${params}`
  );
  return data;
};

// Obtener todos los movimientos de inventario
export const getAllMovements = async (
  startDate?: string,
  endDate?: string
): Promise<InventoryMovement[]> => {
  const clientAxios = await getAxiosClient();
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const query = params.toString();
  const { data } = await clientAxios.get<InventoryMovement[]>(
    `/inventory/movements${query ? `?${query}` : ""}`
  );
  return data;
};

// Actualizar stock directamente (ajuste rápido)
export const updateStock = async (update: UpdateStockInput): Promise<Inventory> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.put<Inventory>(`/inventory/stock`, update);
  return data;
};

// Habilitar/deshabilitar rastreo de inventario para un producto
export const toggleInventoryTracking = async (
  productId: number,
  trackInventory: boolean,
  currentStock: number,
  minStock: number,
): Promise<Product> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.patch<Product>(`/inventory/tracking/${productId}`, {
    trackInventory,
    currentStock,
    minStock,
  });
  return data;
};


// Productos de un departamento para el asistente de inventario inicial.
export const getProductsByDepartmentForInventory = async (
  departmentId: string
): Promise<Product[]> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<Product[]>(
    `/inventory/by-department/${departmentId}`
  );
  return data;
};

// Guardado en lote del inventario inicial.
export interface InitialInventoryItem {
  productId: number;
  currentStock: number;
  minStock?: number;
}

export const saveInitialInventoryBatch = async (payload: {
  items: InitialInventoryItem[];
  branch?: string;
  cashRegister?: string;
  createdBy?: string;
}): Promise<{ ok: boolean; count: number; productIds: number[] }> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.post(`/inventory/initial-batch`, payload);
  return data;
};


// ============================================================
// 📉 ROTACIÓN — Productos sin movimiento (dormidos)
// ============================================================
export interface StaleProduct {
  id: number;
  code: string | null;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  tracksInventory: boolean;
  currentStock: number | null; // null si el producto no maneja inventario
  cost: number;
  price: number;
  tiedCapital: number;
  lastSale: string | null;
  everSold: boolean;
  soldUnits: number;
  salesCount: number;
  daysWithoutSale: number | null;
  createdAt: string;
}

export interface StaleProductsSummary {
  totalProducts: number;
  neverSold: number;
  tiedCapital: number;
  totalUnits: number;
  daysThreshold: number;
  shown: number;
  truncated: boolean;
  limit: number;
}

export interface StaleProductsResponse {
  data: StaleProduct[];
  summary: StaleProductsSummary;
}

export const getStaleProducts = async (params?: {
  days?: number;
  onlyStock?: boolean;
  neverSold?: boolean;
  scope?: "all" | "inventory";
  categoryId?: string;
  search?: string;
  limit?: number;
}): Promise<StaleProductsResponse> => {
  const clientAxios = await getAxiosClient();
  const query = new URLSearchParams();
  if (params?.days !== undefined) query.append("days", String(params.days));
  if (params?.onlyStock !== undefined) query.append("onlyStock", String(params.onlyStock));
  if (params?.neverSold !== undefined) query.append("neverSold", String(params.neverSold));
  if (params?.scope) query.append("scope", params.scope);
  if (params?.categoryId) query.append("categoryId", params.categoryId);
  if (params?.search) query.append("search", params.search);
  if (params?.limit !== undefined) query.append("limit", String(params.limit));

  const { data } = await clientAxios.get<StaleProductsResponse>(
    `/inventory/stale?${query.toString()}`
  );
  return data;
};
