import React, { useState, useEffect } from 'react';
import Card from './Card';
import Button from './Button';
import type { POSPageConfig } from '../types/posConfig';
import { DEFAULT_POS_CONFIG } from '../types/posConfig';
import '../styles/components/posConfigModal.css';

interface POSConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: POSPageConfig) => void;
  currentConfig: POSPageConfig;
}

const POSConfigModal: React.FC<POSConfigModalProps> = ({ isOpen, onClose, onSave, currentConfig }) => {
  const [config, setConfig] = useState<POSPageConfig>(currentConfig);
  const [activeTab, setActiveTab] = useState<'sections' | 'modules'>('sections');

  useEffect(() => {
    if (isOpen) {
      setConfig(currentConfig);
    }
  }, [isOpen, currentConfig]);

  const handleSectionToggle = (sectionId: string) => {
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.id === sectionId ? { ...s, visible: !s.visible } : s
      ),
    }));
  };

  const handleModuleToggle = (moduleId: string) => {
    setConfig(prev => ({
      ...prev,
      modules: prev.modules.map(m =>
        m.id === moduleId ? { ...m, visible: !m.visible } : m
      ),
    }));
  };

  const handleSectionOrderChange = (sectionId: string, direction: 'up' | 'down') => {
    setConfig(prev => {
      const sections = [...prev.sections];
      const index = sections.findIndex(s => s.id === sectionId);
      if (index === -1) return prev;

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= sections.length) return prev;

      [sections[index], sections[newIndex]] = [sections[newIndex], sections[index]];
      sections[index].order = index + 1;
      sections[newIndex].order = newIndex + 1;

      return { ...prev, sections };
    });
  };

  const handleModuleOrderChange = (moduleId: string, direction: 'up' | 'down') => {
    setConfig(prev => {
      const modules = [...prev.modules];
      const index = modules.findIndex(m => m.id === moduleId);
      if (index === -1) return prev;

      const sectionId = modules[index].section;
      const sectionModules = modules.filter(m => m.section === sectionId).sort((a, b) => a.order - b.order);
      const sectionIndex = sectionModules.findIndex(m => m.id === moduleId);
      
      if (sectionIndex === -1) return prev;

      const newIndex = direction === 'up' ? sectionIndex - 1 : sectionIndex + 1;
      if (newIndex < 0 || newIndex >= sectionModules.length) return prev;

      const moduleToSwap = sectionModules[newIndex];
      const currentOrder = modules[index].order;
      const swapOrder = moduleToSwap.order;

      modules[index].order = swapOrder;
      modules.find(m => m.id === moduleToSwap.id)!.order = currentOrder;

      return { ...prev, modules };
    });
  };

  const handleSectionColumnsChange = (sectionId: string, columns: number) => {
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.id === sectionId ? { ...s, columns } : s
      ),
    }));
  };

  const handleReset = () => {
    if (window.confirm('¿Estás seguro de restaurar la configuración por defecto?')) {
      setConfig(DEFAULT_POS_CONFIG);
    }
  };

  const handleSave = () => {
    onSave(config);
    onClose();
  };

  if (!isOpen) return null;

  const visibleSections = config.sections.filter(s => s.visible).sort((a, b) => a.order - b.order);
  const visibleModules = config.modules.filter(m => m.visible).sort((a, b) => a.order - b.order);

  return (
    <div className="pos-config-modal-overlay" onClick={onClose}>
      <Card className="pos-config-modal" onClick={(e) => e?.stopPropagation()}>
        <div className="pos-config-header">
          <h2>⚙️ Configuración del Punto de Venta</h2>
          <button className="pos-config-close" onClick={onClose}>✕</button>
        </div>

        <div className="pos-config-tabs">
          <button
            className={`pos-config-tab ${activeTab === 'sections' ? 'active' : ''}`}
            onClick={() => setActiveTab('sections')}
          >
            📑 Secciones ({visibleSections.length})
          </button>
          <button
            className={`pos-config-tab ${activeTab === 'modules' ? 'active' : ''}`}
            onClick={() => setActiveTab('modules')}
          >
            🧩 Módulos ({visibleModules.length})
          </button>
        </div>

        <div className="pos-config-content">
          {activeTab === 'sections' ? (
            <div className="pos-config-sections">
              <h3>Gestionar Secciones</h3>
              <p className="pos-config-hint">Activa o desactiva secciones completas y ajusta su orden</p>
              
              <div className="pos-config-list">
                {config.sections.map((section) => {
                  const sectionModules = config.modules.filter(m => m.section === section.id);
                  const visibleCount = sectionModules.filter(m => m.visible).length;
                  
                  return (
                    <div key={section.id} className="pos-config-item">
                      <div className="pos-config-item-header">
                        <label className="pos-config-checkbox">
                          <input
                            type="checkbox"
                            checked={section.visible}
                            onChange={() => handleSectionToggle(section.id)}
                          />
                          <span className="pos-config-checkbox-label">
                            <span className="pos-config-icon">{section.icon}</span>
                            <div>
                              <strong>{section.title}</strong>
                              <span className="pos-config-item-count">
                                {visibleCount} módulo(s) visible(s)
                              </span>
                            </div>
                          </span>
                        </label>
                        
                        <div className="pos-config-item-actions">
                          <button
                            className="pos-config-order-btn"
                            onClick={() => handleSectionOrderChange(section.id, 'up')}
                            disabled={section.order === 1}
                            title="Mover arriba"
                          >
                            ↑
                          </button>
                          <button
                            className="pos-config-order-btn"
                            onClick={() => handleSectionOrderChange(section.id, 'down')}
                            disabled={section.order === config.sections.length}
                            title="Mover abajo"
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                      
                      {section.visible && (
                        <div className="pos-config-item-details">
                          <label className="pos-config-columns-label">
                            Columnas en el grid:
                            <select
                              value={section.columns || 3}
                              onChange={(e) => handleSectionColumnsChange(section.id, parseInt(e.target.value))}
                              className="pos-config-columns-select"
                            >
                              <option value={1}>1 columna</option>
                              <option value={2}>2 columnas</option>
                              <option value={3}>3 columnas</option>
                              <option value={4}>4 columnas</option>
                            </select>
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="pos-config-modules">
              <h3>Gestionar Módulos</h3>
              <p className="pos-config-hint">Activa o desactiva módulos individuales y ajusta su orden dentro de cada sección</p>
              
              {visibleSections.map((section) => {
                const sectionModules = config.modules
                  .filter(m => m.section === section.id)
                  .sort((a, b) => a.order - b.order);
                
                if (sectionModules.length === 0) return null;

                return (
                  <div key={section.id} className="pos-config-module-group">
                    <h4 className="pos-config-group-title">
                      <span>{section.icon}</span>
                      {section.title}
                    </h4>
                    
                    <div className="pos-config-list">
                      {sectionModules.map((module) => {
                        const moduleIndex = sectionModules.findIndex(m => m.id === module.id);
                        const isFirst = moduleIndex === 0;
                        const isLast = moduleIndex === sectionModules.length - 1;
                        
                        return (
                          <div key={module.id} className="pos-config-item">
                            <div className="pos-config-item-header">
                              <label className="pos-config-checkbox">
                                <input
                                  type="checkbox"
                                  checked={module.visible}
                                  onChange={() => handleModuleToggle(module.id)}
                                />
                                <span className="pos-config-checkbox-label">
                                  <span className="pos-config-icon">{module.icon}</span>
                                  <div>
                                    <strong>{module.title}</strong>
                                    <span className="pos-config-item-description">{module.description}</span>
                                  </div>
                                </span>
                              </label>
                              
                              <div className="pos-config-item-actions">
                                <button
                                  className="pos-config-order-btn"
                                  onClick={() => handleModuleOrderChange(module.id, 'up')}
                                  disabled={isFirst}
                                  title="Mover arriba"
                                >
                                  ↑
                                </button>
                                <button
                                  className="pos-config-order-btn"
                                  onClick={() => handleModuleOrderChange(module.id, 'down')}
                                  disabled={isLast}
                                  title="Mover abajo"
                                >
                                  ↓
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="pos-config-footer">
          <Button variant="secondary" onClick={handleReset}>
            🔄 Restaurar por Defecto
          </Button>
          <div className="pos-config-footer-actions">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSave}>
              💾 Guardar Configuración
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default POSConfigModal;




