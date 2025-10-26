# Estructura del Proyecto Mariam POS

## 📁 Organización de Carpetas

```
src/
├── components/          # Componentes reutilizables
│   ├── Button.tsx      # Componente de botón
│   ├── Card.tsx        # Componente de tarjeta
│   └── Header.tsx      # Componente de encabezado
├── pages/              # Páginas de la aplicación
│   ├── HomePage.tsx    # Página principal
│   ├── HelpPage.tsx    # Página de ayuda
│   ├── POSPage.tsx     # Página de punto de venta
│   └── ProductsPage.tsx # Página de gestión de productos
├── hooks/              # Hooks personalizados
│   └── useNavigation.ts # Hook para navegación
├── types/              # Definiciones de tipos TypeScript
│   └── index.ts        # Tipos principales
├── constants/          # Constantes de la aplicación
│   └── index.ts        # Configuraciones y constantes
├── styles/             # Estilos CSS organizados
│   ├── globals.css     # Estilos globales
│   ├── components.css  # Estilos de componentes
│   ├── pages.css       # Estilos de páginas
│   ├── responsive.css  # Estilos responsivos
│   └── index.css       # Archivo principal de estilos
├── utils/              # Utilidades y helpers
└── assets/             # Recursos estáticos
```

## 🎯 Beneficios de la Nueva Estructura

### **Separación de Responsabilidades**
- **Componentes**: Reutilizables y modulares
- **Páginas**: Lógica específica de cada vista
- **Hooks**: Lógica de estado reutilizable
- **Tipos**: Definiciones TypeScript centralizadas
- **Estilos**: Organizados por funcionalidad

### **Mantenibilidad**
- Fácil localización de código
- Componentes independientes
- Estilos modulares
- Tipos bien definidos

### **Escalabilidad**
- Fácil agregar nuevas páginas
- Componentes reutilizables
- Estructura preparada para crecimiento

## 🔧 Componentes Principales

### **Button**
Componente reutilizable con variantes y tamaños:
```tsx
<Button variant="primary" size="large" onClick={handleClick}>
  Texto del botón
</Button>
```

### **Card**
Componente de tarjeta con variantes:
```tsx
<Card variant="feature" hoverable onClick={handleClick}>
  Contenido de la tarjeta
</Card>
```

### **Header**
Encabezado con botón de regreso:
```tsx
<Header title="Título" onBack={handleBack} />
```

## 🎨 Sistema de Estilos

### **Organización**
- `globals.css`: Reset, variables CSS, estilos base
- `components.css`: Estilos de componentes reutilizables
- `pages.css`: Estilos específicos de páginas
- `responsive.css`: Media queries y diseño responsivo

### **Variables CSS**
```css
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --success-color: #43e97b;
  --text-primary: #2d3748;
  --text-secondary: #718096;
}
```

## 🚀 Hooks Personalizados

### **useNavigation**
Maneja el estado de navegación de la aplicación:
```tsx
const { currentView, goToMain, goToHelp, goToPOS, goToProducts } = useNavigation();
```

## 📝 Tipos TypeScript

### **Tipos Principales**
- `ViewType`: Tipos de vista de la aplicación
- `Product`: Estructura de productos
- `CartItem`: Elementos del carrito
- `User`: Información de usuario
- `Sale`: Datos de venta

## 🔄 Flujo de Navegación

1. **HomePage** → Página principal con opciones
2. **HelpPage** → Información y soporte
3. **POSPage** → Módulo de punto de venta
4. **ProductsPage** → Gestión de productos

## 📱 Responsive Design

- **Desktop**: Layout completo con todas las funcionalidades
- **Tablet**: Adaptación de grid y espaciado
- **Mobile**: Layout de una columna optimizado para táctil
