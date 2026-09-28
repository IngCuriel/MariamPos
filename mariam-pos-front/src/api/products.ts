//import axiosClient from "./axiosClient";
import {getAxiosClient} from "./axiosClient";
import type { Product } from "../types/index";

export interface PagedProducts {
  data: Product[];
  total: number;
  page: number;
  pageSize: number;
}

export type ProductStatusFilter = "active" | "inactive";

// Catálogo paginado (más nuevos primero). page inicia en 1.
export const getProductsPaged = async (
  page = 1,
  pageSize = 25,
  status: ProductStatusFilter = "active"
): Promise<PagedProducts> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<PagedProducts>("/products", {
    params: { page, pageSize, status },
  });
  return data;
};

// Productos de una categoría, paginado (catálogo).
export const getProductsByCategoryPaged = async (
  categoryId: string,
  page = 1,
  pageSize = 25,
  status: ProductStatusFilter = "active"
): Promise<PagedProducts> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<PagedProducts>(
    `/products/category/${categoryId}`,
    { params: { page, pageSize, status } }
  );
  return data;
};

// Promociones: vigentes (vendibles) y vencidas (informativas).
export interface PromotionsResponse {
  active: Product[];
  expired: Product[];
}

export const getPromotions = async (): Promise<PromotionsResponse> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<PromotionsResponse>("/products/promotions");
  return data;
};

// Legacy: array plano (usado donde no se pagina).
export const getProducts = async (): Promise<Product[]> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<Product[]>("/products", {
    params: { paginate: "false" },
  });
  return data;
};

export const getProductsFilters = async (search:string, forSales: boolean = false): Promise<Product[]> => {
  const clientAxios = await getAxiosClient();
  const forSalesParam = forSales ? '&forSales=true' : '';
  const { data } = await clientAxios.get<Product[]>(`/products/filters?search=${search}${forSalesParam}`);
  return data;
};

export const getProductsByCategoryId = async (categoryId:string, forSales: boolean = false): Promise<Product[]> => {
  const clientAxios = await getAxiosClient();
  const forSalesParam = forSales ? '?forSales=true' : '';
  const { data } = await clientAxios.get<Product[]>(`/products/category/${categoryId}${forSalesParam}`);
  return data;
};

export const createProduct = async (product: Omit<Product, "id">): Promise<Product> => {
  const clientAxios = await getAxiosClient();
  // Obtener branch del localStorage (igual que en las ventas)
  const branch = localStorage.getItem('sucursal') || 'Sucursal Default';
  const productWithBranch = { ...product, branch };
  const { data } = await clientAxios.post<Product>("/products", productWithBranch);
  return data;
};
 
export const updateProduct = async (product: Product): Promise<Product> => {
  const clientAxios = await getAxiosClient();
  // Obtener branch del localStorage (igual que en las ventas)
  const branch = localStorage.getItem('sucursal') || 'Sucursal Default';
  const productWithBranch = { ...product, branch };
  const { data } = await clientAxios.put<Product>(`/products/${product.id}`, productWithBranch);
  return data;
};
 
export const deleteProduct = async (productId: number): Promise<string> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.delete<string>(`/products/${productId}`);
  return data;
};
 