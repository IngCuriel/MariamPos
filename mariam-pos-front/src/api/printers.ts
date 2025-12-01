import { getAxiosClient } from "./axiosClient";

export interface Printer {
  id: number;
  name: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePrinterInput {
  name: string;
  isDefault?: boolean;
}

export interface UpdatePrinterInput {
  name?: string;
  isDefault?: boolean;
}

export const getPrinters = async (): Promise<Printer[]> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<Printer[]>("/printers");
  return data;
};

export const getPrinterById = async (id: number): Promise<Printer> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<Printer>(`/printers/${id}`);
  return data;
};

export const getDefaultPrinter = async (): Promise<Printer | null> => {
  try {
    const clientAxios = await getAxiosClient();
    const { data } = await clientAxios.get<Printer>("/printers/default");
    return data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

export const createPrinter = async (input: CreatePrinterInput): Promise<Printer> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.post<Printer>("/printers", input);
  return data;
};

export const updatePrinter = async (id: number, input: UpdatePrinterInput): Promise<Printer> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.put<Printer>(`/printers/${id}`, input);
  return data;
};

export const deletePrinter = async (id: number): Promise<void> => {
  const clientAxios = await getAxiosClient();
  await clientAxios.delete(`/printers/${id}`);
};

export const setDefaultPrinter = async (id: number): Promise<Printer> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.put<Printer>(`/printers/${id}/default`);
  return data;
};

