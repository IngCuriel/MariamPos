import { getAxiosClient } from "./axiosClient";
import type {
  ClientCredit,
  CreditPayment,
  CreateCreditInput,
  CreateCreditPaymentInput,
} from "../types/index";

// Obtener créditos pendientes de un cliente
export const getClientCredits = async (
  clientId: string,
  status?: "PENDING" | "PARTIALLY_PAID" | "PAID"
): Promise<ClientCredit[]> => {
  const clientAxios = await getAxiosClient();
  const params = status ? { status } : {};
  const { data } = await clientAxios.get<ClientCredit[]>(
    `/credits/client/${clientId}`,
    { params }
  );
  return data;
};

// Obtener resumen de créditos de un cliente
export const getClientCreditSummary = async (clientId: string): Promise<{
  totalPending: number;
  totalCredits: number;
  credits: ClientCredit[];
}> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get(`/credits/client/${clientId}/summary`);
  return data;
};

// Obtener todos los créditos pendientes
export const getAllPendingCredits = async (): Promise<ClientCredit[]> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<ClientCredit[]>("/credits/pending");
  return data;
};

// Obtener un crédito por ID
export const getCreditById = async (creditId: number): Promise<ClientCredit> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<ClientCredit>(`/credits/${creditId}`);
  return data;
};

// Crear un nuevo crédito
export const createCredit = async (
  input: CreateCreditInput
): Promise<ClientCredit> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.post<ClientCredit>("/credits", input);
  return data;
};

// Registrar un abono a un crédito
export const createCreditPayment = async (
  creditId: number,
  input: CreateCreditPaymentInput
): Promise<{
  payment: CreditPayment;
  credit: ClientCredit;
}> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.post(`/credits/${creditId}/payment`, input);
  return data;
};

// Obtener créditos por rango de fechas
export const getCreditsByDateRange = async (
  startDate: string,
  endDate: string
): Promise<ClientCredit[]> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<ClientCredit[]>(
    `/credits/by-date-range?startDate=${startDate}&endDate=${endDate}`
  );
  return data;
};

// Obtener abonos por rango de fechas
export const getCreditPaymentsByDateRange = async (
  startDate: string,
  endDate: string
): Promise<CreditPayment[]> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<CreditPayment[]>(
    `/credits/payments/by-date-range?startDate=${startDate}&endDate=${endDate}`
  );
  return data;
};

