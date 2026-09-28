import { getAxiosClient } from "./axiosClient";
import type {
  CategoryCodePrefix,
  CreateCodePrefixInput,
  CodePreview,
} from "../types/index";

// Listar todos los prefijos de código.
export const getCodePrefixes = async (): Promise<CategoryCodePrefix[]> => {
  const client = await getAxiosClient();
  const { data } = await client.get<CategoryCodePrefix[]>("/code-prefixes");
  return data;
};

// Obtener el prefijo de una categoría (o null si no tiene).
export const getPrefixByCategory = async (
  categoryId: string
): Promise<CategoryCodePrefix | null> => {
  const client = await getAxiosClient();
  const { data } = await client.get<CategoryCodePrefix | null>(
    `/code-prefixes/category/${categoryId}`
  );
  return data;
};

// Preview del siguiente código SIN reservar el consecutivo.
export const previewNextCode = async (
  categoryId: string
): Promise<CodePreview> => {
  const client = await getAxiosClient();
  const { data } = await client.get<CodePreview>(
    `/code-prefixes/category/${categoryId}/preview`
  );
  return data;
};

// Sugerir un prefijo desde el departamento + categoría.
export const suggestPrefix = async (
  categoryId: string
): Promise<{ suggested: string }> => {
  const client = await getAxiosClient();
  const { data } = await client.get<{ suggested: string }>(
    `/code-prefixes/category/${categoryId}/suggest`
  );
  return data;
};

// Crear un prefijo para una categoría.
export const createCodePrefix = async (
  input: CreateCodePrefixInput
): Promise<CategoryCodePrefix> => {
  const client = await getAxiosClient();
  const branch = localStorage.getItem("sucursal") || "Sucursal Default";
  const { data } = await client.post<CategoryCodePrefix>("/code-prefixes", {
    ...input,
    branch,
  });
  return data;
};

// Actualizar un prefijo.
export const updateCodePrefix = async (
  id: number,
  input: Partial<CreateCodePrefixInput>
): Promise<CategoryCodePrefix> => {
  const client = await getAxiosClient();
  const { data } = await client.put<CategoryCodePrefix>(
    `/code-prefixes/${id}`,
    input
  );
  return data;
};

// Eliminar un prefijo.
export const deleteCodePrefix = async (
  id: number
): Promise<{ message: string }> => {
  const client = await getAxiosClient();
  const { data } = await client.delete<{ message: string }>(
    `/code-prefixes/${id}`
  );
  return data;
};
