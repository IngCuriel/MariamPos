//import axiosClient from "./axiosClient";
import {getAxiosClient} from "./axiosClient";
import type { Client } from "../types/index";

export const getClients = async (): Promise<Client[]> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<Client[]>("/clients");
  return data;
};

export const createClient = async (client: Omit<Client, "id">): Promise<Client> => {
   const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.post<Client>("/clients", client);
  return data;
};
 