import React from 'react';
import Header from '../components/Header';
import Card from '../components/Card';

interface POSPageProps {
  onBack: () => void;
  onProductsClick: () => void;
  onSalesClick: () => void;
  onClientClick:() => void;
  onReportClick:() => void;
}

const POSPage: React.FC<POSPageProps> = ({ onBack, onProductsClick, onSalesClick, onClientClick, onReportClick}) => {
  return (
    <div className="app">
      <div className="pos-container">
        <Header
          title="Punto de Venta"
          onBack={onBack}
          backText="← Volver al Menú Principal"
          className="pos-header"
        />
        <div className="pos-content">
          <div className="pos-placeholder">
            <h2>Módulo de Punto de Venta</h2>
            <p>Aquí se implementará la funcionalidad completa del POS</p>
            <div className="pos-features">
              <Card 
                variant="feature" 
                className="feature-card"
                onClick={onSalesClick}
                hoverable>
                <h3>🛒 Venta</h3>
                <p>Procesar ventas</p>
              </Card>
              <Card
                variant="feature"
                className="feature-card"
                onClick={onProductsClick}
                hoverable
              >
                <h3>🛍️ Productos</h3>
                <p>Ver catálogo de productos</p>
              </Card>
              {/*<Card variant="feature" className="feature-card">
                <h3>📦 Inventario</h3>
                <p>Gestionar productos</p>
              </Card>*/}
              <Card 
                  variant="feature" 
                  className="feature-card"
                  onClick={onClientClick}
                  hoverable
                >
                <h3>👥 Clientes</h3>
                <p>Gestionar clientes</p>
              </Card>
              <Card variant="feature" 
                    className="feature-card"
                    onClick={onReportClick}
                    hoverable>
                <h3>📊 Reportes</h3>
                <p>Ver estadísticas</p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POSPage;
