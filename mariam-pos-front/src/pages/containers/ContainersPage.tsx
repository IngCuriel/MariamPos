import { useState, useEffect, useRef, useMemo } from "react";
import Header from "../../components/Header";
import Card from "../../components/Card";
import Swal from "sweetalert2";
import {
  getContainers,
  createContainer,
  updateContainer,
  deleteContainer,
  getProductsForSelector,
  type Container,
  type CreateContainerInput,
} from "../../api/containers";
import { getProductsFilters } from "../../api/products";
import type { Product, ProductPresentation } from "../../types/index";
// Reutilizamos los estilos de layout del catálogo (filtros, tabla, paginación).
import "../../styles/pages/products/catalog.css";
import "../../styles/pages/containers/containers.css";

interface ContainersPageProps {
  onBack: () => void;
}

const ITEMS_PER_PAGE = 25;

const isActiveStatus = (c: Container) => c.status === null || c.status !== 0;

export default function ContainersPage({ onBack }: ContainersPageProps) {
  const [containers, setContainers] = useState<Container[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingContainer, setEditingContainer] = useState<Container | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Form states
  const [formData, setFormData] = useState<CreateContainerInput>({
    name: "",
    quantity: 1,
    importAmount: 0,
    productId: undefined,
    presentationId: undefined,
    notes: "",
    status: 1,
  });

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Búsqueda de productos dentro del modal
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const productSearchRef = useRef<HTMLInputElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
    searchRef.current?.focus();
  }, []);

  const fetchProductsByFilter = async () => {
    try {
      setLoadingProducts(true);
      const data = await getProductsFilters(productSearchTerm);
      setFilteredProducts(data);
      if (data.length > 0) setShowProductDropdown(true);
    } catch (error) {
      console.error("Error al buscar productos:", error);
      setFilteredProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      if (productSearchTerm.length > 2) {
        fetchProductsByFilter();
      } else {
        setFilteredProducts([]);
        setShowProductDropdown(false);
      }
    }, 300);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productSearchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        productDropdownRef.current &&
        !productDropdownRef.current.contains(event.target as Node) &&
        productSearchRef.current &&
        !productSearchRef.current.contains(event.target as Node)
      ) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleProductSearchChange = (value: string) => {
    setProductSearchTerm(value);
    if (value.length <= 2) {
      setFilteredProducts([]);
      setShowProductDropdown(false);
    }
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setProductSearchTerm(product.name);
    setFormData({ ...formData, productId: product.id, presentationId: undefined });
    setShowProductDropdown(false);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [containersData, productsData] = await Promise.all([
        getContainers(),
        getProductsForSelector(),
      ]);
      setContainers(containersData);
      setProducts(productsData);
    } catch (error) {
      console.error("Error al cargar datos:", error);
      Swal.fire({ icon: "error", title: "Error", text: "No se pudieron cargar los datos" });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (container?: Container) => {
    if (container) {
      setEditingContainer(container);
      const containerStatus =
        container.status !== undefined ? container.status : container.isActive ? 1 : 0;
      setFormData({
        name: container.name,
        quantity: 1,
        importAmount: container.importAmount,
        productId: container.productId || undefined,
        presentationId: container.presentationId || undefined,
        notes: container.notes || "",
        status: containerStatus,
      });
      if (container.productId && container.product) {
        setSelectedProduct(container.product);
        setProductSearchTerm(container.product.name);
      } else if (container.productId) {
        const product = products.find((p) => p.id === container.productId);
        if (product) {
          setSelectedProduct(product);
          setProductSearchTerm(product.name);
        } else {
          setSelectedProduct(null);
          setProductSearchTerm("");
        }
      } else {
        setSelectedProduct(null);
        setProductSearchTerm("");
      }
    } else {
      setEditingContainer(null);
      setFormData({
        name: "",
        quantity: 1,
        importAmount: 0,
        productId: undefined,
        presentationId: undefined,
        notes: "",
        status: null,
      });
      setSelectedProduct(null);
      setProductSearchTerm("");
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingContainer(null);
    setSelectedProduct(null);
    setProductSearchTerm("");
    setFilteredProducts([]);
    setShowProductDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.importAmount) {
      Swal.fire({
        icon: "warning",
        title: "Datos incompletos",
        text: "Por favor completa todos los campos requeridos",
      });
      return;
    }

    try {
      setLoading(true);
      if (editingContainer) {
        await updateContainer(editingContainer.id, formData);
        Swal.fire({ icon: "success", title: "¡Actualizado!", text: "El envase se actualizó correctamente", timer: 1500 });
      } else {
        await createContainer(formData);
        Swal.fire({ icon: "success", title: "¡Creado!", text: "El envase se creó correctamente", timer: 1500 });
      }
      handleCloseModal();
      loadData();
    } catch (error: unknown) {
      console.error("Error al guardar envase:", error);
      const errorMessage =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      Swal.fire({ icon: "error", title: "Error", text: errorMessage || "No se pudo guardar el envase" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (container: Container) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar envase?",
      text: `¿Estás seguro de eliminar "${container.name}"?`,
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });

    if (result.isConfirmed) {
      try {
        setLoading(true);
        await deleteContainer(container.id);
        Swal.fire({ icon: "success", title: "¡Eliminado!", text: "El envase se eliminó correctamente", timer: 1500 });
        loadData();
      } catch (error: unknown) {
        console.error("Error al eliminar envase:", error);
        const errorMessage =
          error && typeof error === "object" && "response" in error
            ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
            : undefined;
        Swal.fire({ icon: "error", title: "Error", text: errorMessage || "No se pudo eliminar el envase" });
      } finally {
        setLoading(false);
      }
    }
  };

  // Filtrado en cliente + reset a página 1 al buscar.
  const filteredContainers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return containers;
    return containers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.product?.name.toLowerCase().includes(term)
    );
  }, [containers, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalItems = filteredContainers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * ITEMS_PER_PAGE;
  const pageContainers = filteredContainers.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  const getAvailablePresentations = (): ProductPresentation[] => {
    if (!selectedProduct || !selectedProduct.presentations) return [];
    return selectedProduct.presentations;
  };

  return (
    <div className="containers-page">
      <Header title="🍺 Envases Retornables" onBack={onBack} backText="← Volver al Menú Principal" />

      <div className="catalog-content containers-content">
        {/* Sección de Filtros (mismo bloque que el catálogo) */}
        <Card className="catalog-filters-section">
          <div className="catalog-filters">
            <div className="catalog-filter-group">
              <label htmlFor="cnt-search" className="catalog-filter-label">
                Buscar
              </label>
              <input
                ref={searchRef}
                id="cnt-search"
                type="text"
                placeholder="Nombre del envase o producto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="catalog-search-input"
              />
            </div>

            <div className="catalog-filter-group catalog-actions-group">
              <button type="button" className="cnt-add-btn" onClick={() => handleOpenModal()}>
                ➕ Nuevo Envase
              </button>
            </div>
          </div>
        </Card>

        {/* Tabla de envases */}
        <Card className="catalog-table-card cnt-table-card">
          <div className="cnt-table-container">
            {loading && containers.length === 0 ? (
              <div className="loading-container">Cargando envases...</div>
            ) : pageContainers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🍺</div>
                <h3>{searchTerm ? "Sin resultados" : "No hay envases registrados"}</h3>
                <p>{searchTerm ? "Probá con otro término" : "Creá tu primer envase retornable"}</p>
              </div>
            ) : (
              <table className="cnt-table">
                <thead>
                  <tr>
                    <th className="cnt-th-num">#</th>
                    <th>Envase</th>
                    <th className="cnt-th-right">Importe</th>
                    <th>Producto</th>
                    <th>Presentación</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pageContainers.map((container, index) => {
                    const active = isActiveStatus(container);
                    return (
                      <tr key={container.id}>
                        <td className="cnt-td-num">{pageStart + index + 1}</td>
                        <td>
                          <span className="cnt-name">{container.name}</span>
                        </td>
                        <td className="cnt-td-right">
                          <span className="cnt-import">${container.importAmount.toFixed(2)}</span>
                        </td>
                        <td>
                          {container.product ? (
                            <span className="cnt-product">{container.product.name}</span>
                          ) : (
                            <span className="cnt-muted">Sin producto</span>
                          )}
                        </td>
                        <td>
                          {container.presentation ? (
                            container.presentation.name
                          ) : (
                            <span className="cnt-muted">Base</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`cnt-status-badge ${
                              active ? "cnt-status-badge--active" : "cnt-status-badge--inactive"
                            }`}
                          >
                            {active ? "✅ Activo" : "❌ Inactivo"}
                          </span>
                        </td>
                        <td>
                          <div className="cnt-actions">
                            <button
                              type="button"
                              className="cnt-action cnt-action--edit"
                              onClick={() => handleOpenModal(container)}
                            >
                              ✏️ Editar
                            </button>
                            <button
                              type="button"
                              className="cnt-action cnt-action--delete"
                              onClick={() => handleDelete(container)}
                            >
                              🗑️ Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Footer con paginación */}
        {totalItems > 0 && (
          <div className="cnt-footer-bar">
            <button
              type="button"
              className="prod-page-btn"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safePage === 1}
            >
              ← Anterior
            </button>
            <span className="prod-page-info">
              Página {safePage} de {totalPages} · {totalItems.toLocaleString("es-MX")} envase(s)
            </span>
            <button
              type="button"
              className="prod-page-btn"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safePage === totalPages}
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {/* Modal de creación/edición */}
      {showModal && (
        <div className="cnt-form-overlay" onClick={handleCloseModal}>
          <div className="cnt-form-panel" onClick={(e) => e.stopPropagation()}>
            <div className="cnt-form-header">
              <h1>{editingContainer ? "Editar Envase" : "Nuevo Envase"}</h1>
              <button type="button" className="cnt-form-close" onClick={handleCloseModal}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="cnt-form" id="cnt-form">
              <div className="cnt-form-row">
                <div className="cnt-form-group">
                  <label htmlFor="name">
                    Nombre del envase <span className="cnt-form-required">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Coca Vidrio, Reja Cerveza"
                    required
                  />
                </div>

                <div className="cnt-form-group">
                  <label htmlFor="importAmount">
                    Importe del envase <span className="cnt-form-required">*</span>
                  </label>
                  <input
                    id="importAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.importAmount}
                    onChange={(e) =>
                      setFormData({ ...formData, importAmount: parseFloat(e.target.value) || 0 })
                    }
                    required
                    placeholder="Ej: 5.00"
                  />
                </div>
              </div>

              <div className="cnt-form-group">
                <label htmlFor="productId">Producto (opcional)</label>
                <div className="cnt-prod-search" ref={productDropdownRef}>
                  <input
                    ref={productSearchRef}
                    id="productId"
                    type="text"
                    value={productSearchTerm}
                    onChange={(e) => handleProductSearchChange(e.target.value)}
                    onFocus={() => {
                      if (filteredProducts.length > 0) setShowProductDropdown(true);
                    }}
                    placeholder="Buscar producto..."
                  />
                  {loadingProducts && <span className="cnt-prod-loading">Cargando...</span>}
                  {showProductDropdown && filteredProducts.length > 0 && (
                    <div className="cnt-prod-dropdown">
                      {filteredProducts.map((product) => (
                        <div
                          key={product.id}
                          className="cnt-prod-item"
                          onClick={() => handleProductSelect(product)}
                        >
                          <strong>{product.name}</strong> <span>({product.code})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {selectedProduct && getAvailablePresentations().length > 0 && (
                <div className="cnt-form-group">
                  <label htmlFor="presentationId">Presentación (opcional)</label>
                  <select
                    id="presentationId"
                    value={formData.presentationId || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        presentationId: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                  >
                    <option value="">Sin presentación (Base)</option>
                    {getAvailablePresentations().map((presentation) => (
                      <option key={presentation.id} value={presentation.id}>
                        {presentation.name} ({presentation.quantity} unidades){" "}
                        {presentation.isDefault && "(Base)"}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="cnt-form-group">
                <label htmlFor="status">
                  Estado <span className="cnt-form-required">*</span>
                </label>
                <select
                  id="status"
                  value={formData.status === null ? "1" : formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value === "" ? null : parseInt(e.target.value),
                    })
                  }
                  required
                >
                  <option value="1">Activo</option>
                  <option value="0">Inactivo</option>
                </select>
                <span className="cnt-form-hint">
                  Los envases inactivos no se validarán en las ventas
                </span>
              </div>

              <div className="cnt-form-group">
                <label htmlFor="notes">Notas</label>
                <textarea
                  id="notes"
                  value={formData.notes || ""}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Información adicional sobre el envase..."
                  rows={2}
                />
              </div>
            </form>

            <div className="cnt-form-actions">
              <button type="button" className="cnt-btn cnt-btn--ghost" onClick={handleCloseModal}>
                Cancelar
              </button>
              <button type="submit" form="cnt-form" className="cnt-btn cnt-btn--success" disabled={loading}>
                {loading ? "Guardando..." : editingContainer ? "💾 Actualizar" : "💾 Crear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
