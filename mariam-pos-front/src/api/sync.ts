import { getAxiosClient } from "./axiosClient";

export interface ProductSyncStats {
  products?: {
    pending: number;
    synced: number;
  };
  categories?: {
    pending: number;
    synced: number;
  };
  pendingProducts?: number; // Compatibilidad con estructura antigua
  pendingCategories?: number; // Compatibilidad con estructura antigua
  online: boolean;
  lastSync: Date | null;
  isSyncing: boolean;
  consecutiveFailures: number;
}

export interface ProductSyncResult {
  success: boolean;
  count?: number;
  remaining?: number;
  message: string;
}

/**
 * Obtiene las estadísticas de sincronización de productos
 */
export const getProductSyncStats = async (): Promise<ProductSyncStats> => {
  const client = await getAxiosClient();
  const { data } = await client.get<ProductSyncStats>("/sync/products/stats");
  return data;
};

/**
 * Fuerza la sincronización de productos pendientes
 * @param limit - Número máximo de productos a sincronizar (por defecto 100)
 */
export const forceProductSync = async (limit: number = 100): Promise<ProductSyncResult> => {
  const client = await getAxiosClient();
  const { data } = await client.post<ProductSyncResult>("/sync/products/force", { limit });
  return data;
};

