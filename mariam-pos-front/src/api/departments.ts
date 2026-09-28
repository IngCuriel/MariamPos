import { getAxiosClient } from "./axiosClient";
import type { Department, CreateDepartmentInput, Category } from "../types/index";

// Listar departamentos. activeOnly=true trae solo los activos.
export const getDepartments = async (
  activeOnly = false
): Promise<Department[]> => {
  const client = await getAxiosClient();
  const { data } = await client.get<Department[]>("/departments", {
    params: activeOnly ? { activeOnly: "true" } : {},
  });
  return data;
};

export const createDepartment = async (
  input: CreateDepartmentInput
): Promise<Department> => {
  const client = await getAxiosClient();
  const branch = localStorage.getItem("sucursal") || "Sucursal Default";
  const { data } = await client.post<Department>("/departments", {
    ...input,
    branch,
  });
  return data;
};

export const updateDepartment = async (
  id: string,
  input: Partial<CreateDepartmentInput>
): Promise<Department> => {
  const client = await getAxiosClient();
  const { data } = await client.put<Department>(`/departments/${id}`, input);
  return data;
};

export const deleteDepartment = async (
  id: string
): Promise<{ message: string }> => {
  const client = await getAxiosClient();
  const { data } = await client.delete<{ message: string }>(
    `/departments/${id}`
  );
  return data;
};

// Categorías ligadas a un departamento.
export const getDepartmentCategories = async (
  departmentId: string
): Promise<Category[]> => {
  const client = await getAxiosClient();
  const { data } = await client.get<Category[]>(
    `/departments/${departmentId}/categories`
  );
  return data;
};

// Categorías sin departamento asignado.
export const getUnassignedCategories = async (): Promise<Category[]> => {
  const client = await getAxiosClient();
  const { data } = await client.get<Category[]>(
    `/departments/unassigned-categories`
  );
  return data;
};

// Asignar una categoría a un departamento.
export const assignCategoryToDepartment = async (
  departmentId: string,
  categoryId: string
): Promise<Category> => {
  const client = await getAxiosClient();
  const { data } = await client.post<Category>(
    `/departments/${departmentId}/assign-category/${categoryId}`
  );
  return data;
};

// Quitar una categoría de su departamento.
export const removeCategoryFromDepartment = async (
  categoryId: string
): Promise<Category> => {
  const client = await getAxiosClient();
  const { data } = await client.post<Category>(
    `/departments/remove-category/${categoryId}`
  );
  return data;
};
