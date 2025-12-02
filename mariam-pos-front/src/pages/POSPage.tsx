import React from 'react';
import Header from '../components/Header';
import Card from '../components/Card';
import '../styles/pages/pos/posPage.css';

interface POSPageProps {
  onBack: () => void;
  onProductsClick: () => void;
  onSalesClick: () => void;
  onClientClick:() => void;
  onReportClick:() => void;
  onInventoryClick:() => void;
  onUsersClick?:() => void;
  onShiftHistoryClick?:() => void;
  onCashMovementsHistoryClick?:() => void;
  onCopiesClick?:() => void;
  onContainersClick?:() => void;
  onHelpClick?:() => void;
  onSuppliersClick?:() => void;
  onPurchasesClick?:() => void;
  onAccountPayablesClick?:() => void;
}

const POSPage: React.FC<POSPageProps> = ({ 
  onBack, 
  onProductsClick, 
  onSalesClick, 
  onClientClick, 
  onReportClick, 
  onInventoryClick, 
  onUsersClick, 
  onShiftHistoryClick, 
  onCashMovementsHistoryClick,
  onCopiesClick,
  onContainersClick,
  onHelpClick,
  onSuppliersClick,
  onPurchasesClick,
  onAccountPayablesClick
}) => {
  return (
    <div className="pos-page">
      <div className="pos-page-container">
        <Header
          title="🏪 Punto de Venta"
          onBack={onBack}
          backText="← Volver al Menú Principal"
          className="pos-page-header"
        />
        
        <div className="pos-page-content">
          {/* Sección: Operaciones Principales */}
          <div className="pos-section">
            <div className="pos-section-header">
              <h2 className="pos-section-title">
                <span className="section-icon">⚡</span>
                Operaciones Principales
              </h2>
              <p className="pos-section-description">Módulos esenciales para el día a día</p>
            </div>
            <div className="pos-modules-grid">
              <Card 
                variant="feature" 
                className="pos-module-card primary"
                onClick={onSalesClick}
                hoverable
              >
                <div className="pos-module-icon">🛒</div>
                <h3 className="pos-module-title">Venta</h3>
                <p className="pos-module-description">Procesar ventas y cobros</p>
              </Card>
              
              <Card
                variant="feature"
                className="pos-module-card secondary"
                onClick={onProductsClick}
                hoverable
              >
                <div className="pos-module-icon">🛍️</div>
                <h3 className="pos-module-title">Productos</h3>
                <p className="pos-module-description">Catálogo y gestión de productos</p>
              </Card>

              {onContainersClick && (
                <Card
                  variant="feature"
                  className="pos-module-card containers"
                  onClick={onContainersClick}
                  hoverable
                >
                  <div className="pos-module-icon">🍺</div>
                  <h3 className="pos-module-title">Envases</h3>
                  <p className="pos-module-description">Gestionar envases retornables</p>
                </Card>
              )}
            </div>
          </div>

          {/* Sección: Gestión */}
          <div className="pos-section">
            <div className="pos-section-header">
              <h2 className="pos-section-title">
                <span className="section-icon">👥</span>
                Gestión
              </h2>
              <p className="pos-section-description">Administración de clientes, personal y ayuda</p>
            </div>
            <div className="pos-modules-grid">
              <Card 
                variant="feature" 
                className="pos-module-card info"
                onClick={onClientClick}
                hoverable
              >
                <div className="pos-module-icon">👥</div>
                <h3 className="pos-module-title">Clientes</h3>
                <p className="pos-module-description">Catálogo y gestión de clientes</p>
              </Card>
              
              <Card
                variant="feature"
                className="pos-module-card success"
                onClick={onInventoryClick}
                hoverable
              >
                <div className="pos-module-icon">📦</div>
                <h3 className="pos-module-title">Inventario</h3>
                <p className="pos-module-description">Control de stock y existencias</p>
              </Card>
              
              {onUsersClick && (
                <Card 
                  variant="feature" 
                  className="pos-module-card warning"
                  onClick={onUsersClick}
                  hoverable
                >
                  <div className="pos-module-icon">👤</div>
                  <h3 className="pos-module-title">Cajeros</h3>
                  <p className="pos-module-description">Gestionar usuarios y cajeros</p>
                </Card>
              )}
            </div>
          </div>

          {/* Sección: Compras y Proveedores */}
          <div className="pos-section">
            <div className="pos-section-header">
              <h2 className="pos-section-title">
                <span className="section-icon">🛒</span>
                Compras y Proveedores
              </h2>
              <p className="pos-section-description">Compras, proveedores y cuentas por pagar</p>
            </div>
            <div className="pos-modules-grid">
              {onSuppliersClick && (
                <Card 
                  variant="feature" 
                  className="pos-module-card suppliers"
                  onClick={onSuppliersClick}
                  hoverable
                >
                  <div className="pos-module-icon">👥</div>
                  <h3 className="pos-module-title">Proveedores</h3>
                  <p className="pos-module-description">Catálogo y gestión de proveedores</p>
                </Card>
              )}

              {onPurchasesClick && (
                <Card 
                  variant="feature" 
                  className="pos-module-card purchases"
                  onClick={onPurchasesClick}
                  hoverable
                >
                  <div className="pos-module-icon">🛒</div>
                  <h3 className="pos-module-title">Compras</h3>
                  <p className="pos-module-description">Registrar y gestionar compras</p>
                </Card>
              )}

              {onAccountPayablesClick && (
                <Card 
                  variant="feature" 
                  className="pos-module-card account-payables"
                  onClick={onAccountPayablesClick}
                  hoverable
                >
                  <div className="pos-module-icon">💳</div>
                  <h3 className="pos-module-title">Cuentas por Pagar</h3>
                  <p className="pos-module-description">Gestionar pagos a proveedores</p>
                </Card>
              )}
            </div>
          </div>

          {/* Sección: Papelería */}
          <div className="pos-section">
            <div className="pos-section-header">
              <h2 className="pos-section-title">
                <span className="section-icon">📄</span>
                Papelería
              </h2>
              <p className="pos-section-description">Impresión, copias y ayuda del sistema</p>
            </div>
            <div className="pos-modules-grid">
              {onCopiesClick && (
                <Card
                  variant="feature"
                  className="pos-module-card copies"
                  onClick={onCopiesClick}
                  hoverable
                >
                  <div className="pos-module-icon">🖨️</div>
                  <h3 className="pos-module-title">Copias</h3>
                  <p className="pos-module-description">Imprimir documentos y copias</p>
                </Card>
              )}

              {onHelpClick && (
                <Card 
                  variant="feature" 
                  className="pos-module-card help"
                  onClick={onHelpClick}
                  hoverable
                >
                  <div className="pos-module-icon">❓</div>
                  <h3 className="pos-module-title">Ayuda</h3>
                  <p className="pos-module-description">Información y soporte del sistema</p>
                </Card>
              )}
            </div>
          </div>

          {/* Sección: Reportes y Análisis */}
          <div className="pos-section">
            <div className="pos-section-header">
              <h2 className="pos-section-title">
                <span className="section-icon">📊</span>
                Reportes y Análisis
              </h2>
              <p className="pos-section-description">Análisis de ventas, turnos y movimientos</p>
            </div>
            <div className="pos-modules-grid">
              <Card 
                variant="feature" 
                className="pos-module-card chart"
                onClick={onReportClick}
                hoverable
              >
                <div className="pos-module-icon">📊</div>
                <h3 className="pos-module-title">Reportes</h3>
                <p className="pos-module-description">Estadísticas y análisis de ventas</p>
              </Card>
              
              {onShiftHistoryClick && (
                <Card 
                  variant="feature" 
                  className="pos-module-card history"
                  onClick={onShiftHistoryClick}
                  hoverable
                >
                  <div className="pos-module-icon">📋</div>
                  <h3 className="pos-module-title">Historial de Turnos</h3>
                  <p className="pos-module-description">Ver cierres de caja y turnos</p>
                </Card>
              )}
              
              {onCashMovementsHistoryClick && (
                <Card 
                  variant="feature" 
                  className="pos-module-card money"
                  onClick={onCashMovementsHistoryClick}
                  hoverable
                >
                  <div className="pos-module-icon">💰</div>
                  <h3 className="pos-module-title">Movimientos de Efectivo</h3>
                  <p className="pos-module-description">Entradas y salidas de efectivo</p>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POSPage;
