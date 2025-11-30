import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import { APP_CONFIG } from '../constants';
import { getUsers } from '../api/users';
import { useCashier } from '../contexts/CashierContext';
import type { User } from '../types/index';
import '../styles/pages/home/homePage.css';

interface HomePageProps {
   onPOSClick: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ onPOSClick }) => {
  const { selectedCashier, setSelectedCashier } = useCashier();
  const [cashiers, setCashiers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [branchName, setBranchName] = useState<string>(APP_CONFIG.name);

  useEffect(() => {
    loadCashiers();
    loadBranchInfo();
  }, []);

  const loadBranchInfo = () => {
    const sucursal = localStorage.getItem('sucursal');
    const caja = localStorage.getItem('caja');
    
    if (sucursal) {
      // Si hay caja, mostrar "Sucursal - Caja", si no, solo "Sucursal"
      const displayName = caja ? `${sucursal} - ${caja}` : sucursal;
      setBranchName(displayName);
    } else {
      // Si no hay configuración, intentar cargar desde config.json
      fetch('/config.json')
        .then(res => res.json())
        .then(config => {
          if (config.sucursal) {
            const displayName = config.caja ? `${config.sucursal} - ${config.caja}` : config.sucursal;
            setBranchName(displayName);
            // Guardar en localStorage para futuras referencias
            localStorage.setItem('sucursal', config.sucursal);
            if (config.caja) {
              localStorage.setItem('caja', config.caja);
            }
          }
        })
        .catch(error => {
          console.error('Error al cargar configuración:', error);
          // Mantener el valor por defecto si falla
        });
    }
  };

  const loadCashiers = async () => {
    try {
      setLoading(true);
      const allUsers = await getUsers();
      const activeCashiers = allUsers.filter(user => user.status === 'ACTIVE');
      setCashiers(activeCashiers);
    } catch (error) {
      console.error("Error al cargar cajeros:", error);
      setCashiers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCashier = (cashier: User) => {
    setSelectedCashier(cashier);
    setShowWelcome(true);
    
    // Mostrar mensaje de bienvenida y luego permitir acceso
    setTimeout(() => {
      setShowWelcome(false);
      onPOSClick();
    }, 2000);
  };

  const handleContinueAsAnonymous = () => {
    setSelectedCashier(null);
    setShowWelcome(true);
    
    setTimeout(() => {
      setShowWelcome(false);
      onPOSClick();
    }, 2000);
  };

  // Si ya hay un cajero seleccionado, mostrar mensaje de bienvenida
  if (showWelcome) {
    return (
      <div className="home-page">
        <div className="welcome-container">
          <div className="welcome-card">
            <div className="welcome-icon">👋</div>
            <h1 className="welcome-title">
              ¡Bienvenido{selectedCashier ? `, ${selectedCashier.name}` : ''}!
            </h1>
            <p className="welcome-message">
              {selectedCashier 
                ? `Has iniciado sesión como ${selectedCashier.name}. ¡Que tengas un excelente día!`
                : 'Has iniciado sesión como usuario anónimo. ¡Que tengas un excelente día!'
              }
            </p>
            <div className="welcome-loader">
              <div className="loader-spinner"></div>
              <p>Accediendo al sistema...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      <div className="home-container">
        <div className="home-header">
          <div className="home-logo">
            <div className="logo-icon">🏪</div>
            <h1 className="home-title">{branchName}</h1>
          </div>
          <p className="home-subtitle">{APP_CONFIG.subtitle}</p>
        </div>

        <div className="cashier-selection-section">
          <div className="selection-header">
            <h2 className="selection-title">
              <span className="title-icon">👤</span>
              ¿Quién eres?
            </h2>
            <p className="selection-description">
              Selecciona tu usuario para continuar
            </p>
          </div>

          {loading ? (
            <div className="loading-cashiers">
              <div className="loader-spinner"></div>
              <p>Cargando cajeros...</p>
            </div>
          ) : (
            <>
              <div className="cashiers-grid">
                {cashiers.map((cashier) => (
                  <Card
                    key={cashier.id}
                    className="cashier-card"
                    onClick={() => handleSelectCashier(cashier)}
                    hoverable
                  >
                    <div className="cashier-avatar">
                      {cashier.name.charAt(0).toUpperCase()}
                    </div>
                    <h3 className="cashier-name">{cashier.name}</h3>
                    {cashier.role && (
                      <p className="cashier-role">
                        {cashier.role === 'ADMIN' ? '👑 Administrador' :
                         cashier.role === 'MANAGER' ? '💼 Gerente' :
                         cashier.role === 'SUPERVISOR' ? '👔 Supervisor' :
                         '💵 Cajero'}
                      </p>
                    )}
                    {cashier.branch && (
                      <p className="cashier-branch">📍 {cashier.branch}</p>
                    )}
                  </Card>
                ))}
              </div>

              <div className="anonymous-section">
                <Card
                  className="anonymous-card"
                  onClick={handleContinueAsAnonymous}
                  hoverable
                >
                  <div className="anonymous-icon">👤</div>
                  <h3 className="anonymous-title">Continuar como Anónimo</h3>
                  <p className="anonymous-description">
                    Acceder sin seleccionar un usuario
                  </p>
                </Card>
              </div>
            </>
          )}
        </div>

        <footer className="home-footer">
          <p>© 2025 {APP_CONFIG.author} - Sistema de Gestión Comercial</p>
        </footer>
      </div>
    </div>
  );
};

export default HomePage;
