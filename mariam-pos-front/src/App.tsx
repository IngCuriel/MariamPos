import React from 'react';
import { useNavigation } from './hooks/useNavigation';
import { useCategories } from './hooks/useCategories';
import { useShiftReminder } from './hooks/useShiftReminder';
import HomePage from './pages/HomePage';
import HelpPage from './pages/HelpPage';
import POSPage from './pages/POSPage';
import ProductsPage from './pages/ProductsPage';
import CatalogPage from './pages/product/CatalogPage';
import CategoriesPage from './pages/CategoriesPage';
import ReportPage from './pages/report/ReportPage';
import SalesPage from './pages/sales/salesPage';
import ClientPage from './pages/client/ClientPage';
import InventoryPage from './pages/inventory/InventoryPage';
import UsersPage from './pages/users/UsersPage';
import ShiftHistoryPage from './pages/sales/ShiftHistoryPage';
import CashMovementsHistoryPage from './pages/cashMovements/CashMovementsHistoryPage';
import CopiesPage from './pages/copies/CopiesPage';
import ContainersPage from './pages/containers/ContainersPage';
import NewKitPage from './pages/product/NewKitPage';
import SuppliersPage from './pages/suppliers/SuppliersPage';
import PurchasesPage from './pages/purchases/PurchasesPage';
import AccountPayablesPage from './pages/accountPayables/AccountPayablesPage';
import './styles/index.css';

function App() {
  const { 
    currentView, 
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
    goToCopies,
    goToContainers,
    goToKit,
    goToSuppliers,
    goToPurchases,
    goToAccountPayables,
  } = useNavigation();
  
  const { categories, addCategory, updateCategory, deleteCategory, loadCategories } = useCategories();
  
  // Inicializar recordatorio de turnos (verifica turnos abiertos al iniciar y maneja el cierre)
  useShiftReminder({ onGoToSales: goToSales });

  // Cargar categorías solo cuando se abre el módulo de categorías
  React.useEffect(() => {
    if (currentView === 'categories') {
      loadCategories();
    }
  }, [currentView, loadCategories]);

  const renderCurrentView = () => {
    switch (currentView) {
      case 'help':
        return <HelpPage onBack={goToPOS} />;
      case 'pos':
        return <POSPage onBack={goToMain} onProductsClick={goToCatalog} onSalesClick={goToSales} onClientClick={gotoClients} onReportClick={gotoReport} onInventoryClick={goToInventory} onUsersClick={goToUsers} onShiftHistoryClick={goToShiftHistory} onCashMovementsHistoryClick={goToCashMovementsHistory} onCopiesClick={goToCopies} onContainersClick={goToContainers} onHelpClick={goToHelp} onSuppliersClick={goToSuppliers} onPurchasesClick={goToPurchases} onAccountPayablesClick={goToAccountPayables} />;
      case 'products':
        return (
          <ProductsPage 
            onBack={goToPOS} 
            onCreateKit={goToKit}
            onViewCatalog={goToCatalog}
            onCategories={goToCategories}
          />
        );
      case 'catalog':
        return (
          <CatalogPage 
            onBack={goToPOS}
            onCategories={goToCategories}
            onCreateKit={goToKit}
          />
        );
      case 'categories':
        return (
          <CategoriesPage 
            onBack={goToCatalog} 
            categories={categories}
            onAdd={addCategory}
            onEdit={updateCategory}
            onDelete={deleteCategory}
          />
        );
      case 'client':
        return (
          <ClientPage onBack={goToPOS} />
        )
      case 'sales':
        return <SalesPage onBack={goToPOS} />;
      case 'report':
        return <ReportPage onBack={goToPOS} />;
      case 'inventory':
        return <InventoryPage onBack={goToPOS} />;
      case 'users':
        return <UsersPage onBack={goToPOS} />;
      case 'shift-history':
        return <ShiftHistoryPage onBack={goToPOS} />;
      case 'cash-movements-history':
        return <CashMovementsHistoryPage onBack={goToPOS} />;
      case 'copies':
        return <CopiesPage onBack={goToPOS} />;
      case 'containers':
        return <ContainersPage onBack={goToPOS} />;
      case 'kit':
        return <NewKitPage onBack={goToCatalog} />;
      case 'suppliers':
        return <SuppliersPage onBack={goToPOS} />;
      case 'purchases':
        return <PurchasesPage onBack={goToPOS} />;
      case 'account-payables':
        return <AccountPayablesPage onBack={goToPOS} />;
      default:
        return <HomePage onPOSClick={goToPOS} />;
    }
  };

  return renderCurrentView();
}

export default App;
