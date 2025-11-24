// Tipos principales de la aplicación

export type ViewType = 'main' | 'help' | 'pos' | 'products' | 'new-product' | 'catalog' | 'categories' | 'sales' |'client' | 'report' | 'inventory';

// Representa una presentación de un producto (ej: 1 pieza, 1 cono, 1 six)
export interface ProductPresentation {
  id?: number; // ID opcional para presentaciones existentes
  name: string; // Nombre de la presentación (ej: "Pieza", "Cono", "Six")
  quantity: number; // Cantidad de unidades en esta presentación (ej: 1, 30, 6)
  unitPrice: number; // Precio unitario en esta presentación
  isDefault?: boolean; // Indica si es la presentación por defecto (1 pieza)
}

export interface Product {
  id: number;
  code: string;
  name: string;
  status: number;
  saleType: string;
  price: number; // Precio base (compatibilidad hacia atrás)
  cost: number;
  icon: string;
  description?: string;
  categoryId: string;
  category?: Category;
  presentations?: ProductPresentation[]; // Presentaciones opcionales para compatibilidad
  trackInventory?: boolean; // Si el producto maneja inventario
  inventory?: Inventory; 
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  showInPOS?: boolean;
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

// ============================================================
// 🏭 MÓDULO DE INVENTARIO
// ============================================================

// Tipos de movimientos de inventario
export type InventoryMovementType = 
  | 'ENTRADA'      // Compra, recepción
  | 'SALIDA'       // Venta, consumo
  | 'AJUSTE'       // Ajuste manual (positivo o negativo)
  | 'TRANSFERENCIA'; // Transferencia entre sucursales

// Representa un movimiento de inventario
export interface InventoryMovement {
  id: number;
  productId: number;
  product?: Product;
  type: InventoryMovementType;
  quantity: number; // Cantidad positiva (se suma o resta según el tipo)
  reason?: string; // Motivo del movimiento
  reference?: string; // Referencia (factura, orden, etc.)
  notes?: string; // Notas adicionales
  createdAt: Date;
  createdBy?: string; // Usuario que realizó el movimiento
  branch?: string; // Sucursal
}

// Representa el inventario actual de un producto
export interface Inventory {
  id: number;
  productId: number;
  product?: Product;
  currentStock: number; // Stock actual
  minStock: number; // Stock mínimo
  maxStock?: number; // Stock máximo (opcional)
  lastMovementDate?: Date; // Fecha del último movimiento
  trackInventory: boolean; // Si se rastrea inventario
  branch?: string; // Sucursal
}

// DTO para crear un movimiento de inventario
export interface CreateInventoryMovementInput {
  productId: number;
  type: InventoryMovementType;
  quantity: number;
  reason?: string;
  reference?: string;
  notes?: string;
  branch?: string;
}

// DTO para actualizar stock directamente
export interface UpdateStockInput {
  productId: number;
  newStock: number;
  reason?: string;
  notes?: string;
}

