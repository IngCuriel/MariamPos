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
