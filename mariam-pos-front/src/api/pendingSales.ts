import { getAxiosClient } from "./axiosClient";

export interface PendingSaleDetail {
  id?: number;
  productId: number;
  quantity: number;
  price: number;
  subTotal: number;
  productName?: string;
  presentationId?: number;
  presentationName?: string;
  saleType?: string;
  basePrice?: number;
}

export interface PendingSale {
  id: number;
  code: string;
  clientName?: string;
  total: number;
  branch?: string;
  cashRegister?: string;
  details: PendingSaleDetail[];
  createdAt: string;
  updatedAt: string;
}

export const getPendingSales = async (): Promise<PendingSale[]> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<PendingSale[]>("/pending-sales");
  return data;
};

export const getPendingSaleById = async (id: number): Promise<PendingSale> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<PendingSale>(`/pending-sales/${id}`);
  return data;
};

export const createPendingSale = async (
  pendingSale: Omit<PendingSale, "id" | "code" | "createdAt" | "updatedAt" | "details"> & {
    details: Omit<PendingSaleDetail, "id">[];
  }
): Promise<PendingSale> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.post<PendingSale>("/pending-sales", pendingSale);
  return data;
};

export const deletePendingSale = async (id: number): Promise<void> => {
  const clientAxios = await getAxiosClient();
  await clientAxios.delete(`/pending-sales/${id}`);
};

export const updatePendingSale = async (
  id: number,
  pendingSale: Partial<Omit<PendingSale, "id" | "code" | "createdAt" | "updatedAt">>
): Promise<PendingSale> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.put<PendingSale>(`/pending-sales/${id}`, pendingSale);
  return data;
};

