// Tipos principales de la aplicación

export type ViewType = 'main' | 'help' | 'pos' | 'products' | 'new-product' | 'catalog' | 'categories' | 'sales' |'client' | 'report' | 'inventory' | 'users';

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
  name: string;
  alias?: string;
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
   paymentType: string; // "efectivo" | "tarjeta" | "mixto"
   amountReceived: number; // Total recibido (para efectivo) o total (para tarjeta/mixto)
   change: number; // Cambio (solo aplica a efectivo)
   cashAmount?: number; // Monto en efectivo (solo para mixto)
   cardAmount?: number; // Monto en tarjeta (solo para mixto)
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

// ============================================================
// 💰 MÓDULO DE CORTE DE CAJA
// ============================================================

// Estados de un turno de caja
export type ShiftStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';

// Representa un turno/corte de caja
export interface CashRegisterShift {
  id: number;
  shiftNumber: string; // Folio único del turno
  branch: string; // Sucursal
  cashRegister: string; // Caja (ej: "Caja 1")
  cashierName?: string; // Nombre del cajero
  
  // Fechas del turno
  startTime: Date;
  endTime?: Date;
  
  // Fondos
  initialCash: number; // Fondo inicial
  finalCash?: number; // Efectivo contado al cerrar
  expectedCash?: number; // Efectivo esperado (calculado)
  difference?: number; // Diferencia (finalCash - expectedCash)
  
  // Totales por método de pago
  totalCash: number; // Total en efectivo
  totalCard: number; // Total en tarjeta
  totalTransfer: number; // Total en transferencia
  totalOther: number; // Otros métodos
  
  // Estado
  status: ShiftStatus;
  
  // Observaciones
  notes?: string;
  
  // Relación con ventas
  sales?: Sale[];
  
  createdAt: Date;
  updatedAt: Date;
}

// DTO para abrir un turno
export interface OpenShiftInput {
  branch: string;
  cashRegister: string;
  cashierName?: string;
  initialCash: number;
}

// DTO para cerrar un turno
export interface CloseShiftInput {
  finalCash: number;
  notes?: string;
}

// Resumen de un turno
export interface ShiftSummary {
  shift: {
    id: number;
    shiftNumber: string;
    branch: string;
    cashRegister: string;
    cashierName?: string;
    startTime: Date;
    endTime?: Date;
    status: ShiftStatus;
    initialCash: number;
    finalCash?: number;
    expectedCash?: number;
    difference?: number;
    notes?: string;
  };
  totals: {
    totalCash: number;
    totalCard: number;
    totalTransfer: number;
    totalOther: number;
  };
  statistics: {
    totalSales: number;
    totalAmount: number;
    averageTicket: number;
  };
  paymentMethods: Record<string, {
    count: number;
    total: number;
  }>;
  cashMovements?: CashMovement[];
  cashMovementsSummary?: {
    totalEntradas: number;
    totalSalidas: number;
    neto: number;
  };
}

// ============================================================
// 💵 MÓDULO DE MOVIMIENTOS DE EFECTIVO
// ============================================================

// Tipos de movimiento de efectivo
export type CashMovementType = 'ENTRADA' | 'SALIDA';

// Representa un movimiento de efectivo (entrada o salida)
export interface CashMovement {
  id: number;
  shiftId: number;
  type: CashMovementType;
  amount: number;
  reason?: string;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
}

// ============================================================
// 👤 MÓDULO DE USUARIOS/CAJEROS
// ============================================================

export type UserRole = "ADMIN" | "MANAGER" | "CASHIER" | "SUPERVISOR";
export type UserStatus = "ACTIVE" | "INACTIVE";

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  username?: string;
  role: UserRole;
  status: UserStatus;
  branch?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// DTO para crear un movimiento de efectivo
export interface CreateCashMovementInput {
  shiftId: number;
  type: CashMovementType;
  amount: number;
  reason?: string;
  notes?: string;
  createdBy?: string;
}

