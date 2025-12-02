import { getAxiosClient } from "./axiosClient";
import type { Supplier } from "../types/index";

export const getSuppliers = async (search?: string, status?: number): Promise<Supplier[]> => {
  const clientAxios = await getAxiosClient();
  const params: any = {};
  if (search) params.search = search;
  if (status !== undefined) params.status = status;
  const { data } = await clientAxios.get<Supplier[]>("/suppliers", { params });
  return data;
};

export const getSupplierById = async (id: number): Promise<Supplier> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<Supplier>(`/suppliers/${id}`);
  return data;
};

export const createSupplier = async (supplier: Omit<Supplier, "id" | "createdAt" | "updatedAt">): Promise<Supplier> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.post<Supplier>("/suppliers", supplier);
  return data;
};

export const updateSupplier = async (id: number, supplier: Partial<Omit<Supplier, "id" | "createdAt" | "updatedAt">>): Promise<Supplier> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.put<Supplier>(`/suppliers/${id}`, supplier);
  return data;
};

export const deleteSupplier = async (id: number): Promise<void> => {
  const clientAxios = await getAxiosClient();
  await clientAxios.delete(`/suppliers/${id}`);
};

