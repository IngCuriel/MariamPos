import React, { useState, useEffect, useRef } from 'react';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import type { Product, Category } from '../../types';
import { getProducts, getProductsFilters, getProductsByCategoryId, createProduct, updateProduct, deleteProduct} from '../../api/products';
import { getCategories} from '../../api/categories';
import '../../styles/pages/products/products.css'
import NewEditProductModal from './NewEditProductModal';

import { toast } from 'react-toastify';

interface CatalogPageProps {
  onBack: () => void;
}

const CatalogPage: React.FC<CatalogPageProps> = ({ 
  onBack 
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsEdit, setProductsEdit] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null); // 👈 referencia al input
  

   // 🟢 Llamada al API cuando el hook se monta
  useEffect(() => {
      inputRef.current?.focus();
      fetchCategories();
      fetchProducts();
  }, []);
  
  useEffect(() => {
         fetchProductsFilters();
  }, [searchTerm]);

  useEffect(() => {
         fetchProductsByCategoryId();
  }, [selectedCategory]);

  const fetchProducts = async () => {
          try {
            const data = await getProducts();
            setProducts(data);
          } catch (err) {
            console.error(err);
           } finally {
             console.log('Finally')
          }
    };

    const fetchProductsFilters = async () => {
       if(searchTerm.length >= 3) { 
          try {
            const data = await getProductsFilters(searchTerm);
            setProducts(data);
          } catch (err) {
            console.error(err);
           } finally {
             console.log('Finally')
             if(selectedCategory!=='') 
                setSelectedCategory('')
          }
      }
    };

    const fetchProductsByCategoryId = async () => {
      setSearchTerm(()=> '');
      if(selectedCategory!=='') { 
          try {
            const data = await getProductsByCategoryId(selectedCategory);
            setProducts(data);
          } catch (err) {
            console.error(err);
           } finally {
             console.log('Finally')
          }
      }
    };

    const fetchCategories = async () => {
          try {
            const data = await getCategories();
            setCategories(data);
          } catch (err) {
            console.error(err);
           } finally {
             console.log('Finally')
          }
    };

  const handleDelete = async (_productId: number) => {
     try {
        const result = await deleteProduct(_productId);
        console.log('result delete product', result)
        setProducts((prevProducts) => prevProducts.filter((p) => p.id !== _productId));
        toast.success('✅ Producto eliminado correctamente');
     } catch (error) {
      console.log('Error eliminar procuto', error);
      toast.error('❌ No es posible eliminar el producto');
     } finally {
        inputRef.current?.focus();
     }
  };

  const onEdit= (product:Product) => {
    setProductsEdit(product);
    setShowAddForm(true);

  }

  const handleSave = async(product: Omit<Product, "createdAt">) => {
     console.log('product', product);
     try {

      let data = null;
      if (product.id > 0) {
         data = await updateProduct(product);
      } else {
         data= await createProduct(product);
      }
      setProducts((prevProducts) =>
          prevProducts.map((p) =>
            p.id === product.id ? { ...p, ...product } : p
          )
      );
      console.log('data', data);
    } catch (err) {
      console.error(err);
     } finally {
        inputRef.current?.focus();
     }
  }
  const handleAddNew = () => {
     setProductsEdit(null);
     setShowAddForm(true);
  };

  const handleCloseForm = () => {
    setShowAddForm(false);
    inputRef.current?.focus();
  };

  return (
    <div className="app-products-catalog">
      <div className="products-catalog-container">
        <Header
          title="Catálogo de Productos"
          onBack={onBack}
          backText="← Volver a Productos"
          className="catalog-header"
        />
        
        <div className="catalog-content">
          {/* Filtros */}
          <Card className="filters-card">
            <div className="filters">
              <div className="search-group">
                <label htmlFor="search">Buscar producto:</label>
                <input
                  type="text"
                  ref={inputRef} // 👈 referencia aquí
                  id="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nombre o descripción..."
                  className="search-input"
                />
              </div>
              
              <div className="category-group">
                <label htmlFor="category">Categoría:</label>
                <select
                  id="category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="category-select"
                >
                  <option value="">Todas las categorías</option>
                  {categories.map(category => (
                    <option key={category?.id} value={category?.id}>{category?.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Button
                  variant="success"
                  onClick={handleAddNew}
                  className="add-category-btn"
                >
                  ➕ Agregar Producto
                </Button>
              </div>
            </div>
          </Card>
          {/* Grid de productos */}
          <div className="products-grid">
            {products.length === 0 ? (
              <Card className="no-products-card">
                <h3>No se encontraron productos</h3>
                <p>Intenta ajustar los filtros de búsqueda</p>
              </Card>
            ) : (
              products.map(product => (
                <Card key={product.id} className={`product-card`} variant="product">
                  <div className={`product-image`}>{product.icon}</div>
                  <div className="product-info">
                    <h3 className="product-name">{product.name}</h3>
                    <p className="product-category">Categoria: {product.category?.name}</p>
                    <p className="product-price">${product.price.toFixed(2)}</p>
                    <p className="product-stock">Costo: {product.cost}</p>
                    {product.description && (
                      <p className="product-description">{product.description}</p>
                    )}
                    <p className="product-code">Codigo: {product.code}</p>
                  </div>  
                  <div className="product-actions">
                       <Button
                        variant="info"
                        size="small"
                        onClick={() => onEdit(product)}
                        className="edit-btn"
                      >
                        Editar
                      </Button>
                  
                       <Button
                        variant="warning"
                        size="small"
                        onClick={() => handleDelete(product.id)}
                        className="delete-btn"
                      >
                        Eliminar
                      </Button>
                   </div>
                </Card>
              ))
            )}
          </div>
        </div>
          {/* Modal para agregar/editar categorías */}
          <NewEditProductModal
          isOpen={showAddForm}
          onClose={handleCloseForm}
          onSave={handleSave}
          product={productsEdit}
          title={'Producto'}
        />
      </div>
    </div>
  );
};

export default CatalogPage;
