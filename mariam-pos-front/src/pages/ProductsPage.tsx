import React from 'react';
import Header from '../components/Header';
import Card from '../components/Card';

interface ProductsPageProps {
  onBack: () => void;
  onNewProduct: () => void;
  onViewCatalog: () => void;
  onCategories: () => void;
}

const ProductsPage: React.FC<ProductsPageProps> = ({
  onBack,
  onViewCatalog,
  onCategories,
}) => {
  return (
    <div className="app">
      <div className="main-container">
        <Header
          title="Gestión de Productos"
          onBack={onBack}
          backText="← Volver al Punto de Venta"
          className="products-header"
        />
        <div className="products-content">
          <div className="products-options">
            <h2>¿Qué deseas hacer?</h2>
            <p>Selecciona una opción para continuar</p>
            
            <div className="products-actions">
             {/* <Card
                className="product-action-button"
                onClick={onNewProduct}
                hoverable
              >
                <div className="button-icon">➕</div>
                <div className="button-content">
                  <h2>Nuevo Producto</h2>
                  <p>Agregar un nuevo producto al inventario</p>
                </div>
              </Card>*/}
              
              <Card
                className="product-action-button"
                onClick={onViewCatalog}
                hoverable
              >
                <div className="button-icon">📋</div>
                <div className="button-content">
                  <h2>Productos</h2>
                  <p>Consultar todos los productos disponibles</p>
                </div>
              </Card>
              <Card
                className="product-action-button"
                onClick={onCategories}
                hoverable
              >
                <div className="button-icon">📂</div>
                <div className="button-content">
                  <h2>Categorías</h2>
                  <p>Gestionar categorías</p>
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
