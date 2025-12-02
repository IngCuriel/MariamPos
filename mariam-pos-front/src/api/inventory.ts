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

