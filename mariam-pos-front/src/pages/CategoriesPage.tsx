import React, { useState, useEffect, useRef} from 'react';
import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import CategoryModal from '../components/CategoryModal';
import CategoryOrgChartModal from '../components/CategoryOrgChartModal';
import type { Category, Department } from '../types';
import { getDepartments } from '../api/departments';
import Swal from 'sweetalert2';
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
  const [showOrgChart, setShowOrgChart] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);

  const inputRef = useRef<HTMLInputElement>(null); // 👈 referencia al input

  useEffect(() => {
    inputRef.current?.focus();
    // Cargar departamentos para el organigrama.
    getDepartments()
      .then(setDepartments)
      .catch((e) => console.error('Error al cargar departamentos:', e));
  }, [])
   
  // Filtrar categorías por término de búsqueda
  const filteredCategories = categories
    .filter(category =>
      category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      category.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    // Agrupar por departamento (alfabético); las sin departamento van al final.
    // Dentro de cada grupo, ordenar por nombre de categoría.
    .sort((a, b) => {
      const depA = a.department?.name ?? '';
      const depB = b.department?.name ?? '';
      if (depA !== depB) {
        // Las que no tienen departamento (cadena vacía) se mandan al final.
        if (!depA) return 1;
        if (!depB) return -1;
        return depA.localeCompare(depB, 'es');
      }
      return a.name.localeCompare(b.name, 'es');
    });

  const handleDelete = async (category: Category) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Eliminar categoría',
      html: `
        <p style="margin:0 0 10px;">¿Seguro que querés eliminar <strong>${category.name}</strong>?</p>
        <div style="text-align:left;font-size:0.85rem;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;">
          ⚠️ Si la categoría tiene productos asignados (por ejemplo, productos que ya se vendieron), no se podrá eliminar.
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '🗑️ Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      reverseButtons: true,
    });
    if (result.isConfirmed) {
      onDelete(category.id);
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
                variant="info"
                onClick={() => setShowOrgChart(true)}
                className="categories-add-btn"
              >
                🗂️ Estructura
              </Button>
              <Button
                variant="success"
                onClick={handleAddNew}
                className="categories-add-btn"
              >
                ➕ Agregar Categoría
              </Button>
            </div>
          </Card>

          {/* Tabla de categorías (táctil) */}
          <div className="categories-table-wrap">
            <table className="categories-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Departamento</th>
                  <th className="cat-th-center">En POS</th>
                  <th className="cat-th-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="categories-table-state">
                      No se encontraron categorías
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((category) => (
                    <tr key={category.id}>
                      <td className="cat-td-name">{category.name}</td>
                      <td>
                        {category.department?.name ? (
                          <span className="category-dept-badge">🏢 {category.department.name}</span>
                        ) : (
                          <span className="category-dept-badge category-dept-badge--none">
                            Sin departamento
                          </span>
                        )}
                      </td>
                      <td className="cat-th-center">
                        {category.showInPOS ? (
                          <span className="cat-pos-badge cat-pos-badge--on">Sí</span>
                        ) : (
                          <span className="cat-pos-badge cat-pos-badge--off">No</span>
                        )}
                      </td>
                      <td className="cat-th-center">
                        <div className="cat-actions">
                          <button
                            type="button"
                            className="cat-action cat-action--edit"
                            title="Editar"
                            onClick={() => handleEdit(category)}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            type="button"
                            className="cat-action cat-action--delete"
                            title="Eliminar"
                            onClick={() => handleDelete(category)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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

        {/* Organigrama: Sucursal → Departamentos → Categorías */}
        <CategoryOrgChartModal
          isOpen={showOrgChart}
          onClose={() => setShowOrgChart(false)}
          departments={departments}
          categories={categories}
        />
      </div>
    </div>
  );
};

export default CategoriesPage;
