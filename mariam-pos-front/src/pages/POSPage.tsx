import React, { useState, useMemo } from 'react';
import Header from '../components/Header';
import Card from '../components/Card';
import POSConfigModal from '../components/POSConfigModal';
import OnlineStoreModal from '../components/OnlineStoreModal';
import type { POSPageConfig, POSModuleConfig } from '../types/posConfig';
import { loadPOSConfig, savePOSConfig } from '../utils/posConfig';
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
  const [config, setConfig] = useState<POSPageConfig>(loadPOSConfig());
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showOnlineStoreModal, setShowOnlineStoreModal] = useState(false);

  // Mapeo de funciones onClick
  const onClickHandlers = useMemo(() => ({
    onSalesClick,
    onProductsClick,
    onContainersClick,
    onClientClick,
    onInventoryClick,
    onUsersClick,
    onSuppliersClick,
    onPurchasesClick,
    onAccountPayablesClick,
    onCopiesClick,
    onHelpClick,
    onReportClick,
    onShiftHistoryClick,
    onCashMovementsHistoryClick,
    onOnlineStoreClick: () => setShowOnlineStoreModal(true),
  }), [
    onSalesClick,
    onProductsClick,
    onContainersClick,
    onClientClick,
    onInventoryClick,
    onUsersClick,
    onSuppliersClick,
    onPurchasesClick,
    onAccountPayablesClick,
    onCopiesClick,
    onHelpClick,
    onReportClick,
    onShiftHistoryClick,
    onCashMovementsHistoryClick,
  ]);

  const handleConfigSave = (newConfig: POSPageConfig) => {
    savePOSConfig(newConfig);
    setConfig(newConfig);
  };

  const handleModuleClick = (module: POSModuleConfig) => {
    if (module.onClick && onClickHandlers[module.onClick as keyof typeof onClickHandlers]) {
      const handler = onClickHandlers[module.onClick as keyof typeof onClickHandlers];
      if (handler && typeof handler === 'function') {
        handler();
      }
    }
  };

  // Verificar si un módulo debe mostrarse (tiene onClick disponible)
  const isModuleAvailable = (module: POSModuleConfig): boolean => {
    if (!module.onClick) return false;
    const handler = onClickHandlers[module.onClick as keyof typeof onClickHandlers];
    return handler !== undefined && handler !== null;
  };

  // Renderizar secciones y módulos según la configuración
  const renderSections = () => {
    const visibleSections = config.sections
      .filter(s => s.visible)
      .sort((a, b) => a.order - b.order);

    return visibleSections.map((section) => {
      const sectionModules = config.modules
        .filter(m => m.section === section.id && m.visible && isModuleAvailable(m))
        .sort((a, b) => a.order - b.order);

      if (sectionModules.length === 0) return null;

      return (
        <div key={section.id} className="pos-section">
          <div className="pos-section-header">
            <h2 className="pos-section-title">
              <span className="section-icon">{section.icon}</span>
              {section.title}
            </h2>
          </div>
          <div 
            className="pos-modules-grid"
            style={{ gridTemplateColumns: `repeat(${section.columns || 3}, 1fr)` }}
          >
            {sectionModules.map((module) => (
              <Card
                key={module.id}
                variant="feature"
                className={`pos-module-card ${module.id}`}
                onClick={() => handleModuleClick(module)}
                hoverable
              >
                <div className="pos-module-icon">{module.icon}</div>
                <h3 className="pos-module-title">{module.title}</h3>
                <p className="pos-module-description">{module.description}</p>
              </Card>
            ))}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="pos-page">
      <div className="pos-page-container">
        <Header
          title="🏪 Menu Princupal"
          onBack={onBack}
          backText="← Volver al Inicio"
          className="pos-page-header"
          actions={
            <button
              className="pos-config-button"
              onClick={() => setShowConfigModal(true)}
              title="Configurar módulos"
            >
              ⚙️
            </button>
          }
        />
        
        <div className="pos-page-content">
          {renderSections()}
        </div>
      </div>

      <POSConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        onSave={handleConfigSave}
        currentConfig={config}
      />

      <OnlineStoreModal
        isOpen={showOnlineStoreModal}
        onClose={() => setShowOnlineStoreModal(false)}
      />
    </div>
  );
};

export default POSPage;
