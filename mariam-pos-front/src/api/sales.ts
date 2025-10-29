import {getAxiosClient} from "./axiosClient";
import type { Sale } from "../types/index";
import type { SalesSummary, DailySale, TopProduct, PaymentMethod} from "../types/report";


export const getSales = async (): Promise<Sale[]> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<Sale[]>(`/sales`);
  return data;
};

export const getSalesByDateRange = async (startDate:string, endDate:string): Promise<Sale[]> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<Sale[]>(`/sales/by-date-range?startDate=${startDate}&endDate=${endDate}`);
  return data;
};

export const createSale = async (sale: Omit<Sale, "id" | 'details' | 'createdAt'>): Promise<Sale> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.post<Sale>("/sales", sale);
  return data;
};
 
//Reportes
//Devuelve totales generales
export const getSalesSummary  = async (params:Record<string, string>): Promise<SalesSummary> => {
  const query = new URLSearchParams(params).toString();
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<SalesSummary>(`/sales/summary?${query}`);
  return data;
};

//Devuelve totales generales
export const getDailySales   = async (params:Record<string, string>): Promise<DailySale[]> => {
  const query = new URLSearchParams(params).toString();
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<DailySale[]>(`/sales/daily?${query}`);
  return data;
};

export const getTopProducts   = async (params:Record<string, string>): Promise<TopProduct[]> => {
  const query = new URLSearchParams(params).toString();
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<TopProduct[]>(`/sales/top-products?${query}`);
  return data;
};

export const getSalesByPaymentMethod   = async (params:Record<string, string>): Promise<PaymentMethod[]> => {
  const query = new URLSearchParams(params).toString();
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<PaymentMethod[]>(`/sales/by-payment-method?${query}`);
  return data;
};

