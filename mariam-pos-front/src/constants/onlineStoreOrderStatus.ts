/**
 * Estados de pedido tienda online — alineados con mariam-pos-web-api / mariam-store-admin.
 */
export const ORDER_STATUS = {
  CREATED: 'CREATED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  PARTIALLY_AVAILABLE: 'PARTIALLY_AVAILABLE',
  AVAILABLE: 'AVAILABLE',
  IN_PREPARATION: 'IN_PREPARATION',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  IN_TRANSIT: 'IN_TRANSIT',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type OrderStatusCode = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const STATUS_LABELS: Record<string, string> = {
  [ORDER_STATUS.CREATED]: 'Creado',
  [ORDER_STATUS.UNDER_REVIEW]: 'En revisión',
  [ORDER_STATUS.PARTIALLY_AVAILABLE]: 'Parcialmente disponible',
  [ORDER_STATUS.AVAILABLE]: 'Disponible',
  [ORDER_STATUS.IN_PREPARATION]: 'En preparación',
  [ORDER_STATUS.READY_FOR_PICKUP]: 'Listo para recoger',
  [ORDER_STATUS.IN_TRANSIT]: 'En camino',
  [ORDER_STATUS.COMPLETED]: 'Entregado',
  [ORDER_STATUS.CANCELLED]: 'Cancelado',
};

export const STATUS_COLORS: Record<string, string> = {
  [ORDER_STATUS.CREATED]: '#95a5a6',
  [ORDER_STATUS.UNDER_REVIEW]: '#f39c12',
  [ORDER_STATUS.PARTIALLY_AVAILABLE]: '#e67e22',
  [ORDER_STATUS.AVAILABLE]: '#3498db',
  [ORDER_STATUS.IN_PREPARATION]: '#9b59b6',
  [ORDER_STATUS.READY_FOR_PICKUP]: '#2ecc71',
  [ORDER_STATUS.IN_TRANSIT]: '#1abc9c',
  [ORDER_STATUS.COMPLETED]: '#27ae60',
  [ORDER_STATUS.CANCELLED]: '#e74c3c',
};
