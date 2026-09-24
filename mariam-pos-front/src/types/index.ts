// Tipos principales de la aplicación

export type ViewType = 'main' | 'help' | 'pos' | 'products' | 'catalog' | 'categories' | 'sales' |'client' | 'report' | 'inventory' | 'users' | 'shift-history' | 'cash-movements-history' | 'copies' | 'containers' | 'kit' | 'suppliers' | 'purchases' | 'account-payables';

// Representa una presentación de un producto (ej: 1 pieza, 1 cono, 1 six)
export interface ProductPresentation {
  id?: number; // ID opcional para presentaciones existentes
  name: string; // Nombre de la presentación (ej: "Pieza", "Cono", "Six")
  quantity: number; // Cantidad de unidades en esta presentación (ej: 1, 30, 6)
  unitPrice: number; // Precio unitario en esta presentación
  isDefault?: boolean; // Indica si es la presentación por defecto (1 pieza)
}

// 🆕 NUEVO: Item de un kit
export interface KitItem {
  id?: number;
  kitId?: number;
  productId: number;
  product?: Product;
  presentationId?: number;
  presentation?: ProductPresentation;
  quantity: number;
  displayOrder?: number;
}

export interface Product {
  id: number;
  code: string | null; // Opcional para permitir códigos generados automáticamente
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
  isKit?: boolean; // 🆕 NUEVO: Si es un kit/combo
  kitItems?: KitItem[]; // 🆕 NUEVO: Items del kit (solo si isKit = true)
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
  phone?: string; // Número de celular/teléfono
  allowCredit?: boolean; // Si el cliente puede comprar a crédito
  creditLimit?: number;  // Límite de crédito permitido
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
  createdBy?: string; // Cajero que registró la venta
  amountReceived?: number; // Monto recibido en efectivo
  paymentReference?: string; // Folio/referencia del comprobante (tarjeta)
  shiftId?: number; // Turno de caja en el que se registró la venta
  details: SaleDetail[];
  shift?: {
    id: number;
    shiftNumber: string;
  };
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
   paymentType: string; // "efectivo" | "tarjeta" | "mixto" | "regalo"
   amountReceived: number; // Total recibido (para efectivo) o total (para tarjeta/mixto)
   change: number; // Cambio (solo aplica a efectivo)
   cashAmount?: number; // Monto en efectivo (solo para mixto)
   cardAmount?: number; // Monto en tarjeta (solo para mixto)
   paymentReference?: string; // Folio/referencia del comprobante (tarjeta/mixto)
   creditAmount?: number; // Monto a crédito (si hay faltante y se permite crédito)
   containersDepositInfo?: {
     total: number;
     count: number;
     details: Array<{ name: string; quantity: number; amount: number }>;
   } | null;
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
  cashRegister?: string; // Caja
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
  cashRegister?: string;
}

