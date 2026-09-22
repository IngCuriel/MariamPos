//import axiosClient from "./axiosClient";
import {getAxiosClient} from "./axiosClient";
import type { Client } from "../types/index";

export const getClients = async (search?: string): Promise<Client[]> => {
  const clientAxios = await getAxiosClient();
  const params = search ? { search } : {};
  const { data } = await clientAxios.get<Client[]>("/clients", { params });
  return data;
};

export interface ClientsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedClients {
  clients: Client[];
  pagination: ClientsPagination;
}

/** Lista de clientes paginada desde el servidor (10 por página por defecto). */
export const getClientsPaginated = async (
  page: number,
  limit = 10,
  search?: string
): Promise<PaginatedClients> => {
  const clientAxios = await getAxiosClient();
  const params: Record<string, string | number> = { page, limit };
  if (search && search.trim()) {
    params.search = search.trim();
  }
  const { data } = await clientAxios.get<PaginatedClients>("/clients", { params });
  return data;
};

export const getClientById = async (id: string): Promise<Client> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<Client>(`/clients/${id}`);
  return data;
};

export const createClient = async (client: Omit<Client, "id">): Promise<Client> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.post<Client>("/clients", client);
  return data;
};

export const updateClient = async (id: string, client: Partial<Omit<Client, "id">>): Promise<Client> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.put<Client>(`/clients/${id}`, client);
  return data;
};

export const deleteClient = async (id: string): Promise<void> => {
  const clientAxios = await getAxiosClient();
  await clientAxios.delete(`/clients/${id}`);
};
 