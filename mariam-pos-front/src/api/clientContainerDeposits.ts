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
  createdBy?: string; // Cajero que dio el envase
  returnedBy?: string; // Cajero que regresó el importe
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
  createdBy?: string; // Cajero que da el envase
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
  quantity?: number,
  returnedBy?: string
): Promise<ClientContainerDeposit> => {
  const clientAxios = await getAxiosClient();
  const { data } = await clientAxios.post<ClientContainerDeposit>(
    `/client-container-deposits/${depositId}/return`,
    { quantity, returnedBy }
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

// Obtener los depósitos de envases generados en un rango de fechas (por createdAt)
export const getContainerDepositsByDateRange = async (
  startDate: string,
  endDate: string
): Promise<ClientContainerDeposit[]> => {
  const clientAxios = await getAxiosClient();
  const params = new URLSearchParams({ startDate, endDate });
  const { data } = await clientAxios.get<ClientContainerDeposit[]>(
    `/client-container-deposits?${params.toString()}`
  );
  return data;
};


// Depósitos PENDIENTES (por recuperar) en un rango de fechas.
export const getPendingContainerDepositsByDateRange = async (
  startDate: string,
  endDate: string
): Promise<ClientContainerDeposit[]> => {
  const clientAxios = await getAxiosClient();
  const params = new URLSearchParams({ startDate, endDate, status: "PENDING" });
  const { data } = await clientAxios.get<ClientContainerDeposit[]>(
    `/client-container-deposits?${params.toString()}`
  );
  return data;
};

// Depósitos por rango de fecha y estado opcional (PENDING | RETURNED | todos).
export const getContainerDepositsFiltered = async (
  startDate: string,
  endDate: string,
  status?: "PENDING" | "RETURNED"
): Promise<ClientContainerDeposit[]> => {
  const clientAxios = await getAxiosClient();
  const params = new URLSearchParams({ startDate, endDate });
  if (status) params.set("status", status);
  const { data } = await clientAxios.get<ClientContainerDeposit[]>(
    `/client-container-deposits?${params.toString()}`
  );
  return data;
};
