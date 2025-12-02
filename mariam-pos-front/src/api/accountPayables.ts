import { getAxiosClient } from "./axiosClient";
import type {
  AccountPayable,
  CreateAccountPayableInput,
  RegisterPaymentInput,
  PaginatedResponse,
  AccountPayablesSummary,
} from "../types/index";

export const getAccountPayables = async (
  page: number = 1,
  limit: number = 50,
  supplierId?: number,
  status?: string,
  overdue?: boolean,
  startDate?: string,
  endDate?: string
): Promise<PaginatedResponse<AccountPayable>> => {
  const clientAxios = await getAxiosClient();
  const params: any = { page, limit };
  if (supplierId) params.supplierId = supplierId;
  if (status) params.status = status;
  if (overdue !== undefined) params.overdue = overdue.toString();
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  
  const { data } = await clientAxios.get<PaginatedResponse<AccountPayable>>("/account-payables", { params });
  return data;
};

export const getAccountPayableById = async (id: number): Promise<AccountPayable> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<AccountPayable>(`/account-payables/${id}`);
  return data;
};

export const getAccountPayablesSummary = async (supplierId?: number): Promise<AccountPayablesSummary> => {
  const clientAxios = await getAxiosClient();
  const params: any = {};
  if (supplierId) params.supplierId = supplierId;
  const { data } = await clientAxios.get<AccountPayablesSummary>("/account-payables/summary", { params });
  return data;
};

export const createAccountPayable = async (accountPayable: CreateAccountPayableInput): Promise<AccountPayable> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.post<AccountPayable>("/account-payables", accountPayable);
  return data;
};

export const registerPayment = async (id: number, payment: RegisterPaymentInput): Promise<AccountPayable> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.post<AccountPayable>(`/account-payables/${id}/payment`, payment);
  return data;
};

export const updateAccountPayable = async (
  id: number,
  accountPayable: Partial<CreateAccountPayableInput>
): Promise<AccountPayable> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.put<AccountPayable>(`/account-payables/${id}`, accountPayable);
  return data;
};

export const deleteAccountPayable = async (id: number): Promise<void> => {
  const clientAxios = await getAxiosClient();
  await clientAxios.delete(`/account-payables/${id}`);
};

