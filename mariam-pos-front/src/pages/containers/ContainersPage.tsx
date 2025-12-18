import { useState, useEffect, useRef } from "react";
import Header from "../../components/Header";
import Swal from "sweetalert2";
import {
  getContainers,
  createContainer,
  updateContainer,
  deleteContainer,
  type Container,
  type CreateContainerInput,
} from "../../api/containers";
import { getProductsFilters } from "../../api/products";
import type { Product, ProductPresentation } from "../../types/index";
import "../../styles/pages/containers/containers.css";

interface ContainersPageProps {
  onBack: () => void;
}

export default function ContainersPage({ onBack }: ContainersPageProps) {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingContainer, setEditingContainer] = useState<Container | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Form states
  const [formData, setFormData] = useState<CreateContainerInput>({
    name: "",
    quantity: 1, // Siempre será 1
    importAmount: 0,
    productId: undefined,
    presentationId: undefined,
    notes: "",
    status: 1, // null = activo por defecto
  });

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Estados para búsqueda de productos en el modal
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const productSearchRef = useRef<HTMLInputElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      const data = await getProductsFilters(productSearchTerm);
      setFilteredProducts(data);
      setShowProductDropdown(data.length > 0);
    } catch (error) {
      console.error("Error al buscar productos:", error);
      setFilteredProducts([]);
      setShowProductDropdown(false);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Búsqueda de productos con debounce
  useEffect(() => {
    if (productSearchTerm.length > 2) {
      const handler = setTimeout(() => {
        fetchProducts();
      }, 300);
      return () => clearTimeout(handler);
    } else if (productSearchTerm.length === 0) {
      setFilteredProducts([]);
      setShowProductDropdown(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productSearchTerm]);

  // Cerrar dropdown al hacer click fuera
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

    if (showProductDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showProductDropdown]);

  const loadData = async () => {
    try {
      setLoading(true);
      const containersData = await getContainers();
      setContainers(containersData);
    } catch (error) {
      console.error("Error al cargar datos:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar los datos",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = async (container?: Container) => {
    if (container) {
      setEditingContainer(container);
      // Convertir status a número o null (null o != 0 = activo, 0 = inactivo)
      const containerStatus = container.status !== undefined ? container.status : (container.isActive ? 1 : 0);
      setFormData({
        name: container.name,
        quantity: 1, // Siempre será 1
        importAmount: container.importAmount,
        productId: container.productId || undefined,
        presentationId: container.presentationId || undefined,
        notes: container.notes || "",
        status: containerStatus,
      });
      if (container.productId && container.product) {
        // Si tenemos el producto completo del container, usarlo directamente
        setSelectedProduct(container.product);
        setProductSearchTerm(container.product.name);
      } else if (container.productId) {
        // Si solo tenemos el ID pero no el producto completo, dejar el campo vacío
        // El usuario puede buscar el producto manualmente
        setProductSearchTerm("");
        setSelectedProduct(null);
      }
    } else {
      setEditingContainer(null);
      setFormData({
        name: "",
        quantity: 1, // Siempre será 1
        importAmount: 0,
        productId: undefined,
        presentationId: undefined,
        notes: "",
        status: null, // null = activo por defecto
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

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setProductSearchTerm(product.name);
    setFormData({
      ...formData,
      productId: product.id,
      presentationId: undefined, // Reset presentation when product changes
    });
    setFilteredProducts([]);
    setShowProductDropdown(false);
  };

  const handleProductSearchChange = (value: string) => {
    setProductSearchTerm(value);
    if (value === "") {
      setSelectedProduct(null);
      setFormData({
        ...formData,
        productId: undefined,
        presentationId: undefined,
      });
      setFilteredProducts([]);
      setShowProductDropdown(false);
    }
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
        Swal.fire({
          icon: "success",
          title: "¡Actualizado!",
          text: "El envase se actualizó correctamente",
          timer: 1500,
        });
      } else {
        await createContainer(formData);
        Swal.fire({
          icon: "success",
          title: "¡Creado!",
          text: "El envase se creó correctamente",
          timer: 1500,
        });
      }
      handleCloseModal();
      loadData();
    } catch (error) {
      console.error("Error al guardar envase:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : (error as { response?: { data?: { error?: string } } })?.response?.data?.error || "No se pudo guardar el envase";
      Swal.fire({
        icon: "error",
        title: "Error",
        text: errorMessage,
      });
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
        Swal.fire({
          icon: "success",
          title: "¡Eliminado!",
          text: "El envase se eliminó correctamente",
          timer: 1500,
        });
        loadData();
      } catch (error) {
        console.error("Error al eliminar envase:", error);
        const errorMessage = error instanceof Error 
          ? error.message 
          : (error as { response?: { data?: { error?: string } } })?.response?.data?.error || "No se pudo eliminar el envase";
        Swal.fire({
          icon: "error",
          title: "Error",
          text: errorMessage,
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const filteredContainers = containers.filter((container) =>
    container.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    container.product?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAvailablePresentations = (): ProductPresentation[] => {
    if (!selectedProduct || !selectedProduct.presentations) return [];
    // Incluir TODAS las presentaciones, incluyendo la base (isDefault)
    return selectedProduct.presentations;
  };

  return (
    <div className="containers-page">
      <div className="containers-header-wrapper">
        <Header
          title="🍺 Envases Retornables"
          onBack={onBack}
          backText="← Volver al Menu Principal"
        />
      </div>

      <div className="containers-content">
        {/* Barra de búsqueda y acciones */}
        <div className="containers-header">
          <div className="search-container">
            <input
              type="text"
              placeholder="🔍 Buscar envases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <button
            className="btn touch-btn add-container-btn"
            onClick={() => handleOpenModal()}
            disabled={loading}
          >
            <span className="btn-icon">➕</span>
            <span>Nuevo Envase</span>
          </button>
        </div>

        {/* Lista de envases */}
        {loading && containers.length === 0 ? (
          <div className="loading-container">
            <p>Cargando envases...</p>
          </div>
        ) : filteredContainers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🍺</div>
            <h3>No hay envases registrados</h3>
            <p>Crea tu primer envase retornable</p>
            <button
              className="btn touch-btn primary-btn"
              onClick={() => handleOpenModal()}
            >
              Crear Envase
            </button>
          </div>
        ) : (
          <div className="containers-grid">
            {filteredContainers.map((container) => (
              <div key={container.id} className="container-card">
                <div className="container-header">
                  <h3 className="container-name">{container.name}</h3>
                  <div className="container-actions">
                    <button
                      className="icon-btn edit-btn"
                      onClick={() => handleOpenModal(container)}
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      className="icon-btn delete-btn"
                      onClick={() => handleDelete(container)}
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="container-info">
                  <div className="info-row">
                    <span className="info-label">Importe:</span>
                    <span className="info-value amount">
                      ${container.importAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Estado:</span>
                    <span className={`info-value badge ${(container.status === null || container.status !== 0) ? 'status-active' : 'status-inactive'}`}>
                      {(container.status === null || container.status !== 0) ? '✅ Activo' : '❌ Inactivo'}
                    </span>
                  </div>
                  {container.product && (
                    <div className="info-row">
                      <span className="info-label">Producto:</span>
                      <span className="info-value product-name">
                        {container.product.name}
                      </span>
                    </div>
                  )}
                  {container.presentation && (
                    <div className="info-row">
                      <span className="info-label">Presentación:</span>
                      <span className="info-value">
                        {container.presentation.name}
                      </span>
                    </div>
                  )}
                  {!container.product && (
                    <div className="info-row">
                      <span className="info-label">Tipo:</span>
                      <span className="info-value badge">Sin producto</span>
                    </div>
                  )}
                </div>

                {container.notes && (
                  <div className="container-notes">
                    <p>{container.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de creación/edición */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingContainer ? "Editar Envase" : "Nuevo Envase"}</h2>
              <button className="close-btn" onClick={handleCloseModal}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="container-form">
              <div className="form-group">
                <label htmlFor="name">Nombre del Envase *</label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Ej: Coca Vidrio, Rega Cerveza"
                  required
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="importAmount">Importe del Envase *</label>
                <input
                  id="importAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.importAmount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      importAmount: parseFloat(e.target.value) || 0,
                    })
                  }
                  required
                  className="form-input"
                  placeholder="Ej: 5.00"
                />
              </div>

              <div className="form-group">
                <label htmlFor="productId">Producto (Opcional)</label>
                <div style={{ position: "relative" }}>
                  <input
                    ref={productSearchRef}
                    id="productId"
                    type="text"
                    value={productSearchTerm}
                    onChange={(e) => handleProductSearchChange(e.target.value)}
                    onFocus={() => {
                      if (filteredProducts.length > 0) {
                        setShowProductDropdown(true);
                      }
                    }}
                    placeholder="Buscar producto..."
                    className="form-input"
                  />
                  {loadingProducts && (
                    <span style={{ 
                      position: "absolute", 
                      right: "10px", 
                      top: "50%", 
                      transform: "translateY(-50%)",
                      color: "#6b7280",
                      fontSize: "0.85rem"
                    }}>
                      Buscando...
                    </span>
                  )}
                  {showProductDropdown && filteredProducts.length > 0 && (
                    <div
                      ref={productDropdownRef}
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        backgroundColor: "white",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                        maxHeight: "200px",
                        overflowY: "auto",
                        zIndex: 1000,
                        marginTop: "4px",
                      }}
                    >
                      {filteredProducts.map((product) => (
                        <div
                          key={product.id}
                          onClick={() => handleProductSelect(product)}
                          style={{
                            padding: "12px 16px",
                            cursor: "pointer",
                            borderBottom: "1px solid #f3f4f6",
                            transition: "background-color 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#f9fafb";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "white";
                          }}
                        >
                          <div style={{ fontWeight: 600, color: "#1f2937" }}>
                            {product.name}
                          </div>
                          {product.code && (
                            <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: "4px" }}>
                              Código: {product.code}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedProduct && (
                  <small style={{ display: "block", marginTop: "4px", color: "#059669", fontSize: "0.85rem" }}>
                    ✓ Producto seleccionado: {selectedProduct.name}
                  </small>
                )}
              </div>

              {selectedProduct && getAvailablePresentations().length > 0 && (
                <div className="form-group">
                  <label htmlFor="presentationId">Presentación (Opcional)</label>
                  <select
                    id="presentationId"
                    value={formData.presentationId || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        presentationId: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                    className="form-select"
                  >
                    <option value="">Sin presentación (Base)</option>
                    {getAvailablePresentations().map((presentation) => (
                      <option key={presentation.id} value={presentation.id}>
                        {presentation.name} ({presentation.quantity} unidades)
                        {presentation.isDefault ? " - Base" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="status">Estado *</label>
                <select
                  id="status"
                  value={formData.status === null ? "1" : formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value === "" ? null : parseInt(e.target.value),
                    })
                  }
                  className="form-select"
                  required
                >
                  <option value="1">Activo</option>
                  <option value="0">Inactivo</option>
                </select>
                <small className="form-hint">
                  Los envases inactivos no se validarán en las ventas
                </small>
              </div>

              <div className="form-group">
                <label htmlFor="notes">Notas</label>
                <textarea
                  id="notes"
                  value={formData.notes || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Información adicional sobre el envase..."
                  rows={3}
                  className="form-textarea"
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn touch-btn cancel-btn"
                  onClick={handleCloseModal}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn touch-btn submit-btn"
                  disabled={loading}
                >
                  {loading
                    ? "Guardando..."
                    : editingContainer
                    ? "Actualizar"
                    : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

