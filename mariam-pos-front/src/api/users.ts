import { getAxiosClient } from "./axiosClient";
import type { User } from "../types/index";

// Obtener todos los usuarios
export const getUsers = async (): Promise<User[]> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<User[]>("/users");
  return data;
};

// Obtener un usuario por ID
export const getUserById = async (id: string): Promise<User> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<User>(`/users/${id}`);
  return data;
};

// Crear un nuevo usuario
export const createUser = async (user: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> => {
  const clientAxios = await getAxiosClient();
  try {
    const { data } = await clientAxios.post<User>("/users", user);
    return data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || "Error al crear usuario");
  }
};

// Actualizar un usuario
export const updateUser = async (
  id: string,
  user: Partial<Omit<User, "id" | "createdAt" | "updatedAt">>
): Promise<User> => {
  const clientAxios = await getAxiosClient();
  try {
    const { data } = await clientAxios.put<User>(`/users/${id}`, user);
    return data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || "Error al actualizar usuario");
  }
};

// Eliminar un usuario
export const deleteUser = async (id: string): Promise<void> => {
  const clientAxios = await getAxiosClient();
  try {
    await clientAxios.delete(`/users/${id}`);
  } catch (error: any) {
    throw new Error(error.response?.data?.error || "Error al eliminar usuario");
  }
};

// Cambiar estado de usuario (activar/inactivar)
export const toggleUserStatus = async (id: string): Promise<User> => {
  const clientAxios = await getAxiosClient();
  try {
    const { data } = await clientAxios.patch<User>(`/users/${id}/toggle-status`);
    return data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || "Error al cambiar estado del usuario");
  }
};

