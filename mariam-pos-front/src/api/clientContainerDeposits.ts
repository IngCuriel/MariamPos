import { getAxiosClient } from "./axiosClient";

export interface ClientContainerDeposit {
  id: number;
  clientId: string;
  saleId?: number;
  containerName: string;
  quantity: number;
  importAmount: number;
  unitPrice: number;
  status: "PENDING" | "RETURNED";
  shiftId?: number;
  cashMovementId?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  returnedAt?: Date;
  client?: {
    id: string;
    name: string;
    alias?: string;
    phone?: string;
  };
  shift?: {
    id: number;
    shiftNumber: string;
    branch: string;
    cashRegister: string;
    cashierName?: string;
    startTime: Date;
  };
}

export interface CreateClientContainerDepositInput {
  clientId: string;
  saleId?: number;
  containerName: string;
  quantity: number;
  importAmount: number;
  unitPrice: number;
  shiftId?: number;
  cashMovementId?: number;
  notes?: string;
}

export interface ClientContainerDepositsResponse {
  deposits: ClientContainerDeposit[];
  summary: Array<{
    containerName: string;
    unitPrice: number;
    totalQuantity: number;
    totalAmount: number;
    deposits: ClientContainerDeposit[];
  }>;
  totalContainers: number;
  totalAmount: number;
}

export const createClientContainerDeposit = async (
  input: CreateClientContainerDepositInput
): Promise<ClientContainerDeposit> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.post<ClientContainerDeposit>(
    "/client-container-deposits",
    input
  );
  return data;
};

export const getClientPendingDeposits = async (
  clientId: string
): Promise<ClientContainerDepositsResponse> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<ClientContainerDepositsResponse>(
    `/client-container-deposits/client/${clientId}/pending`
  );
  return data;
};

export const returnClientContainerDeposit = async (
  depositId: number,
  quantity?: number
): Promise<ClientContainerDeposit> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.post<ClientContainerDeposit>(
    `/client-container-deposits/${depositId}/return`,
    { quantity }
  );
  return data;
};

export const returnAllClientContainerDeposits = async (
  clientId: string
): Promise<{ message: string; count: number }> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.post<{ message: string; count: number }>(
    `/client-container-deposits/client/${clientId}/return-all`
  );
  return data;
};

// Obtener todos los depósitos pendientes de todos los clientes
export const getAllPendingContainerDeposits = async (): Promise<ClientContainerDeposit[]> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.get<ClientContainerDeposit[]>(
    "/client-container-deposits?status=PENDING"
  );
  return data;
};