// DTO para actualizar stock directamente
export interface UpdateStockInput {
  productId: number;
  newStock: number;
  reason?: string;
  notes?: string;
  branch?: string;
  cashRegister?: string;
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
  sales?: Array<{
    id: number;
    folio?: string;
    total: number;
    paymentMethod?: string;
    clientName?: string;
    createdAt: Date;
    status?: string;
  }>;
  cashMovements?: CashMovement[];
  cashMovementsSummary?: {
    totalEntradas: number;
    totalSalidas: number;
    neto: number;
  };
  creditsInfo?: {
    totalCreditsGenerated: number;
    totalCreditPaymentsCash: number;
    totalCreditPaymentsCard: number;
    totalCreditPaymentsOther: number;
    creditsCount: number;
    paymentsCount: number;
    credits?: ClientCredit[];
    payments?: CreditPayment[];
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

// ============================================================
// 💳 MÓDULO DE CRÉDITOS
// ============================================================

// Estados de crédito
export type CreditStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID';

// Representa un crédito pendiente de un cliente
export interface ClientCredit {
  id: number;
  clientId: string;
  client?: Client;
  saleId: number;
  sale?: Sale;
  originalAmount: number; // Monto original del crédito
  remainingAmount: number; // Monto pendiente por pagar
  paidAmount: number; // Monto total pagado hasta ahora
  status: CreditStatus;
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;
  notes?: string;
  createdBy?: string; // Cajero que registró el crédito
  payments?: CreditPayment[];
}

// Representa un abono/pago a un crédito
export interface CreditPayment {
  id: number;
  creditId: number;
  credit?: ClientCredit;
  amount: number;
  paymentMethod?: string;
  notes?: string;
  createdBy?: string;
  shiftId?: number; // Turno de caja en el que se recibió el abono
  createdAt: Date;
}

// DTO para crear un crédito
export interface CreateCreditInput {
  clientId: string;
  saleId: number;
  amount: number;
  notes?: string;
  createdBy?: string; // Cajero que registra el crédito
}

// DTO para registrar un abono
export interface CreateCreditPaymentInput {
  creditId: number;
  amount: number;
  paymentMethod?: string;
  notes?: string;
  createdBy?: string;
  // Sucursal y caja donde se cobra el abono. El backend resuelve el turno
  // activo con estos datos para asociar el abono al corte correcto.
  branch?: string;
  cashRegister?: string;
}

// ============================================================
// 🛒 MÓDULO DE COMPRAS Y PROVEEDORES
// ============================================================

export interface Supplier {
  id: number;
  name: string;
  code?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  rfc?: string | null;
  taxId?: string | null;
  notes?: string | null;
  status: number; // 1 = activo, 0 = inactivo
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    purchases?: number;
    accountsPayable?: number;
  };
}

export interface PurchaseDetail {
  id: number;
  purchaseId: number;
  productId: number;
  product?: Product;
  quantity: number;
  unitCost: number;
  subtotal: number;
  discount: number;
  createdAt: Date;
}

export interface Purchase {
  id: number;
  folio: string;
  supplierId: number;
  supplier?: Supplier;
  purchaseDate: Date;
  dueDate?: Date | null;
  total: number;
  subtotal: number;
  tax: number;
  discount: number;
  paymentStatus: string; // PENDING, PARTIAL, PAID
  paymentMethod?: string | null;
  paidAmount?: number;
  balance?: number;
  paidPercentage?: number;
  pendingPercentage?: number;
  invoiceNumber?: string | null;
  notes?: string | null;
  branch?: string | null;
  cashRegister?: string | null;
  details: PurchaseDetail[];
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    payments?: number;
  };
}

export interface AccountPayable {
  id: number;
  purchaseId?: number | null;
  purchase?: Purchase | null;
  supplierId: number;
  supplier?: Supplier;
  amount: number;
  paidAmount: number;
  balance: number;
  dueDate: Date;
  paymentDate?: Date | null;
  status: string; // PENDING, PARTIAL, PAID, OVERDUE
  paymentMethod?: string | null;
  notes?: string | null;
  reference?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePurchaseInput {
  supplierId: number;
  purchaseDate?: string;
  dueDate?: string;
  subtotal: number;
  tax?: number;
  discount?: number;
  total: number;
  paymentMethod?: string;
  paymentStatus?: string;
  paidAmount?: number;
  balance?: number;
  paidPercentage?: number;
  pendingPercentage?: number;
  invoiceNumber?: string;
  notes?: string;
  branch?: string;
  cashRegister?: string;
  details: Array<{
    productId: number;
    quantity: number;
    unitCost: number;
    subtotal: number;
    discount?: number;
  }>;
  updateInventory?: boolean;
}

export interface CreateAccountPayableInput {
  purchaseId?: number;
  supplierId: number;
  amount: number;
  dueDate: string;
  paymentMethod?: string;
  notes?: string;
  reference?: string;
}

export interface RegisterPaymentInput {
  paymentAmount: number;
  paymentMethod?: string;
  paymentDate?: string;
  notes?: string;
  reference?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AccountPayablesSummary {
  total: {
    amount: number;
    paidAmount: number;
    balance: number;
    count: number;
  };
  pending: {
    balance: number;
    count: number;
  };
  partial: {
    balance: number;
    count: number;
  };
  paid: {
    amount: number;
    count: number;
  };
  overdue: {
    balance: number;
    count: number;
  };
}

// ============================================================
// ⚡ ELECTRON API TYPES
// ============================================================

declare global {
  interface Window {
    electronAPI?: {
      openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
      isElectron: boolean;
      onCheckOpenShifts?: (callback: () => void) => void;
      respondOpenShifts?: (hasShifts: boolean) => void;
      onShowShiftReminderOnClose?: (callback: () => void) => void;
      notifyAppClose?: (shouldClose: boolean) => void;
    };
  }
}

