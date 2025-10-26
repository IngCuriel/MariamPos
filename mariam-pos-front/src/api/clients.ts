import axiosClient from "./axiosClient";
import type { Client } from "../types/index";

export const getClients = async (): Promise<Client[]> => {
  const { data } = await axiosClient.get<Client[]>("/clients");
  return data;
};

export const createClient = async (client: Omit<Client, "id">): Promise<Client> => {
  const { data } = await axiosClient.post<Client>("/clients", client);
  return data;
};
 