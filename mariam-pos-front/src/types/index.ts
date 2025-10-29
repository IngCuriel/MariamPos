// Tipos principales de la aplicación

export type ViewType = 'main' | 'help' | 'pos' | 'products' | 'new-product' | 'catalog' | 'categories' | 'sales' |'client' | 'report';

export interface Product {
  id: number;
  code: string;
  name: string;
  status: number;
  saleType: string;
  price: number;
  cost: number;
  icon: string;
  description?: string;
  categoryId: string;
  category?: Category;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
}

export interface Client {
  id: string;
  name: string
}

// Representa una venta con su lista de detalles
export interface Sale {
  id: number;
  folio: string;
  total: number;
  status: string; //Pendiente, Pagado
  paymentMethod?: string; // Efectivo, Tarjeta, etc.
  createdAt: Date;
  branch:string, // sucursal
  cashRegister: string,  //Caja de cobro
  clientName?: string;
  details: SaleDetail[];
}

// Representa el detalle de una venta
export interface SaleDetail {
  id: number;
  quantity: number;
  price: number;
  productName: string;
  subTotal: number;
  saleId: number;
  productId: number;
  product: Product;
}

export interface ConfirmPaymentData {
   paymentType: string;
   amountReceived: number
   change: number;
}

