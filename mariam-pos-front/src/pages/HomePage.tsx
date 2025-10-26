import React from 'react';
import Card from '../components/Card';
import { APP_CONFIG } from '../constants';

interface HomePageProps {
  onHelpClick: () => void;
  onPOSClick: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ onHelpClick, onPOSClick }) => {
  return (
    <div className="app">
      <div className="main-container">
        <header className="main-header">
          <h2 className="main-title">{APP_CONFIG.name}</h2>
          <p className="main-subtitle">{APP_CONFIG.subtitle}</p>
         </header>
        
        <div className="main-actions">
          <Card
            className="action-button help-button"
            onClick={onHelpClick}
            hoverable
          >
            <div className="button-icon">❓</div>
            <div className="button-content">
              <h2 style={{color:"orange"}}>Ayuda</h2>
              <p>Información y soporte del sistema</p>
            </div>
          </Card>
          
          <Card
            className="action-button pos-buttonÑP"
            onClick={onPOSClick}
            hoverable
          >
            <div className="button-icon">🛒</div>
            <div className="button-content">
              <h2 style={{color:"orange"}}>Punto de Venta</h2>
              <p>Acceder al módulo de ventas</p>
            </div>
          </Card>
        </div>
        
        <footer className="main-footer">
          <p>© 2025 {APP_CONFIG.author} - Sistema de Gestión Comercial</p>
        </footer>
      </div>
    </div>
  );
};

export default HomePage;
