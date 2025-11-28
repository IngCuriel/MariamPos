import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types/index';

interface CashierContextType {
  selectedCashier: User | null;
  setSelectedCashier: (cashier: User | null) => void;
}

const CashierContext = createContext<CashierContextType | undefined>(undefined);

export const CashierProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedCashier, setSelectedCashier] = useState<User | null>(null);

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

