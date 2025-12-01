import React, { useState, useEffect, useRef } from "react";
import Header from "../../components/Header";
import Button from "../../components/Button";
import Card from "../../components/Card";
import type { Product, Category, KitItem } from "../../types/index";
import { getCategories } from "../../api/categories";
import { getProductsFilters, getProductsByCategoryId } from "../../api/products";
import { createProduct } from "../../api/products";
import Swal from "sweetalert2";
import "../../styles/pages/products/newproductpage.css";
import "../../styles/pages/products/productModal.css";
import "./NewKitPage.css";

interface NewKitPageProps {
  onBack: () => void;
}

const NewKitPage: React.FC<NewKitPageProps> = ({ onBack }) => {
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    status: 1,
    price: 0,
    cost: 0,
    category: "",
  });
  const [status, setStatus] = useState<number>(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [kitItems, setKitItems] = useState<KitItem[]>([]);
  const [searchProduct, setSearchProduct] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedPresentationId, setSelectedPresentationId] = useState<string>("");
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const inputRefs = useRef<(HTMLInputElement | HTMLTextAreaElement | null)[]>([]);

  useEffect(() => {
    fetchCategories();
    // No cargar todos los productos al inicio, solo cuando se busque
  }, []);

  // Búsqueda con debounce
  useEffect(() => {
    if (searchProduct.length > 2) {
      const handler = setTimeout(() => {
        fetchProductsByFilter();
      }, 300);
      return () => clearTimeout(handler);
    } else if (searchProduct.length === 0 && selectedCategoryFilter === "") {
      setFilteredProducts([]);
    }
  }, [searchProduct]);

  // Filtro por categoría
  useEffect(() => {
    if (selectedCategoryFilter) {
      fetchProductsByCategory();
    } else if (searchProduct.length === 0) {
      setFilteredProducts([]);
    }
  }, [selectedCategoryFilter]);

  const fetchCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.log("Error", error);
    }
  };

  const fetchProductsByFilter = async () => {
    try {
      setLoadingProducts(true);
      const data = await getProductsFilters(searchProduct);
      // Filtrar solo productos que NO son kits
      const regularProducts = data.filter(p => !p.isKit);
      setFilteredProducts(regularProducts);
    } catch (error) {
      console.log("Error", error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchProductsByCategory = async () => {
    try {
      setLoadingProducts(true);
      const data = await getProductsByCategoryId(selectedCategoryFilter);
      // Filtrar solo productos que NO son kits
      const regularProducts = data.filter(p => !p.isKit);
      setFilteredProducts(regularProducts);
    } catch (error) {
      console.log("Error", error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProductId(product.id.toString());
    setSelectedPresentationId(""); // Reset presentation
  };

  const handleAddProductToKit = () => {
    if (!selectedProductId) {
      Swal.fire({
        icon: "warning",
        title: "Selecciona un producto",
        text: "Debes seleccionar un producto para agregarlo al kit",
        timer: 2000,
        showConfirmButton: false,
      });
      return;
    }

    const product = filteredProducts.find((p) => p.id === parseInt(selectedProductId));
    if (!product) return;

    // Verificar si el producto ya está en el kit
    const existingItem = kitItems.find(
      (item) =>
        item.productId === product.id &&
        item.presentationId === (selectedPresentationId ? parseInt(selectedPresentationId) : undefined)
    );

    if (existingItem) {
      Swal.fire({
        icon: "warning",
        title: "Producto duplicado",
        text: "Este producto ya está en el kit",
        timer: 2000,
        showConfirmButton: false,
      });
      return;
    }

    // Determinar el precio unitario
    let unitPrice = product.price;
    if (selectedPresentationId) {
      const presentation = product.presentations?.find(
        (p) => p.id === parseInt(selectedPresentationId)
      );
      if (presentation) {
        unitPrice = presentation.unitPrice;
      }
    }

    const newItem: KitItem = {
      productId: product.id,
      product: product,
      presentationId: selectedPresentationId ? parseInt(selectedPresentationId) : undefined,
      presentation: selectedPresentationId
        ? product.presentations?.find((p) => p.id === parseInt(selectedPresentationId))
        : undefined,
      quantity: itemQuantity,
      displayOrder: kitItems.length,
    };

    setKitItems([...kitItems, newItem]);
    setSelectedProductId("");
    setSelectedPresentationId("");
    setItemQuantity(1);
    setSearchProduct("");
    setSelectedCategoryFilter("");
    setFilteredProducts([]);
    
    // Calcular y actualizar el costo automáticamente
    const newKitItems = [...kitItems, newItem];
    const totalCost = newKitItems.reduce((total, item) => {
      const productCost = item.product?.cost || 0;
      return total + productCost * item.quantity;
    }, 0);
    setFormData(prev => ({ ...prev, cost: totalCost }));
    
    searchInputRef.current?.focus();
  };

  const handleRemoveItem = (index: number) => {
    const updated = kitItems.filter((_, i) => i !== index);
    setKitItems(updated);
    
    // Recalcular el costo automáticamente
    const totalCost = updated.reduce((total, item) => {
      const productCost = item.product?.cost || 0;
      return total + productCost * item.quantity;
    }, 0);
    setFormData(prev => ({ ...prev, cost: totalCost }));
  };

  const handleUpdateItemQuantity = (index: number, quantity: number) => {
    const updated = [...kitItems];
    updated[index].quantity = quantity;
    setKitItems(updated);
    
    // Recalcular el costo automáticamente
    const totalCost = updated.reduce((total, item) => {
      const productCost = item.product?.cost || 0;
      return total + productCost * item.quantity;
    }, 0);
    setFormData(prev => ({ ...prev, cost: totalCost }));
  };

  const calculateTotalIndividual = (): number => {
    return kitItems.reduce((total, item) => {
      let unitPrice = item.product?.price || 0;
      if (item.presentationId && item.product?.presentations) {
        const presentation = item.product.presentations.find(
          (p) => p.id === item.presentationId
        );
        if (presentation) {
          unitPrice = presentation.unitPrice;
        }
      }
      return total + unitPrice * item.quantity;
    }, 0);
  };

  const calculateTotalCost = (): number => {
    return kitItems.reduce((total, item) => {
      // El costo del producto (si no tiene presentación, usar el costo del producto)
      // Si tiene presentación, necesitamos calcular el costo unitario de la presentación
      // Por ahora, usamos el costo del producto base multiplicado por la cantidad
      const productCost = item.product?.cost || 0;
      return total + productCost * item.quantity;
    }, 0);
  };

  const calculateSavings = (): number => {
    const totalIndividual = calculateTotalIndividual();
    const kitPrice = parseFloat(formData.price.toString()) || 0;
    return totalIndividual - kitPrice;
  };

  const calculateSavingsPercentage = (): number => {
    const totalIndividual = calculateTotalIndividual();
    if (totalIndividual === 0) return 0;
    const savings = calculateSavings();
    return (savings / totalIndividual) * 100;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "El nombre es requerido";
    }

    if (!formData.price || parseFloat(formData.price.toString()) <= 0) {
      newErrors.price = "El precio debe ser mayor a 0";
    }

    if (!formData.category) {
      newErrors.category = "La categoría es requerida";
    }

    if (kitItems.length < 2) {
      newErrors.kitItems = "Un kit debe contener al menos 2 productos";
    }

    // Validar que el precio del kit sea menor que la suma individual
    const totalIndividual = calculateTotalIndividual();
    const kitPrice = parseFloat(formData.price.toString()) || 0;
    if (kitPrice >= totalIndividual) {
      newErrors.price = `El precio del kit debe ser menor a $${totalIndividual.toFixed(2)} (suma individual)`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const productData: Omit<Product, "id"> = {
        code: formData.code.trim() || null,
        name: formData.name.trim(),
        status: status,
        saleType: "Pieza",
        price: parseFloat(formData.price.toString()),
        cost: parseFloat(formData.cost.toString()) || 0,
        icon: "", // Sin icono para kits
        description: "",
        categoryId: formData.category,
        trackInventory: false,
        isKit: true,
        kitItems: kitItems.map((item) => ({
          productId: item.productId,
          presentationId: item.presentationId,
          quantity: item.quantity,
          displayOrder: item.displayOrder || 0,
        })),
      };

      await createProduct(productData);

      await Swal.fire({
        icon: "success",
        title: "Kit creado",
        text: "El kit se ha creado correctamente",
        timer: 2000,
        showConfirmButton: false,
      });

      onBack();
    } catch (error: any) {
      console.error("Error al crear kit:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error?.response?.data?.error || "Error al crear el kit",
        confirmButtonText: "Entendido",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = filteredProducts.find(
    (p) => p.id === parseInt(selectedProductId)
  );

  const totalIndividual = calculateTotalIndividual();
  const savings = calculateSavings();
  const savingsPercentage = calculateSavingsPercentage();

  return (
    <div className="new-kit-page">
      <div className="new-kit-container">
        <Header
          title="📦 Crear Kit/Combo"
          onBack={onBack}
          backText="← Volver"
          className="new-kit-header"
        />

        <div className="new-kit-content">
          {/* Información básica del kit */}
          <Card className="kit-form-card">
            <h2 className="section-title">Información del Kit</h2>
            <form onSubmit={handleSubmit} className="kit-form">
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="name">Nombre del Kit *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={errors.name ? "error" : ""}
                    placeholder="Ej: Combo Navideño"
                    ref={(el) => (inputRefs.current[0] = el)}
                  />
                  {errors.name && <span className="error-message">{errors.name}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="category">Categoría *</label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className={errors.category ? "error" : ""}
                  >
                    <option value="">Selecciona una categoría</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {errors.category && (
                    <span className="error-message">{errors.category}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="price">Precio del Kit *</label>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    className={errors.price ? "error" : ""}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                  {errors.price && <span className="error-message">{errors.price}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="cost">Costo del Kit</label>
                  <input
                    type="number"
                    id="cost"
                    name="cost"
                    value={formData.cost}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    readOnly={kitItems.length > 0} // Solo lectura si hay productos (se calcula automáticamente)
                    style={kitItems.length > 0 ? { 
                      backgroundColor: '#f3f4f6', 
                      cursor: 'not-allowed',
                      color: '#6b7280'
                    } : {}}
                  />
                  {kitItems.length > 0 && (
                    <span style={{ fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic' }}>
                      Calculado automáticamente: ${calculateTotalCost().toFixed(2)}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="code">Código (Opcional)</label>
                  <input
                    type="text"
                    id="code"
                    name="code"
                    value={formData.code}
                    onChange={handleInputChange}
                    placeholder="Se generará automáticamente"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="status" className="checkbox-label">
                    <input
                      type="checkbox"
                      id="status"
                      name="status"
                      checked={status === 1}
                      onChange={() => setStatus(status === 1 ? 0 : 1)}
                    />
                    <span>Kit activo</span>
                  </label>
                </div>
              </div>

              {/* Cálculo de ahorro y costos */}
              {kitItems.length > 0 && (
                <div className="savings-card">
                  <div className="savings-row">
                    <span className="savings-label">Suma individual (precio):</span>
                    <span className="savings-value">${totalIndividual.toFixed(2)}</span>
                  </div>
                  <div className="savings-row">
                    <span className="savings-label">Precio del kit:</span>
                    <span className="savings-value kit-price">
                      ${(parseFloat(formData.price.toString()) || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="savings-row total">
                    <span className="savings-label">Ahorro:</span>
                    <span className={`savings-value ${savings > 0 ? "positive" : "negative"}`}>
                      ${savings.toFixed(2)} ({savingsPercentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div style={{ 
                    marginTop: '1rem', 
                    paddingTop: '1rem', 
                    borderTop: '1px solid #d1d5db' 
                  }}>
                    <div className="savings-row">
                      <span className="savings-label" style={{ color: '#6b7280' }}>Costo total del kit:</span>
                      <span className="savings-value" style={{ color: '#6b7280', fontWeight: '600' }}>
                        ${calculateTotalCost().toFixed(2)}
                      </span>
                    </div>
                    {formData.price > 0 && calculateTotalCost() > 0 && (
                      <div className="savings-row" style={{ marginTop: '0.5rem' }}>
                        <span className="savings-label" style={{ color: '#6b7280' }}>Ganancia estimada:</span>
                        <span className="savings-value" style={{ 
                          color: '#059669', 
                          fontWeight: '700',
                          fontSize: '1.1rem'
                        }}>
                          ${((parseFloat(formData.price.toString()) || 0) - calculateTotalCost()).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Selector de productos */}
              <div className="products-selector-section">
                <h3 className="section-subtitle">📦 Agregar Productos al Kit</h3>

                {errors.kitItems && (
                  <div className="error-alert">{errors.kitItems}</div>
                )}

                {/* Filtros de búsqueda */}
                <div className="search-filters">
                  <div className="search-group">
                    <label htmlFor="search-product">Buscar producto:</label>
                    <input
                      ref={searchInputRef}
                      type="text"
                      id="search-product"
                      placeholder="Escribe para buscar..."
                      value={searchProduct}
                      onChange={(e) => {
                        setSearchProduct(e.target.value);
                        setSelectedCategoryFilter(""); // Reset category when searching
                      }}
                      className="search-input-touch"
                    />
                  </div>

                  <div className="search-group">
                    <label htmlFor="filter-category">Filtrar por categoría:</label>
                    <select
                      id="filter-category"
                      value={selectedCategoryFilter}
                      onChange={(e) => {
                        setSelectedCategoryFilter(e.target.value);
                        setSearchProduct(""); // Reset search when filtering by category
                      }}
                      className="select-touch"
                    >
                      <option value="">Todas las categorías</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Lista de productos filtrados */}
                {loadingProducts ? (
                  <div className="loading-products">Buscando productos...</div>
                ) : filteredProducts.length > 0 ? (
                  <div className="products-grid">
                    {filteredProducts.map((product) => {
                      const isSelected = selectedProductId === product.id.toString();
                      const isInKit = kitItems.some(item => item.productId === product.id);
                      
                      return (
                        <div
                          key={product.id}
                          className={`product-card-touch ${isSelected ? "selected" : ""} ${isInKit ? "in-kit" : ""}`}
                          onClick={() => !isInKit && handleSelectProduct(product)}
                        >
                          <div className="product-card-icon">{product.icon || "📦"}</div>
                          <div className="product-card-info">
                            <div className="product-card-name">{product.name}</div>
                            <div className="product-card-price">${product.price.toFixed(2)}</div>
                            {product.category && (
                              <div className="product-card-category">{product.category.name}</div>
                            )}
                          </div>
                          {isInKit && (
                            <div className="product-card-badge">✓ En kit</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : searchProduct.length > 2 || selectedCategoryFilter ? (
                  <div className="no-products-message">
                    No se encontraron productos. Intenta con otra búsqueda.
                  </div>
                ) : (
                  <div className="no-products-message">
                    Busca productos escribiendo al menos 3 caracteres o selecciona una categoría.
                  </div>
                )}

                {/* Detalles del producto seleccionado */}
                {selectedProduct && (
                  <div className="selected-product-details">
                    <div className="selected-product-header">
                      <span className="selected-product-icon">{selectedProduct.icon || "📦"}</span>
                      <div>
                        <div className="selected-product-name">{selectedProduct.name}</div>
                        <div className="selected-product-price">
                          Precio: ${selectedProduct.price.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {selectedProduct.presentations && selectedProduct.presentations.length > 0 && (
                      <div className="presentation-selector">
                        <label htmlFor="presentation">Presentación (opcional):</label>
                        <select
                          id="presentation"
                          value={selectedPresentationId}
                          onChange={(e) => setSelectedPresentationId(e.target.value)}
                          className="select-touch"
                        >
                          <option value="">Sin presentación (${selectedProduct.price.toFixed(2)})</option>
                          {selectedProduct.presentations.map((presentation) => (
                            <option key={presentation.id} value={presentation.id}>
                              {presentation.name} - ${presentation.unitPrice.toFixed(2)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="quantity-selector">
                      <label htmlFor="quantity">Cantidad:</label>
                      <div className="quantity-controls">
                        <button
                          type="button"
                          className="quantity-btn"
                          onClick={() => setItemQuantity(Math.max(0.01, itemQuantity - 0.01))}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          id="quantity"
                          min="0.01"
                          step="0.01"
                          value={itemQuantity}
                          onChange={(e) => setItemQuantity(parseFloat(e.target.value) || 0.01)}
                          className="quantity-input-touch"
                        />
                        <button
                          type="button"
                          className="quantity-btn"
                          onClick={() => setItemQuantity(itemQuantity + 0.01)}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="success"
                      onClick={handleAddProductToKit}
                      className="add-product-btn-touch"
                    >
                      ➕ Agregar al Kit
                    </Button>
                  </div>
                )}
              </div>

              {/* Lista de productos en el kit */}
              {kitItems.length > 0 && (
                <div className="kit-items-section">
                  <h3 className="section-subtitle">Productos en el Kit ({kitItems.length})</h3>
                  <div className="kit-items-list">
                    {kitItems.map((item, index) => {
                      const unitPrice =
                        item.presentationId && item.product?.presentations
                          ? item.product.presentations.find((p) => p.id === item.presentationId)?.unitPrice ||
                            item.product.price
                          : item.product?.price || 0;
                      const subtotal = unitPrice * item.quantity;

                      return (
                        <div key={index} className="kit-item-card">
                          <div className="kit-item-info">
                            <div className="kit-item-header">
                              <span className="kit-item-icon">{item.product?.icon || "📦"}</span>
                              <div className="kit-item-details">
                                <div className="kit-item-name">{item.product?.name}</div>
                                {item.presentation && (
                                  <div className="kit-item-presentation">
                                    {item.presentation.name}
                                  </div>
                                )}
                                <div className="kit-item-price">
                                  ${unitPrice.toFixed(2)} × {item.quantity} = ${subtotal.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="kit-item-actions">
                            <div className="quantity-controls-small">
                              <button
                                type="button"
                                className="quantity-btn-small"
                                onClick={() => handleUpdateItemQuantity(index, Math.max(0.01, item.quantity - 0.01))}
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleUpdateItemQuantity(index, parseFloat(e.target.value) || 0.01)
                                }
                                className="quantity-input-small"
                              />
                              <button
                                type="button"
                                className="quantity-btn-small"
                                onClick={() => handleUpdateItemQuantity(index, item.quantity + 0.01)}
                              >
                                +
                              </button>
                            </div>
                            <button
                              type="button"
                              className="remove-btn-touch"
                              onClick={() => handleRemoveItem(index)}
                            >
                              🗑️ Eliminar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Botones de acción */}
              <div className="form-actions-touch">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onBack}
                  className="cancel-btn-touch"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="success"
                  className="save-btn-touch"
                  disabled={loading}
                >
                  {loading ? "Guardando..." : "💾 Guardar Kit"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default NewKitPage;
