//import axiosClient from "./axiosClient";
import {getAxiosClient} from "./axiosClient";
import type { Client } from "../types/index";

export const getClients = async (search?: string): Promise<Client[]> => {
  const clientAxios = await getAxiosClient();
  const params = search ? { search } : {};
  const { data } = await clientAxios.get<Client[]>("/clients", { params });
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
 