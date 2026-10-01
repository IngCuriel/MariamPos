import { getAxiosClient } from "./axiosClient";
import type {
  CancelSaleRequest,
  CancelSaleResponse,
  ReturnSaleRequest,
  ReturnSaleResponse,
} from "../types/index";

// Cancela una venta completa: POST /sales/:id/cancel
export const cancelSale = async (
  saleId: number,
  body: CancelSaleRequest
): Promise<CancelSaleResponse> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.post<CancelSaleResponse>(
    `/sales/${saleId}/cancel`,
    body
  );
  return data;
};

// Registra una devolución parcial de líneas: POST /sales/:id/return
export const returnSale = async (
  saleId: number,
  body: ReturnSaleRequest
): Promise<ReturnSaleResponse> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.post<ReturnSaleResponse>(
    `/sales/${saleId}/return`,
    body
  );
  return data;
};

// Devuelve la venta con sus cancelaciones y devoluciones: GET /sales/:id/reversals
export const getSaleReversals = async (saleId: number) => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get(`/sales/${saleId}/reversals`);
  return data;
};
