import { useState, useEffect } from "react";
import Header from "../../components/Header";
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
import type { Product, ProductPresentation } from "../../types/index";
import "../../styles/pages/containers/containers.css";

interface ContainersPageProps {
  onBack: () => void;
}

export default function ContainersPage({ onBack }: ContainersPageProps) {
  const [containers, setContainers] = useState<Container[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
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
    status: null, // null = activo por defecto
  });

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [containersData, productsData] = await Promise.all([
        getContainers(), // Cargar todos los envases (activos e inactivos) para el catálogo
        getProductsForSelector(),
      ]);
      setContainers(containersData);
      setProducts(productsData);
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

  const handleOpenModal = (container?: Container) => {
    if (container) {
      setEditingContainer(container);
      // Convertir status a número o null (null o != 0 = activo, 0 = inactivo)
      const containerStatus = container.status !== undefined ? container.status : (container.isActive ? null : 0);
      setFormData({
        name: container.name,
        quantity: 1, // Siempre será 1
        importAmount: container.importAmount,
        productId: container.productId || undefined,
        presentationId: container.presentationId || undefined,
        notes: container.notes || "",
        status: containerStatus,
      });
      if (container.productId) {
        const product = products.find((p) => p.id === container.productId);
        setSelectedProduct(product || null);
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
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingContainer(null);
    setSelectedProduct(null);
  };

  const handleProductChange = (productId: string) => {
    const product = products.find((p) => p.id === parseInt(productId));
    setSelectedProduct(product || null);
    setFormData({
      ...formData,
      productId: productId ? parseInt(productId) : undefined,
      presentationId: undefined, // Reset presentation when product changes
    });
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
    } catch (error: any) {
      console.error("Error al guardar envase:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.error || "No se pudo guardar el envase",
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
      } catch (error: any) {
        console.error("Error al eliminar envase:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.response?.data?.error || "No se pudo eliminar el envase",
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
    return selectedProduct.presentations.filter((p) => !p.isDefault);
  };

  return (
    <div className="containers-page">
      <div className="containers-header-wrapper">
        <Header
          title="🍺 Envases Retornables"
          onBack={onBack}
          backText="← Volver"
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
                <select
                  id="productId"
                  value={formData.productId || ""}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="form-select"
                >
                  <option value="">Sin producto</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
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
                    <option value="">Sin presentación</option>
                    {getAvailablePresentations().map((presentation) => (
                      <option key={presentation.id} value={presentation.id}>
                        {presentation.name} ({presentation.quantity} unidades)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="status">Estado *</label>
                <select
                  id="status"
                  value={formData.status === null ? "" : formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value === "" ? null : parseInt(e.target.value),
                    })
                  }
                  className="form-select"
                  required
                >
                  <option value="">Activo</option>
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

