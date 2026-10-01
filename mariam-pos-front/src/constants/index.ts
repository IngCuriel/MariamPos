// Constantes de la aplicación

export const APP_CONFIG = {
  name: 'Mini Super / Papelería CURIEL',
  subtitle: 'Sistema de Gestión Comercial',
  version: '1.0.0',
  author: 'Mariam POS',
} as const;

export const ROUTES = {
  MAIN: 'main',
  HELP: 'help',
  POS: 'pos',
  PRODUCTS: 'products',
} as const;

export const COLORS = {
  primary: '#667eea',
  secondary: '#764ba2',
  success: '#43e97b',
  info: '#4facfe',
  warning: '#ff6b6b',
  text: {
    primary: '#2d3748',
    secondary: '#718096',
  },
} as const;

export const BREAKPOINTS = {
  mobile: '480px',
  tablet: '768px',
  desktop: '1024px',
} as const;

// ============================================================
// 🔄 CANCELACIONES Y DEVOLUCIONES
// ============================================================

// Motivos sugeridos de cancelación (Req 3.3). Se muestran como botones de un clic.
export const CANCEL_REASONS = [
  'Error de captura',
  'Producto equivocado',
  'Cliente se arrepintió',
  'Cobro duplicado',
  'Precio incorrecto',
  'Prueba / capacitación',
] as const;

// Motivos sugeridos de devolución (Req 3.4). Se muestran como botones de un clic.
export const RETURN_REASONS = [
  'Producto caducado',
  'Producto defectuoso / dañado',
  'Producto equivocado',
  'Cliente insatisfecho',
  'No era lo que esperaba',
] as const;

// Motivos clasificados como merma (Req 3.5): el producto no regresa a existencias.
export const MERMA_REASONS = [
  'Producto caducado',
  'Producto defectuoso / dañado',
] as const;
