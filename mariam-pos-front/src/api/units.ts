import { getAxiosClient } from "./axiosClient";
import type { UnitOfMeasure, CreateUnitInput } from "../types/index";

// Listar unidades. activeOnly=true trae solo las activas.
export const getUnits = async (activeOnly = false): Promise<UnitOfMeasure[]> => {
  const client = await getAxiosClient();
  const { data } = await client.get<UnitOfMeasure[]>("/units", {
    params: activeOnly ? { activeOnly: "true" } : {},
  });
  return data;
};

export const createUnit = async (input: CreateUnitInput): Promise<UnitOfMeasure> => {
  const client = await getAxiosClient();
  const branch = localStorage.getItem("sucursal") || "Sucursal Default";
  const { data } = await client.post<UnitOfMeasure>("/units", { ...input, branch });
  return data;
};

export const updateUnit = async (
  id: number,
  input: Partial<CreateUnitInput>
): Promise<UnitOfMeasure> => {
  const client = await getAxiosClient();
  const { data } = await client.put<UnitOfMeasure>(`/units/${id}`, input);
  return data;
};

export const deleteUnit = async (id: number): Promise<{ message: string }> => {
  const client = await getAxiosClient();
  const { data } = await client.delete<{ message: string }>(`/units/${id}`);
  return data;
};
