import { getAxiosClient } from "./axiosClient";
import type { Product, ProductPresentation } from "../types/index";

export interface Container {
  id: number;
  name: string;
  quantity: number;
  importAmount: number;
  productId?: number;
  product?: Product;
  presentationId?: number;
  presentation?: ProductPresentation;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateContainerInput {
  name: string;
  quantity: number;
  importAmount: number;
  productId?: number;
  presentationId?: number;
  notes?: string;
  isActive?: boolean;
}

export interface UpdateContainerInput extends Partial<CreateContainerInput> {}

export const getContainers = async (params?: {
  isActive?: boolean;
  productId?: number;
  presentationId?: number;
}): Promise<Container[]> => {
  const query = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        query.append(key, value.toString());
      }
    });
  }
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<Container[]>(`/containers?${query.toString()}`);
  return data;
};

export const getContainerById = async (id: number): Promise<Container> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<Container>(`/containers/${id}`);
  return data;
};

export const createContainer = async (input: CreateContainerInput): Promise<Container> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.post<Container>("/containers", input);
  return data;
};

export const updateContainer = async (id: number, input: UpdateContainerInput): Promise<Container> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.put<Container>(`/containers/${id}`, input);
  return data;
};

export const deleteContainer = async (id: number): Promise<void> => {
  const clientAxios = await getAxiosClient();
  await clientAxios.delete(`/containers/${id}`);
};

export const getProductsForSelector = async (): Promise<Product[]> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<Product[]>("/containers/products");
  return data;
};

