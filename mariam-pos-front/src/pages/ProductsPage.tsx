import React from 'react';
import Header from '../components/Header';
import Card from '../components/Card';
import '../styles/pages/products/productsPage.css';

interface ProductsPageProps {
  onBack: () => void;
  onNewProduct: () => void;
  onViewCatalog: () => void;
  onCategories: () => void;
}

const ProductsPage: React.FC<ProductsPageProps> = ({
  onBack,
  onNewProduct,
  onViewCatalog,
  onCategories,
}) => {
  return (
    <div className="products-page">
      <div className="products-page-container">
        <Header
          title="🛍️ Gestión de Productos"
          onBack={onBack}
          backText="← Volver al Punto de Venta"
          className="products-page-header"
        />
        
        <div className="products-page-content">
          {/* Sección: Operaciones Principales */}
          <div className="products-section">
            <div className="products-section-header">
              <h2 className="products-section-title">
                <span className="section-icon">⚡</span>
                Operaciones Principales
              </h2>
              <p className="products-section-description">
                Gestiona tu inventario y catálogo de productos
              </p>
            </div>
            <div className="products-modules-grid">
              <Card 
                variant="feature" 
                className="products-module-card primary"
                onClick={onViewCatalog}
                hoverable
              >
                <div className="products-module-icon">📋</div>
                <h3 className="products-module-title">Catálogo de Productos</h3>
                <p className="products-module-description">
                  Ver, buscar y editar todos tus productos
                </p>
                <div className="products-module-features">
                  <span className="feature-badge">Ver productos</span>
                  <span className="feature-badge">Editar</span>
                  <span className="feature-badge">Buscar</span>
                </div>
              </Card>
              
              <Card
                variant="feature"
                className="products-module-card success"
                onClick={onNewProduct}
                hoverable
              >
                <div className="products-module-icon">➕</div>
                <h3 className="products-module-title">Nuevo Producto</h3>
                <p className="products-module-description">
                  Agregar un nuevo producto al inventario
                </p>
                <div className="products-module-features">
                  <span className="feature-badge">Crear</span>
                  <span className="feature-badge">Configurar</span>
                </div>
              </Card>
            </div>
          </div>

          {/* Sección: Configuración */}
          <div className="products-section">
            <div className="products-section-header">
              <h2 className="products-section-title">
                <span className="section-icon">⚙️</span>
                Configuración
              </h2>
              <p className="products-section-description">
                Organiza y estructura tu catálogo
              </p>
            </div>
            <div className="products-modules-grid">
              <Card 
                variant="feature" 
                className="products-module-card info"
                onClick={onCategories}
                hoverable
              >
                <div className="products-module-icon">📂</div>
                <h3 className="products-module-title">Categorías</h3>
                <p className="products-module-description">
                  Gestionar categorías y departamentos
                </p>
                <div className="products-module-features">
                  <span className="feature-badge">Organizar</span>
                  <span className="feature-badge">Crear</span>
                  <span className="feature-badge">Editar</span>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductsPage;
