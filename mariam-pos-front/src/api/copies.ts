import { getAxiosClient } from './axiosClient';

export interface PrintCopiesRequest {
  file: File;
  copies: number;
  colorMode: 'color' | 'bw';
  printerName: string;
}

export const printCopies = async (formData: FormData): Promise<void> => {
  try {
    const apiClient = await getAxiosClient();
    const response = await apiClient.post('/copies/print', formData, {
      timeout: 60000, // 60 segundos de timeout para archivos grandes
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error: any) {
    console.error('Error al imprimir copias:', error);
    throw error;
  }
};

export const getAvailablePrinters = async (): Promise<string[]> => {
  try {
    const apiClient = await getAxiosClient();
    const response = await apiClient.get('/copies/printers');
    return response.data.printers || [];
  } catch (error: any) {
    console.error('Error al obtener impresoras:', error);
    throw error;
  }
};

export interface PhotocopyRequest {
  copies: number;
  colorMode: 'color' | 'bw';
  printerName: string;
  scannerName?: string;
}

export const photocopy = async (data: PhotocopyRequest): Promise<void> => {
  try {
    const apiClient = await getAxiosClient();
    const response = await apiClient.post('/copies/photocopy', data, {
      timeout: 120000, // 120 segundos para escanear + imprimir
    });
    return response.data;
  } catch (error: any) {
    console.error('Error al fotocopiar:', error);
    throw error;
  }
};

