import type { POSPageConfig } from '../types/posConfig';
import { DEFAULT_POS_CONFIG } from '../types/posConfig';

const CONFIG_STORAGE_KEY = 'posPageConfig';

export const loadPOSConfig = (): POSPageConfig => {
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge con la configuración por defecto para asegurar que todos los módulos estén presentes
      return mergeWithDefault(parsed);
    }
  } catch (error) {
    console.error('Error loading POS config:', error);
  }
  return DEFAULT_POS_CONFIG;
};

export const savePOSConfig = (config: POSPageConfig): void => {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Error saving POS config:', error);
  }
};

export const resetPOSConfig = (): POSPageConfig => {
  savePOSConfig(DEFAULT_POS_CONFIG);
  return DEFAULT_POS_CONFIG;
};

const mergeWithDefault = (saved: POSPageConfig): POSPageConfig => {
  // Crear un mapa de módulos guardados por ID
  const savedModulesMap = new Map(saved.modules.map(m => [m.id, m]));
  const savedSectionsMap = new Map(saved.sections.map(s => [s.id, s]));

  // Merge módulos: usar los guardados si existen, sino usar los por defecto
  const mergedModules = DEFAULT_POS_CONFIG.modules.map(defaultModule => {
    const savedModule = savedModulesMap.get(defaultModule.id);
    return savedModule || defaultModule;
  });

  // Agregar módulos nuevos que puedan haber sido agregados en el futuro
  saved.modules.forEach(savedModule => {
    if (!mergedModules.find(m => m.id === savedModule.id)) {
      mergedModules.push(savedModule);
    }
  });

  // Merge secciones
  const mergedSections = DEFAULT_POS_CONFIG.sections.map(defaultSection => {
    const savedSection = savedSectionsMap.get(defaultSection.id);
    return savedSection || defaultSection;
  });

  // Agregar secciones nuevas
  saved.sections.forEach(savedSection => {
    if (!mergedSections.find(s => s.id === savedSection.id)) {
      mergedSections.push(savedSection);
    }
  });

  return {
    sections: mergedSections.sort((a, b) => a.order - b.order),
    modules: mergedModules.sort((a, b) => a.order - b.order),
  };
};

