import { getAxiosClient } from "./axiosClient";
import type {
  CashRegisterShift,
  OpenShiftInput,
  CloseShiftInput,
  ShiftSummary,
} from "../types/index";

// ============================================================
// 📌 ABRIR TURNO DE CAJA
// ============================================================
export const openShift = async (
  input: OpenShiftInput
): Promise<CashRegisterShift> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.post<CashRegisterShift>(
    "/cash-register/shifts/open",
    input
  );
  return data;
};

// ============================================================
// 📌 CERRAR TURNO DE CAJA
// ============================================================
export const closeShift = async (
  shiftId: number,
  input: CloseShiftInput
): Promise<CashRegisterShift> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.post<CashRegisterShift>(
    `/cash-register/shifts/${shiftId}/close`,
    input
  );
  return data;
};

// ============================================================
// 📌 OBTENER TURNO ACTIVO
// ============================================================
export const getActiveShift = async (
  branch: string,
  cashRegister: string
): Promise<CashRegisterShift | null> => {
  try {
    const clientAxios = await getAxiosClient();
    const { data } = await clientAxios.get<CashRegisterShift>(
      `/cash-register/shifts/active?branch=${encodeURIComponent(
        branch
      )}&cashRegister=${encodeURIComponent(cashRegister)}`
    );
    return data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

// ============================================================
// 📌 OBTENER TURNO POR ID
// ============================================================
export const getShiftById = async (
  shiftId: number
): Promise<CashRegisterShift> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<CashRegisterShift>(
    `/cash-register/shifts/${shiftId}`
  );
  return data;
};

// ============================================================
// 📌 LISTAR TURNOS POR RANGO DE FECHAS
// ============================================================
export const getShiftsByDateRange = async (
  params: {
    startDate?: string;
    endDate?: string;
    branch?: string;
    cashRegister?: string;
    status?: string;
  }
): Promise<CashRegisterShift[]> => {
  const query = new URLSearchParams(
    params as Record<string, string>
  ).toString();
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<CashRegisterShift[]>(
    `/cash-register/shifts?${query}`
  );
  return data;
};

// ============================================================
// 📌 OBTENER RESUMEN DE TURNO
// ============================================================
export const getShiftSummary = async (
  shiftId: number
): Promise<ShiftSummary> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<ShiftSummary>(
    `/cash-register/shifts/${shiftId}/summary`
  );
  return data;
};

// ============================================================
// 📌 CANCELAR TURNO
// ============================================================
export const cancelShift = async (
  shiftId: number
): Promise<CashRegisterShift> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.delete<CashRegisterShift>(
    `/cash-register/shifts/${shiftId}`
  );
  return data;
};

