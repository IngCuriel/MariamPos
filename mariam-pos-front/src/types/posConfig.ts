export type POSModuleConfig = {
  id: string;
  title: string;
  icon: string;
  description: string;
  section: string;
  visible: boolean;
  order: number;
  onClick?: string; // Nombre de la función onClick
};

export type POSSectionConfig = {
  id: string;
  title: string;
  icon: string;
  description: string;
  visible: boolean;
  order: number;
  columns?: number; // Número de columnas en el grid
};

export type POSPageConfig = {
  sections: POSSectionConfig[];
  modules: POSModuleConfig[];
};

export const DEFAULT_POS_CONFIG: POSPageConfig = {
  sections: [
    {
      id: "operations",
      title: "Operaciones Principales",
      icon: "⚡",
      description: "Módulos esenciales para el día a día",
      visible: true,
      order: 1,
      columns: 3,
    },
    {
      id: "management",
      title: "Operaciones Secundarias",
      icon: "🧰",
      description: "Inventario, recargas y envases",
      visible: true,
      order: 2,
      columns: 3,
    },
    {
      id: "people",
      title: "Gestión",
      icon: "👥",
      description: "Administración de clientes y cajeros",
      visible: true,
      order: 3,
      columns: 3,
    },
    {
      id: "purchases",
      title: "Compras y Proveedores",
      icon: "🛒",
      description: "Compras, proveedores y cuentas por pagar",
      visible: true,
      order: 4,
      columns: 3,
    },
    {
      id: "stationery",
      title: "Papelería",
      icon: "📄",
      description: "Impresión, copias y ayuda del sistema",
      visible: true,
      order: 5,
      columns: 2,
    },
    {
      id: "reports",
      title: "Reportes y Análisis",
      icon: "📊",
      description: "Análisis de ventas, turnos y movimientos",
      visible: true,
      order: 6,
      columns: 3,
    },
  ],
  modules: [
    {
      id: "sales",
      title: "Venta",
      icon: "🛒",
      description: "Procesar ventas y cobros",
      section: "operations",
      visible: true,
      order: 1,
      onClick: "onSalesClick",
    },
    {
      id: "online-store",
      title: "Tienda Online",
      icon: "🌐",
      description: "Gestionar tienda en línea",
      section: "operations",
      visible: true,
      order: 2,
      onClick: "onOnlineStoreClick",
    },
    {
      id: "products",
      title: "Productos",
      icon: "🛍️",
      description: "Catálogo y gestión de productos",
      section: "operations",
      visible: true,
      order: 3,
      onClick: "onProductsClick",
    },
    {
      id: "inventory",
      title: "Inventario",
      icon: "📦",
      description: "Control de stock y existencias",
      section: "management",
      visible: true,
      order: 1,
      onClick: "onInventoryClick",
    },
    {
      id: "recharges",
      title: "Recargas y Pines",
      icon: "📱",
      description: "Venta de recargas, servicios y pines",
      section: "management",
      visible: true,
      order: 2,
      onClick: "onRechargesClick",
    },
    {
      id: "containers",
      title: "Envases",
      icon: "🍺",
      description: "Gestionar envases retornables",
      section: "management",
      visible: true,
      order: 3,
      onClick: "onContainersClick",
    },
    {
      id: "clients",
      title: "Clientes",
      icon: "👥",
      description: "Catálogo y gestión de clientes",
      section: "people",
      visible: true,
      order: 1,
      onClick: "onClientClick",
    },
    {
      id: "recover-containers",
      title: "Recuperar Envases",
      icon: "🍺",
      description: "Envases pendientes por recuperar, por fecha",
      section: "people",
      visible: true,
      order: 2,
      onClick: "onRecoverContainersClick",
    },
    {
      id: "receivables",
      title: "Créditos por Cobrar",
      icon: "💳",
      description: "Créditos generados y saldos por cobrar",
      section: "people",
      visible: true,
      order: 3,
      onClick: "onReceivablesClick",
    },
    {
      id: "suppliers",
      title: "Proveedores",
      icon: "🚚",
      description: "Catálogo y gestión de proveedores",
      section: "purchases",
      visible: true,
      order: 1,
      onClick: "onSuppliersClick",
    },
    {
      id: "purchases",
      title: "Compras",
      icon: "🧾",
      description: "Registrar y gestionar compras",
      section: "purchases",
      visible: true,
      order: 2,
      onClick: "onPurchasesClick",
    },
    {
      id: "account-payables",
      title: "Cuentas por Pagar",
      icon: "💸",
      description: "Gestionar pagos a proveedores",
      section: "purchases",
      visible: true,
      order: 3,
      onClick: "onAccountPayablesClick",
    },
    {
      id: "copies",
      title: "Copias",
      icon: "🖨️",
      description: "Imprimir documentos y copias",
      section: "stationery",
      visible: true,
      order: 1,
      onClick: "onCopiesClick",
    },
    {
      id: "help",
      title: "Ayuda",
      icon: "❓",
      description: "Información y soporte del sistema",
      section: "stationery",
      visible: true,
      order: 2,
      onClick: "onHelpClick",
    },
    {
      id: "reports",
      title: "Reportes",
      icon: "📊",
      description: "Estadísticas y análisis de ventas",
      section: "reports",
      visible: true,
      order: 1,
      onClick: "onReportClick",
    },
    {
      id: "shift-history",
      title: "Historial de Turnos",
      icon: "📋",
      description: "Ver cierres de caja y turnos",
      section: "reports",
      visible: true,
      order: 2,
      onClick: "onShiftHistoryClick",
    },
    {
      id: "cash-movements",
      title: "Movimientos de Efectivo",
      icon: "💰",
      description: "Entradas y salidas de efectivo",
      section: "reports",
      visible: true,
      order: 3,
      onClick: "onCashMovementsHistoryClick",
    },
  ],
};

