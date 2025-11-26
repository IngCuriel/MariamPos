import { useState } from 'react';
import type { ViewType } from '../types';

export const useNavigation = () => {
  const [currentView, setCurrentView] = useState<ViewType>('main');

  const navigateTo = (view: ViewType) => {
    setCurrentView(view);
  };

  const goToMain = () => setCurrentView('main');
  const goToHelp = () => setCurrentView('help');
  const goToPOS = () => setCurrentView('pos');
  const goToProducts = () => setCurrentView('products');
  const goToCatalog = () => setCurrentView('catalog');
  const goToCategories = () => setCurrentView('categories');
  const goToSales = () => setCurrentView('sales');
  const gotoClients = () => setCurrentView('client');
  const gotoReport = () => setCurrentView('report');
  const goToInventory = () => setCurrentView('inventory');
  const goToUsers = () => setCurrentView('users');
  const goToShiftHistory = () => setCurrentView('shift-history');
  const goToCashMovementsHistory = () => setCurrentView('cash-movements-history');

  return {
    currentView,
    navigateTo,
    goToMain,
    goToHelp,
    goToPOS,
    goToProducts,
    goToCatalog,
    goToCategories,
    goToSales,
    gotoClients,
    gotoReport,
    goToInventory,
    goToUsers,
    goToShiftHistory,
    goToCashMovementsHistory,
  };
};
