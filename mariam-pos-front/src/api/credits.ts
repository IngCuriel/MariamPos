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


// Respuesta paginada genérica del backend.
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  // Solo para créditos: cantidad por cobrar (pendientes + parciales) del rango.
  pendingCount?: number;
}

// Créditos por rango de fechas con paginación server-side.
// Filtros opcionales: status (PENDING | PARTIALLY_PAID | PAID) y clientId.
export const getCreditsByDateRangePaginated = async (
  startDate: string,
  endDate: string,
  page: number,
  limit: number,
  opts?: { status?: string; clientId?: string }
): Promise<PaginatedResponse<ClientCredit>> => {
  const clientAxios = await getAxiosClient();
  const params: Record<string, string | number> = {
    startDate,
    endDate,
    page,
    limit,
  };
  if (opts?.status && opts.status !== "ALL") params.status = opts.status;
  if (opts?.clientId) params.clientId = opts.clientId;

  const { data } = await clientAxios.get<PaginatedResponse<ClientCredit>>(
    `/credits/by-date-range`,
    { params }
  );
  return data;
};

// Abonos por rango de fechas con paginación server-side.
export const getCreditPaymentsByDateRangePaginated = async (
  startDate: string,
  endDate: string,
  page: number,
  limit: number
): Promise<PaginatedResponse<CreditPayment>> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<PaginatedResponse<CreditPayment>>(
    `/credits/payments/by-date-range`,
    { params: { startDate, endDate, page, limit } }
  );
  return data;
};
