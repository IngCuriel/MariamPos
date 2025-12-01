import React, { useState, useEffect, useRef} from 'react';
import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import CategoryModal from '../components/CategoryModal';
import type { Category } from '../types';
import '../styles/pages/categories/categoriesPage.css';

interface CategoriesPageProps {
  onBack: () => void;
  categories: Category[];
  onAdd: (category: Omit<Category, 'id' | 'createdAt'>) => void;
  onEdit: (id: string, updates: Partial<Category>) => void;
  onDelete: (id: string) => void;
}

const CategoriesPage: React.FC<CategoriesPageProps> = ({
  onBack,
  categories,
  onAdd,
  onEdit,
  onDelete
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const inputRef = useRef<HTMLInputElement>(null); // 👈 referencia al input
  
  useEffect(() => {
         inputRef.current?.focus();
  }, [])
   
  // Filtrar categorías por término de búsqueda
  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = (categoryId: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta categoría?')) {
      onDelete(categoryId);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setShowAddForm(true);
  };

  const handleAddNew = () => {
    setEditingCategory(null);
    setShowAddForm(true);
  };

  const handleCloseForm = () => {
    setShowAddForm(false);
    setEditingCategory(null);
  };

  const handleSave = (categoryData: Omit<Category, 'id' | 'createdAt'>) => {
    if (editingCategory) {
      onEdit(editingCategory.id, categoryData);
    } else {
      onAdd(categoryData);
    }
  };

  return (
    <div className="categories-page">
      <div className="categories-page-container">
        <Header
          title="📂 Gestión de Categorías"
          onBack={onBack}
          backText="← Volver a Productos"
          className="categories-page-header"
        />
        
        <div className="categories-page-content">
          {/* Barra de búsqueda */}
          <Card className="categories-search-card">
            <div className="categories-search-section">
              <div className="categories-search-group">
                <label htmlFor="search">Buscar categoría:</label>
                <input
                  type="text"
                  ref={inputRef}
                  id="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nombre o descripción..."
                  className="categories-search-input"
                />
              </div>
              <Button
                variant="success"
                onClick={handleAddNew}
                className="categories-add-btn"
              >
                ➕ Agregar Categoría
              </Button>
            </div>
          </Card>

          {/* Estadísticas */}
          <div className="categories-stats">
            <p>Mostrando {filteredCategories.length} de {categories.length} categoría{categories.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Lista de categorías */}
          <div className="categories-grid">
            {filteredCategories.length === 0 ? (
              <Card className="no-categories-card">
                <h3>No se encontraron categorías</h3>
                <p>Intenta ajustar el término de búsqueda o agrega una nueva categoría</p>
              </Card>
            ) : (
              filteredCategories.map(category => (
                <Card key={category.id} className="category-card-cat">
                  <div className="category-header">
                    <div className="category-info">
                      <h3 className="category-name">{category.name}</h3>
                      {category.description && (
                        <p className="category-description">{category.description}</p>
                      )}
                      <p className="category-date">
                        {new Date(category?.createdAt).toLocaleString('es-MX', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="category-actions">
                    <Button
                      variant="info"
                      size="small"
                      onClick={() => handleEdit(category)}
                      className="edit-btn"
                    >
                      ✏️ Editar
                    </Button>
                    <Button
                      variant="warning"
                      size="small"
                      onClick={() => handleDelete(category.id)}
                      className="delete-btn"
                    >
                      🗑️ Eliminar
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Modal para agregar/editar categorías */}
        <CategoryModal
          isOpen={showAddForm}
          onClose={handleCloseForm}
          onSave={handleSave}
          category={editingCategory}
          title={editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
        />
      </div>
    </div>
  );
};

export default CategoriesPage;
