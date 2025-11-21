import { useNavigation } from './hooks/useNavigation';
import { useCategories } from './hooks/useCategories';
import HomePage from './pages/HomePage';
import HelpPage from './pages/HelpPage';
import POSPage from './pages/POSPage';
import ProductsPage from './pages/ProductsPage';
import NewProductPage from './pages/product/NewProductPage';
import CatalogPage from './pages/product/CatalogPage';
import CategoriesPage from './pages/CategoriesPage';
import ReportPage from './pages/report/ReportPage';
import SalesPage from './pages/sales/salesPage';
import ClientPage from './pages/client/ClientPage';
import InventoryPage from './pages/inventory/InventoryPage';
import './styles/index.css';

function App() {
  const { 
    currentView, 
    goToMain, 
    goToHelp, 
    goToPOS, 
    goToProducts, 
    goToNewProduct, 
    goToCatalog,
    goToCategories,
    goToSales,
    gotoClients,
    gotoReport,
    goToInventory,
  } = useNavigation();
  
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories();

  const renderCurrentView = () => {
    switch (currentView) {
      case 'help':
        return <HelpPage onBack={goToMain} />;
      case 'pos':
        return <POSPage onBack={goToMain} onProductsClick={goToProducts} onSalesClick={goToSales} onClientClick={gotoClients} onReportClick={gotoReport} onInventoryClick={goToInventory} />;
      case 'products':
        return (
          <ProductsPage 
            onBack={goToPOS} 
            onNewProduct={goToNewProduct}
            onViewCatalog={goToCatalog}
            onCategories={goToCategories}
          />
        );
      case 'new-product':
        return (
          <NewProductPage 
            onBack={goToProducts} 
           />
        );
      case 'catalog':
        return (
          <CatalogPage 
            onBack={goToProducts} 
          />
        );
      case 'categories':
        return (
          <CategoriesPage 
            onBack={goToProducts} 
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
      default:
        return <HomePage onHelpClick={goToHelp} onPOSClick={goToPOS} />;
    }
  };

  return renderCurrentView();
}

export default App;
