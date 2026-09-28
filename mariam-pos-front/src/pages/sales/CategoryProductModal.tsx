import React, { useState, useEffect, useMemo } from "react";
import { getCategoriesShowInPOS } from "../../api/categories";
import { getProductsByCategoryId } from "../../api/products";
import type { Category, Product } from "../../types";
import "../../styles/pages/sales/categoryProductModal.css";
import { IoCloseCircleOutline, IoArrowBack } from "react-icons/io5";

interface CategoryProductModalProps {
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
}

type ViewMode = "categories" | "products";

const CategoryProductModal: React.FC<CategoryProductModalProps> = ({
  onClose,
  onSelectProduct,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>("categories");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar categorías al abrir el modal
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCategoriesShowInPOS();
      setCategories(data);
    } catch (err) {
      console.error("Error cargando categorías:", err);
      setError("Error al cargar las categorías");
    } finally {
      setLoading(false);
    }
  };

  // Agrupar categorías por departamento (las sin departamento van al final).
  const groupedCategories = useMemo(() => {
    const byDept = new Map<string, { name: string; cats: Category[] }>();
    const noDept: Category[] = [];
    for (const c of categories) {
      if (c.department?.id) {
        const g = byDept.get(c.department.id) ?? { name: c.department.name, cats: [] };
        g.cats.push(c);
        byDept.set(c.department.id, g);
      } else {
        noDept.push(c);
      }
    }
    const groups = Array.from(byDept.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "es")
    );
    groups.forEach((g) => g.cats.sort((a, b) => a.name.localeCompare(b.name, "es")));
    noDept.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return { groups, noDept };
  }, [categories]);

  const handleCategorySelect = async (category: Category) => {
    try {
      setLoading(true);
      setError(null);
      setSelectedCategory(category);
      // Pasar forSales=true para excluir productos inactivos en ventas
      const data = await getProductsByCategoryId(category.id, true);
      setProducts(data);
      setViewMode("products");
    } catch (err) {
      console.error("Error cargando productos:", err);
      setError("Error al cargar los productos de esta categoría");
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (product: Product) => {
    onSelectProduct(product);
    onClose();
  };

  const handleBack = () => {
    if (viewMode === "products") {
      setViewMode("categories");
      setSelectedCategory(null);
      setProducts([]);
    } else {
      onClose();
    }
  };

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleBack();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode]);

  return (
    <div className="category-product-modal-overlay" onClick={onClose}>
      <div
        className="category-product-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="category-product-modal-header">
          <button
            className="category-product-modal-back-btn"
            onClick={handleBack}
            title={viewMode === "products" ? "Volver a categorías" : "Cerrar"}
          >
            {viewMode === "products" ? (
              <IoArrowBack size={24} />
            ) : (
              <IoCloseCircleOutline size={24} />
            )}
          </button>
          <h2 className="category-product-modal-title">
            {viewMode === "categories"
              ? "📂 Seleccionar Categoría"
              : `📦 ${selectedCategory?.name || "Productos"}`}
          </h2>
          <div style={{ width: 40 }} /> {/* Spacer para centrar */}
        </div>

        {/* Content */}
        <div className="category-product-modal-content">
          {loading ? (
            <div className="category-product-modal-loading">
              <div className="loading-spinner"></div>
              <p>Cargando...</p>
            </div>
          ) : error ? (
            <div className="category-product-modal-error">
              <p>⚠️ {error}</p>
              <button
                className="category-product-modal-retry-btn"
                onClick={
                  viewMode === "categories" ? loadCategories : handleBack
                }
              >
                Reintentar
              </button>
            </div>
          ) : viewMode === "categories" ? (
            <>
              {categories.length === 0 ? (
                <div className="category-product-modal-empty">
                  <p>📭 No hay categorías disponibles</p>
                </div>
              ) : (
                <div className="cat-groups">
                  {groupedCategories.groups.map((group) => (
                    <div key={group.name} className="cat-group">
                      <div className="cat-group-title">🏢 {group.name}</div>
                      <div className="category-product-grid">
                        {group.cats.map((category) => (
                          <button
                            key={category.id}
                            className="category-card"
                            onClick={() => handleCategorySelect(category)}
                          >
                            <span className="category-card-icon">📁</span>
                            <span className="category-card-name">{category.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {groupedCategories.noDept.length > 0 && (
                    <div className="cat-group">
                      <div className="cat-group-title">📂 Sin departamento</div>
                      <div className="category-product-grid">
                        {groupedCategories.noDept.map((category) => (
                          <button
                            key={category.id}
                            className="category-card"
                            onClick={() => handleCategorySelect(category)}
                          >
                            <span className="category-card-icon">📁</span>
                            <span className="category-card-name">{category.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {products.length === 0 ? (
                <div className="category-product-modal-empty">
                  <p>📭 No hay productos en esta categoría</p>
                  <button
                    className="category-product-modal-retry-btn"
                    onClick={handleBack}
                  >
                    Volver a categorías
                  </button>
                </div>
              ) : (
                <div className="category-product-grid product-grid-compact">
                  {products.map((product) => (
                    <button
                      key={product.id}
                      className="product-card-modal"
                      onClick={() => handleProductSelect(product)}
                      title={product.name}
                    >
                      {/* Nombre largo (>42 chars): ocultar ícono y permitir 4 líneas. */}
                      {product.name.length <= 42 && (
                        <div className="product-card-modal-icon">
                          {product.icon || "📦"}
                        </div>
                      )}
                      <div
                        className={`product-card-modal-name ${
                          product.name.length > 42 ? "product-card-modal-name--long" : ""
                        }`}
                      >
                        {product.name}
                      </div>
                      <div className="product-card-modal-price">
                        {product.price.toLocaleString("es-MX", {
                          style: "currency",
                          currency: "MXN",
                        })}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategoryProductModal;
