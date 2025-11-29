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

export interface ScanRequest {
  colorMode: 'color' | 'bw';
  format?: 'jpg' | 'png' | 'pdf';
  scannerName?: string;
}

export const scanDocument = async (data: ScanRequest): Promise<Blob> => {
  try {
    const apiClient = await getAxiosClient();
    const response = await apiClient.post('/copies/scan', data, {
      timeout: 60000, // 60 segundos para escanear
      responseType: 'blob', // Importante: recibir como blob para la imagen
    });
    return response.data;
  } catch (error: any) {
    console.error('Error al escanear:', error);
    throw error;
  }
};

export interface CreatePdfFromImagesRequest {
  images: Blob[];
  format: 'jpg' | 'png';
}

export const createPdfFromImages = async (images: Blob[]): Promise<Blob> => {
  try {
    const formData = new FormData();
    images.forEach((image, index) => {
      formData.append('images', image, `page-${index}.jpg`);
    });

    const apiClient = await getAxiosClient();
    const response = await apiClient.post('/copies/create-pdf', formData, {
      timeout: 120000, // 120 segundos para crear PDF
      responseType: 'blob',
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error: any) {
    console.error('Error al crear PDF:', error);
    throw error;
  }
};

export interface CombineImagesRequest {
  images: Blob[];
  layout?: 'horizontal' | 'vertical';
}

export const combineImages = async (images: Blob[], layout: 'horizontal' | 'vertical' = 'horizontal'): Promise<Blob> => {
  try {
    if (images.length !== 2) {
      throw new Error('Se requieren exactamente 2 imágenes para combinar');
    }

    const formData = new FormData();
    images.forEach((image, index) => {
      formData.append('images', image, `side-${index}.jpg`);
    });
    formData.append('layout', layout);

    const apiClient = await getAxiosClient();
    const response = await apiClient.post('/copies/combine-images', formData, {
      timeout: 120000, // 120 segundos para combinar imágenes
      responseType: 'blob',
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error: any) {
    console.error('Error al combinar imágenes:', error);
    throw error;
  }
};

