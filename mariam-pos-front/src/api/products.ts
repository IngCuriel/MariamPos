import axiosClient from "./axiosClient";
import type { Product } from "../types/index";

export const getProducts = async (): Promise<Product[]> => {
  const { data } = await axiosClient.get<Product[]>("/products");
  return data;
};

export const getProductsFilters = async (search:string): Promise<Product[]> => {
  const { data } = await axiosClient.get<Product[]>(`/products/filters?search=${search}`);
  return data;
};

export const getProductsByCategoryId = async (categoryId:string): Promise<Product[]> => {
  const { data } = await axiosClient.get<Product[]>(`/products/category/${categoryId}`);
  return data;
};

export const createProduct = async (product: Omit<Product, "id">): Promise<Product> => {
  const { data } = await axiosClient.post<Product>("/products", product);
  return data;
};
 
export const updateProduct = async (product: Product): Promise<Product> => {
  const { data } = await axiosClient.put<Product>(`/products/${product.id}`, product);
  return data;
};
 
export const deleteProduct = async (productId: number): Promise<string> => {
  const { data } = await axiosClient.delete<string>(`/products/${productId}`);
  return data;
};
 