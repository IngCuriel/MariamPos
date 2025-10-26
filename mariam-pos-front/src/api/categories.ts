import axiosClient from "./axiosClient";
import type { Category } from "../types/index";

export const getCategories = async (): Promise<Category[]> => {
  const { data } = await axiosClient.get<Category[]>("/categories");
  return data;
};

export const createCategory = async (category: Omit<Category, "id">): Promise<Category> => {
  const { data } = await axiosClient.post<Category>("/categories", category);
  return data;
};

export const updateCategory = async (id:string, category:Partial<Category>): Promise<Category> => {
  const { data } = await axiosClient.put<Category>(`/categories/${id}`, category);
  return data;
};

interface ResponseDelete  {
  message:string
}

export const deleteCategory = async (id:string): Promise<ResponseDelete> => {
    const { data } = await axiosClient.delete<ResponseDelete>(`/categories/${id}`);
    return data;
};
