//import axiosClient from "./axiosClient";
import {getAxiosClient} from "./axiosClient";
import type { Product } from "../types/index";

export const getProducts = async (): Promise<Product[]> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<Product[]>("/products");
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
 