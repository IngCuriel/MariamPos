import {getAxiosClient} from "./axiosClient";
import type { Category } from "../types/index";

export const getCategories = async (): Promise<Category[]> => {
  const client = await getAxiosClient();
  const { data } = await client.get<Category[]>("/categories");
  return data;
};

export const getCategoriesShowInPOS = async (): Promise<Category[]> => {
  const client = await getAxiosClient();
  const { data } = await client.get<Category[]>("/categories/showInPOS");
  return data;
};

export const createCategory = async (category: Omit<Category, "id">): Promise<Category> => {
  const client = await getAxiosClient();
  const { data } = await client.post<Category>("/categories", category);
  return data;
};

export const updateCategory = async (id:string, category:Partial<Category>): Promise<Category> => {
  const client = await getAxiosClient();
  const { data } = await client.put<Category>(`/categories/${id}`, category);
  return data;
};

interface ResponseDelete  {
  message:string
}

export const deleteCategory = async (id:string): Promise<ResponseDelete> => {
  const client = await getAxiosClient();
    const { data } = await client.delete<ResponseDelete>(`/categories/${id}`);
    return data;
};
