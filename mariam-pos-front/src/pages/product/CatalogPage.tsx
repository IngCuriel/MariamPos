import React, { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Header from "../../components/Header";
import Card from "../../components/Card";
import type { Product, Category } from "../../types";
import {
  getProducts,
  getProductsFilters,
  getProductsByCategoryId,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../../api/products";
import { getCategories } from "../../api/categories";
import "../../styles/pages/products/products.css";
import "../../styles/pages/products/catalog.css";
import NewEditProductModal from "./NewEditProductModal";
import EditKitModal from "./EditKitModal";

import { toast } from "react-toastify";
import Swal from "sweetalert2";

interface CatalogPageProps {
  onBack: () => void;
  onCategories?: () => void;
  onCreateKit?: () => void;
}

const CatalogPage: React.FC<CatalogPageProps> = ({ onBack, onCategories, onCreateKit }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsEdit, setProductsEdit] = useState<Product | null>(null);
  const [kitEdit, setKitEdit] = useState<Product | null>(null); // 🆕 Para kits
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditKitModal, setShowEditKitModal] = useState(false); // 🆕 Modal de edición de kit
  const [showActionsMenu, setShowActionsMenu] = useState(false); // 🆕 Menú desplegable de acciones
  const [menuDirection, setMenuDirection] = useState<'up' | 'down'>('up'); // 🆕 Dirección del menú
  const inputRef = useRef<HTMLInputElement>(null); // 👈 referencia al input
  const actionsMenuRef = useRef<HTMLDivElement>(null); // 👈 referencia al menú desplegable
  const actionsToggleRef = useRef<HTMLButtonElement>(null); // 👈 referencia al botón toggle

  const [loading, setLoading] = useState(false);

  // 🟢 Llamada al API cuando el hook se monta
  useEffect(() => {
    inputRef.current?.focus();
    fetchCategories();
    fetchProducts();
  }, []);

  // Calcular dirección del menú (arriba o abajo) basado en el espacio disponible
  useEffect(() => {
    if (showActionsMenu && actionsToggleRef.current) {
      const toggleRect = actionsToggleRef.current.getBoundingClientRect();
      const spaceAbove = toggleRect.top;
      const spaceBelow = window.innerHeight - toggleRect.bottom;
      const menuHeight = 200; // Altura aproximada del menú (4 items * ~50px cada uno)
      
      // Si hay más espacio abajo, desplegar hacia abajo, si no hacia arriba
      if (spaceBelow >= menuHeight || spaceBelow > spaceAbove) {
        setMenuDirection('down');
      } else {
        setMenuDirection('up');
      }
    }
  }, [showActionsMenu]);

  // Cerrar menú desplegable al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node) &&
          actionsToggleRef.current && !actionsToggleRef.current.contains(event.target as Node)) {
        setShowActionsMenu(false);
      }
    };

    if (showActionsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showActionsMenu]);

  useEffect(() => {
    if(searchTerm.length > 2) {
       const handler = setTimeout(() => {
        fetchProductsFilters();
      }, 300); // 🕒 Espera 300 ms después del último cambio

      // Limpiar el timeout si `search` cambia antes de que pasen los 300 ms
      return () => clearTimeout(handler);
    } else if (searchTerm.length===0) {
       setProducts([])
    } 
  }, [searchTerm]);

  useEffect(() => {
    fetchProductsByCategoryId();
  }, [selectedCategory]);

  const fetchProducts = async () => {
    try {
      setLoading(true); // 🔹 iniciar loader
      const data = await getProducts();
      setProducts(data);
    } catch (err) {
      console.error(err);
    } finally {
      console.log("Finally");
      setLoading(false); // 🔹 finalizar loader
    }
  };

  const fetchProductsFilters = async () => {
      setLoading(true); // 🔹 iniciar loader
      try {
        const data = await getProductsFilters(searchTerm);
        setProducts(data);
      } catch (err) {
        console.error(err);
      } finally {
        console.log("Finally");
        setLoading(false); // 🔹 finalizar loader
        if (selectedCategory !== "") setSelectedCategory("");
      }
  };

  const fetchProductsByCategoryId = async () => {
    setSearchTerm(() => "");
    if (selectedCategory !== "") {
      setLoading(true); // 🔹 iniciar loader
      try {
        const data = await getProductsByCategoryId(selectedCategory);
        setProducts(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false); // 🔹 finalizar loader
        console.log("Finally");
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
      console.log("Finally");
    }
  };

  const handleDelete = async (_productId: number) => {
    try {
      const resultSwal = await Swal.fire({
        title: `¿Estás seguro que deseas eliminar el Producto?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
      });

      if (resultSwal.isConfirmed) {
        const result = await deleteProduct(_productId);
        console.log("result delete product", result);
        setProducts((prevProducts) =>
          prevProducts.filter((p) => p.id !== _productId)
        );
        // toast.success('✅ Producto eliminado correctamente');
        // 🔔 Notificación de éxito
        Swal.fire({
          icon: "success",
          title: "Eliminado",
          text: `Eliminado correctamente.`,
          timer: 1500,
          showConfirmButton: false,
        });
      }
    } catch (error) {
      console.log("Error eliminar procuto", error);
      toast.error("❌ No es posible eliminar el producto");
    } finally {
      inputRef.current?.focus();
    }
  };

  const onEdit = (product: Product) => {
    // 🆕 Detectar si es kit o producto normal
    if (product.isKit) {
      setKitEdit(product);
      setShowEditKitModal(true);
    } else {
      setProductsEdit(product);
      setShowAddForm(true);
    }
  };

  const handleSave = async (product: Omit<Product, "createdAt">) => {
    console.log("product", product);
    try {
      let data = null;
      if (product.id > 0) {
        data = await updateProduct(product);
        // Para edición, el modal se cierra desde NewEditProductModal
      } else {
        data = await createProduct(product);
        // Para nuevo producto, el modal pregunta si quiere agregar otro desde NewEditProductModal
      }
      
      // Actualizar la lista de productos
      if (product.id > 0) {
        // Actualizar producto existente
        setProducts((prevProducts) =>
          prevProducts.map((p) =>
            p.id === product.id ? { ...p, ...product } : p
          )
        );
      } else {
        // Agregar nuevo producto a la lista
        if (data) {
          setProducts((prevProducts) => [data, ...prevProducts]);
        }
      }
      
      // No cerrar aquí, el modal maneja el cierre según si es nuevo o edición
      
      console.log("data", data);
      return data;
    } catch (err:any) {
      // 🔔 Notificación de error
      Swal.fire({
        icon: "error",
        title: err?.response?.data?.error || 'Ocurrió un error, intenta más tarde',
        text: ``,
        timer: 3000,
        showConfirmButton: false,
      });
      console.error(err.response?.data?.error || err);
      throw err; // Re-lanzar el error para que NewEditProductModal lo maneje
    } finally {
      // No enfocar aquí, el modal maneja el enfoque
    }
  };

  const handleSaveKit = async (kit: Omit<Product, "createdAt">) => {
    try {
      const data = await updateProduct(kit);
      
      // Actualizar la lista de productos
      setProducts((prevProducts) =>
        prevProducts.map((p) =>
          p.id === kit.id ? { ...p, ...kit } : p
        )
      );

      await Swal.fire({
        icon: "success",
        title: "Kit actualizado",
        text: "El kit se ha actualizado correctamente",
        timer: 2000,
        showConfirmButton: false,
      });

      handleCloseKitModal();
      return data;
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: err?.response?.data?.error || 'Ocurrió un error, intenta más tarde',
        text: ``,
        timer: 3000,
        showConfirmButton: false,
      });
      console.error(err.response?.data?.error || err);
      throw err;
    }
  };

  const handleAddNew = () => {
    setProductsEdit(null);
    setShowAddForm(true);
  };

  const handleCloseForm = () => {
    setShowAddForm(false);
    setProductsEdit(null);
    inputRef.current?.focus();
  };

  const handleCloseKitModal = () => {
    setShowEditKitModal(false);
    setKitEdit(null);
    inputRef.current?.focus();
  };
  
  const handleDownloadPDF = async () => {
      if (products.length === 0) {
        Swal.fire({
          icon: "info",
          title: "No hay productos para descargar",
          timer: 1500,
          showConfirmButton: false,
        });
        return;
      }

      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();

      // 🔹 Logo (opcional)
      const logoDataUrl = ""; // tu logo opcional
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", 14, 10, 30, 15);
      }

      // 🔹 Título
      doc.setFontSize(18);
      doc.text("Catálogo de Productos", pageWidth / 2, 20, { align: "center" });

      // 🔹 Fecha
      doc.setFontSize(10);
      doc.text(`Fecha: ${new Date().toLocaleString()}`, pageWidth - 14, 20, { align: "right" });

      // 🔹 Columnas
      const tableColumn = ["Código", /*"Código de barras",*/ "Nombre", "Categoría", "Precio", "Costo"];

      // 🔹 Filas
      const tableRows = products.map((product) => [
        product.code,
       // "", // celda del código de barras
        product.name,
        product.category?.name || "",
        product.price.toFixed(2),
        product.cost.toFixed(2)
      ]);

      // 🔹 Crear tabla
      autoTable(doc, {
        startY: 30,
        head: [tableColumn],
        body: tableRows,
        /*styles: {
          fontSize: 9,
          cellPadding: { top: 10, bottom: 10 },
        },*/
        headStyles: {
          fillColor: [48, 133, 214],
          textColor: 255,
          fontStyle: "bold",
        },
        /*didDrawCell: (data) => {
          // ✅ Solo dibujar en el cuerpo, no en el encabezado
          if (data.section === "body" && data.column.index === 1) {
            const product = products[data.row.index];
            const canvas = document.createElement("canvas");
            JsBarcode(canvas, product.code, {
              format: "CODE128",
              width: 1.5,
              height: 30,
              displayValue: false,
            });
            const barcodeDataUrl = canvas.toDataURL("image/png");

            // Centrar dentro de la celda
            const imgWidth = 35;
            const imgHeight = 15;
            const xPos = data.cell.x + (data.cell.width - imgWidth) / 2;
            const yPos = data.cell.y + (data.cell.height - imgHeight) / 2;

            doc.addImage(barcodeDataUrl, "PNG", xPos, yPos, imgWidth, imgHeight);
          }
        },*/
        theme: "grid",
      });

      doc.save("catalogo_productos.pdf");
    };

  return (
    <div className="app-products-catalog">
      <div className="products-catalog-container">
        <Header
          title="Catálogo de Productos"
          onBack={onBack}
          backText="← Volver al Menu Principal"
          className="catalog-header"
        />

        <div className="catalog-content">
          {/* Sección de Filtros */}
          <Card className="catalog-filters-section">
            <div className="catalog-filters-header">
              <h3 className="catalog-section-title">
                <span className="section-icon">🔍</span>
                Filtros de Búsqueda
              </h3>
            </div>
            <div className="catalog-filters">
              <div className="catalog-filter-group">
                <label htmlFor="search" className="catalog-filter-label">
                  Buscar producto
                </label>
                <input
                  type="text"
                  ref={inputRef}
                  id="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nombre o descripción..."
                  className="catalog-search-input"
                />
              </div>

              <div className="catalog-filter-group">
                <label htmlFor="category" className="catalog-filter-label">
                  Categoría
                </label>
                <select
                  id="category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="catalog-category-select"
                >
                  <option value="">Todas las categorías</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="catalog-filter-group catalog-actions-group">
                <label className="catalog-filter-label" style={{ visibility: 'hidden' }}>
                  Acciones
                </label>
                <div className="catalog-actions-dropdown" ref={actionsMenuRef}>
                  <button
                    type="button"
                    ref={actionsToggleRef}
                    className="catalog-actions-toggle"
                    onClick={() => setShowActionsMenu(!showActionsMenu)}
                  >
                    <span className="btn-icon">⚙️</span>
                    <span className="btn-text">Acciones</span>
                    <span className={`dropdown-arrow ${showActionsMenu ? 'open' : ''}`}>
                      {menuDirection === 'up' ? '▲' : '▼'}
                    </span>
                  </button>
                  {showActionsMenu && (
                    <div className={`catalog-actions-menu menu-${menuDirection}`}>
                      <button
                        type="button"
                        className="catalog-menu-item catalog-menu-add"
                        onClick={() => {
                          handleAddNew();
                          setShowActionsMenu(false);
                        }}
                      >
                        <span className="menu-icon">➕</span>
                        <span className="menu-text">Agregar Producto</span>
                      </button>
                      <button
                        type="button"
                        className="catalog-menu-item catalog-menu-categories"
                        onClick={() => {
                          onCategories?.();
                          setShowActionsMenu(false);
                        }}
                      >
                        <span className="menu-icon">📂</span>
                        <span className="menu-text">Categorías</span>
                      </button>
                      <button
                        type="button"
                        className="catalog-menu-item catalog-menu-kit"
                        onClick={() => {
                          onCreateKit?.();
                          setShowActionsMenu(false);
                        }}
                      >
                        <span className="menu-icon">🏷️</span>
                        <span className="menu-text">Agregar Kit</span>
                      </button>
                      <button
                        type="button"
                        className="catalog-menu-item catalog-menu-download"
                        onClick={() => {
                          handleDownloadPDF();
                          setShowActionsMenu(false);
                        }}
                      >
                        <span className="menu-icon">📄</span>
                        <span className="menu-text">Descargar PDF</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
          {/* Grid de productos */}
          <div className="catalog-products-grid">
            {loading ? (
              <Card className="no-products-card">
                <div className="loader-container">
                      <div className="loader"></div>
                      <p>Cargando productos...</p>
                 </div>
              </Card>
            ) : products.length === 0 ? (
              <Card className="no-products-card">
                <h3>No se encontraron productos</h3>
                <p>Intenta ajustar los filtros de búsqueda</p>
              </Card>
            ) : ( products.map((product) => {
                return (
                  <Card
                    key={product.id}
                    className="catalog-product-card"
                    variant="product"
                  >
                    {/* Header con color y nombre */}
                    <div className="catalog-card-header-simple">
                      {product.icon && (
                        <div className="catalog-product-icon-simple">{product.icon}</div>
                      )}
                      <h3 className="catalog-product-name-simple" title={product.name}>
                        {product.name}
                      </h3>
                    </div>
                    
                    {/* Precios */}
                    <div className="catalog-card-content-simple">
                      <div className="catalog-pricing-simple">
                        <div className="price-item-simple">
                          <span className="price-label-simple">Precio</span>
                          <span className="price-value-simple">${product.price.toFixed(2)}</span>
                        </div>
                        {product.cost && product.cost > 0 && (
                          <div className="price-item-simple">
                            <span className="price-label-simple">Costo</span>
                            <span className="price-value-simple cost-value-simple">${product.cost.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer con acciones */}
                    <div className="catalog-card-footer-simple">
                      <button
                        type="button"
                        className="catalog-action-btn-simple catalog-edit-btn-simple"
                        onClick={() => onEdit(product)}
                        title="Editar producto"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className="catalog-action-btn-simple catalog-delete-btn-simple"
                        onClick={() => handleDelete(product.id)}
                        title="Eliminar producto"
                      >
                        🗑️
                      </button>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
        {/* Modal para agregar/editar productos */}
        <NewEditProductModal
          isOpen={showAddForm}
          onClose={handleCloseForm}
          onSave={handleSave}
          product={productsEdit}
          title={"Producto"}
        />
        
        {/* Modal para editar kits */}
        <EditKitModal
          isOpen={showEditKitModal}
          onClose={handleCloseKitModal}
          onSave={handleSaveKit}
          kit={kitEdit}
        />
      </div>
    </div>
  );
};

export default CatalogPage;
