import { getAxiosClient } from "./axiosClient";
import type { Purchase, CreatePurchaseInput, PaginatedResponse } from "../types/index";

export const getPurchases = async (
  page: number = 1,
  limit: number = 50,
  supplierId?: number,
  paymentStatus?: string,
  startDate?: string,
  endDate?: string,
  search?: string
): Promise<PaginatedResponse<Purchase>> => {
  const clientAxios = await getAxiosClient();
  const params: any = { page, limit };
  if (supplierId) params.supplierId = supplierId;
  if (paymentStatus) params.paymentStatus = paymentStatus;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  if (search) params.search = search;
  
  const { data } = await clientAxios.get<PaginatedResponse<Purchase>>("/purchases", { params });
  return data;
};

export const getPurchaseById = async (id: number): Promise<Purchase> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<Purchase>(`/purchases/${id}`);
  return data;
};

export const createPurchase = async (purchase: CreatePurchaseInput): Promise<Purchase> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.post<Purchase>("/purchases", purchase);
  return data;
};

export const updatePurchase = async (id: number, purchase: Partial<CreatePurchaseInput>): Promise<Purchase> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.put<Purchase>(`/purchases/${id}`, purchase);
  return data;
};

export const deletePurchase = async (id: number): Promise<void> => {
  const clientAxios = await getAxiosClient();
  await clientAxios.delete(`/purchases/${id}`);
};

