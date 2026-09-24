import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types/index';

interface CashierContextType {
  selectedCashier: User | null;
  setSelectedCashier: (cashier: User | null) => void;
}

const CashierContext = createContext<CashierContextType | undefined>(undefined);

const STORAGE_KEY = 'selectedCashier';

/** Lee el cajero persistido en localStorage (sobrevive recargas). */
function readStoredCashier(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export const CashierProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Hidratar desde localStorage para que el cajero siga disponible tras recargar.
  const [selectedCashier, setSelectedCashierState] = useState<User | null>(() => readStoredCashier());

  const setSelectedCashier = useCallback((cashier: User | null) => {
    setSelectedCashierState(cashier);
    try {
      if (cashier) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cashier));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Si localStorage falla (modo privado, etc.), el estado en memoria igual funciona.
    }
  }, []);

  return (
    <CashierContext.Provider value={{ selectedCashier, setSelectedCashier }}>
      {children}
    </CashierContext.Provider>
  );
};

export const useCashier = () => {
  const context = useContext(CashierContext);
  if (context === undefined) {
    throw new Error('useCashier must be used within a CashierProvider');
  }
  return context;
};
