import React, { useState, useEffect } from "react";
import Button from "../../components/Button";
import Card from "../../components/Card";
import type { Supplier, Product, CreatePurchaseInput } from "../../types";
import { getSuppliers } from "../../api/suppliers";
import { getProductsFilters } from "../../api/products";
import { createPurchase } from "../../api/purchases";
import Swal from "sweetalert2";

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

interface PurchaseDetailItem {
  productId: number;
  product?: Product;
  quantity: number;
  unitCost: number;
  subtotal: number;
  discount: number;
}

const PurchaseModal: React.FC<PurchaseModalProps> = ({ isOpen, onClose, onSave }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [paymentStatus, setPaymentStatus] = useState<string>("PENDING");
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [tax, setTax] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);

  const [details, setDetails] = useState<PurchaseDetailItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSuppliers();
      resetForm();
    }
  }, [isOpen]);

  // Ajustar monto pagado cuando cambia el total o el estado
  useEffect(() => {
    const { total: currentTotal } = calculateTotals();
    if (paymentStatus === "PAID") {
      setPaidAmount(currentTotal);
    } else if (paymentStatus === "PENDING" && paymentMethod !== "CREDIT") {
      setPaidAmount(0);
    }
  }, [paymentStatus, paymentMethod, details, tax, discount]);

  const fetchSuppliers = async () => {
    try {
      const data = await getSuppliers();
      setSuppliers(data.filter((s) => s.status === 1));
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  };

  const resetForm = () => {
    setSelectedSupplierId("");
    setPurchaseDate(new Date().toISOString().split("T")[0]);
    setDueDate("");
    setInvoiceNumber("");
    setNotes("");
    setPaymentMethod("CASH");
    setPaymentStatus("PENDING");
    setPaidAmount(0);
    setTax(0);
    setDiscount(0);
    setDetails([]);
    setSearchTerm("");
    setSearchResults([]);
  };

  const searchProducts = async (term: string) => {
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const results = await getProductsFilters(term);
      setSearchResults(results);
      setShowSearchResults(true);
    } catch (error) {
      console.error("Error searching products:", error);
    }
  };

  const addProduct = (product: Product) => {
    const existingIndex = details.findIndex((d) => d.productId === product.id);
    if (existingIndex >= 0) {
      Swal.fire({
        icon: "info",
        title: "Producto ya agregado",
        text: "Este producto ya está en la lista. Puedes editar la cantidad.",
      });
      return;
    }

    const newDetail: PurchaseDetailItem = {
      productId: product.id,
      product,
      quantity: 1,
      unitCost: product.cost || 0,
      subtotal: product.cost || 0,
      discount: 0,
    };

    setDetails([...details, newDetail]);
    setSearchTerm("");
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const updateDetail = (index: number, field: keyof PurchaseDetailItem, value: any) => {
    const newDetails = [...details];
    const detail = { ...newDetails[index] };

    if (field === "quantity" || field === "unitCost" || field === "discount") {
      detail[field] = parseFloat(value) || 0;
      detail.subtotal = detail.quantity * detail.unitCost - detail.discount;
    } else {
      (detail as any)[field] = value;
    }

    newDetails[index] = detail;
    setDetails(newDetails);
  };

  const removeDetail = (index: number) => {
    setDetails(details.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subtotal = details.reduce((sum, d) => sum + d.subtotal, 0);
    const totalDiscount = discount;
    const totalTax = tax;
    const total = subtotal - totalDiscount + totalTax;
    return { subtotal, totalDiscount, totalTax, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSupplierId) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Debe seleccionar un proveedor",
      });
      return;
    }

    if (details.length === 0) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Debe agregar al menos un producto",
      });
      return;
    }

    const { subtotal, total } = calculateTotals();

    // Validar monto pagado
    if (paymentStatus === "PARTIAL" && paidAmount <= 0) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Debe ingresar un monto pagado mayor a 0 para pagos parciales",
      });
      return;
    }

    if (paidAmount > total) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: `El monto pagado ($${paidAmount.toFixed(2)}) no puede ser mayor al total ($${total.toFixed(2)})`,
      });
      return;
    }

    // Calcular valores de pago
    const finalPaidAmount = paymentStatus === "PAID" ? total : paidAmount;
    const balance = total - finalPaidAmount;
    const paidPercentage = total > 0 ? (finalPaidAmount / total) * 100 : 0;
    const pendingPercentage = total > 0 ? (balance / total) * 100 : 0;

    // Ajustar estado de pago según el monto
    let finalPaymentStatus = paymentStatus;
    if (finalPaidAmount >= total) {
      finalPaymentStatus = "PAID";
    } else if (finalPaidAmount > 0) {
      finalPaymentStatus = "PARTIAL";
    } else {
      finalPaymentStatus = "PENDING";
    }

    try {
      const purchaseData: CreatePurchaseInput = {
        supplierId: parseInt(selectedSupplierId, 10),
        purchaseDate,
        dueDate: dueDate || undefined,
        subtotal,
        tax,
        discount,
        total,
        paymentMethod,
        paymentStatus: finalPaymentStatus,
        paidAmount: finalPaidAmount,
        balance,
        paidPercentage,
        pendingPercentage,
        invoiceNumber: invoiceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        details: details.map((d) => ({
          productId: d.productId,
          quantity: d.quantity,
          unitCost: d.unitCost,
          subtotal: d.subtotal,
          discount: d.discount,
        })),
        updateInventory: true,
      };

      await createPurchase(purchaseData);
      onSave();
      onClose();
    } catch (error: any) {
      console.error("Error creating purchase:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.error || "No se pudo crear la compra",
      });
    }
  };

  // Calcular totales
  const { subtotal, totalDiscount, totalTax, total } = calculateTotals();

  // Ajustar monto pagado cuando cambia el total o el estado
  useEffect(() => {
    if (paymentStatus === "PAID") {
      setPaidAmount(total);
    } else if (paymentStatus === "PENDING" && paymentMethod !== "CREDIT") {
      setPaidAmount(0);
    }
  }, [total, paymentStatus, paymentMethod]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <Card className="modal-content purchase-modal" onClick={(e) => e?.stopPropagation()}>
        <div className="modal-header">
          <h2>Nueva Compra</h2>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="purchase-form">
          <div className="form-row">
            <div className="form-group">
              <label>
                Proveedor <span className="required">*</span>
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                required
              >
                <option value="">Seleccionar proveedor</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Fecha de Compra</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Fecha de Vencimiento</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Número de Factura</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Método de Pago</label>
              <select value={paymentMethod} onChange={(e) => {
                setPaymentMethod(e.target.value);
                if (e.target.value === "CREDIT") {
                  setPaymentStatus("PENDING");
                  setPaidAmount(0);
                }
              }}>
                <option value="CASH">Efectivo</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="CHECK">Cheque</option>
                <option value="CREDIT">Crédito</option>
              </select>
            </div>

            <div className="form-group">
              <label>Estado de Pago</label>
              <select 
                value={paymentStatus} 
                onChange={(e) => {
                  const newStatus = e.target.value;
                  setPaymentStatus(newStatus);
                  if (newStatus === "PAID") {
                    setPaidAmount(total);
                  } else if (newStatus === "PENDING") {
                    setPaidAmount(0);
                  }
                }}
              >
                <option value="PENDING">Pendiente</option>
                <option value="PARTIAL">Parcial</option>
                <option value="PAID">Pagado</option>
              </select>
            </div>
          </div>

          {/* Campos de pago cuando es parcial o crédito */}
          {(paymentStatus === "PARTIAL" || paymentStatus === "PENDING" || paymentMethod === "CREDIT") && (
            <div className="payment-section">
              <h3 className="payment-section-title">
                <span className="section-icon">💰</span>
                Información de Pago
              </h3>
              
              {paymentStatus === "PARTIAL" && (
                <div className="form-group">
                  <label>
                    Monto Pagado <span className="required">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={total}
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => {
                      const amount = parseFloat(e.target.value) || 0;
                      if (amount <= total) {
                        setPaidAmount(amount);
                        if (amount === total) {
                          setPaymentStatus("PAID");
                        } else if (amount > 0) {
                          setPaymentStatus("PARTIAL");
                        }
                      }
                    }}
                    placeholder="0.00"
                  />
                  <span className="field-hint">
                    Máximo: ${total.toFixed(2)}
                  </span>
                </div>
              )}

              {paymentStatus === "PENDING" && paymentMethod === "CREDIT" && (
                <div className="form-group">
                  <label>Monto Pagado</label>
                  <input
                    type="number"
                    min="0"
                    max={total}
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => {
                      const amount = parseFloat(e.target.value) || 0;
                      if (amount <= total) {
                        setPaidAmount(amount);
                        if (amount === total) {
                          setPaymentStatus("PAID");
                        } else if (amount > 0) {
                          setPaymentStatus("PARTIAL");
                        } else {
                          setPaymentStatus("PENDING");
                        }
                      }
                    }}
                    placeholder="0.00"
                  />
                  <span className="field-hint">
                    Dejar en 0 para pago completo a crédito
                  </span>
                </div>
              )}

              {total > 0 && (
                <div className="payment-summary">
                  <div className="payment-summary-item">
                    <span className="payment-label">Total de la Compra:</span>
                    <span className="payment-value">${total.toFixed(2)}</span>
                  </div>
                  <div className="payment-summary-item">
                    <span className="payment-label">Monto Pagado:</span>
                    <span className="payment-value paid">${paidAmount.toFixed(2)}</span>
                  </div>
                  <div className="payment-summary-item">
                    <span className="payment-label">Saldo Pendiente:</span>
                    <span className="payment-value pending">${(total - paidAmount).toFixed(2)}</span>
                  </div>
                  {total > 0 && (
                    <>
                      <div className="payment-summary-item">
                        <span className="payment-label">Porcentaje Pagado:</span>
                        <span className="payment-value percentage-paid">
                          {((paidAmount / total) * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="payment-summary-item">
                        <span className="payment-label">Porcentaje Pendiente:</span>
                        <span className="payment-value percentage-pending">
                          {(((total - paidAmount) / total) * 100).toFixed(2)}%
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label>Buscar Producto</label>
            <div className="search-wrapper">
              <input
                type="text"
                placeholder="Buscar por código o nombre..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  searchProducts(e.target.value);
                }}
                onFocus={() => {
                  if (searchTerm.length > 0) {
                    setShowSearchResults(true);
                  }
                }}
              />
              {showSearchResults && searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map((product) => (
                    <div
                      key={product.id}
                      className="search-result-item"
                      onClick={() => addProduct(product)}
                    >
                      <span className="product-code">{product.code || "N/A"}</span>
                      <span className="product-name">{product.name}</span>
                      <span className="product-cost">${product.cost || 0}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {details.length > 0 && (
            <div className="details-section">
              <h3>Productos</h3>
              <div className="details-table-container">
                <table className="details-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th>Costo Unit.</th>
                      <th>Descuento</th>
                      <th>Subtotal</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.map((detail, index) => (
                      <tr key={index}>
                        <td>{detail.product?.name || "N/A"}</td>
                        <td>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={detail.quantity}
                            onChange={(e) => updateDetail(index, "quantity", e.target.value)}
                            className="quantity-input"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={detail.unitCost}
                            onChange={(e) => updateDetail(index, "unitCost", e.target.value)}
                            className="cost-input"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={detail.discount}
                            onChange={(e) => updateDetail(index, "discount", e.target.value)}
                            className="discount-input"
                          />
                        </td>
                        <td>${detail.subtotal.toFixed(2)}</td>
                        <td>
                          <Button
                            variant="danger"
                            size="small"
                            onClick={() => removeDetail(index)}
                          >
                            🗑️
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="totals-section">
            <div className="form-row">
              <div className="form-group">
                <label>Descuento General</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="form-group">
                <label>Impuestos</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tax}
                  onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="totals-display">
              <div className="total-item">
                <span>Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="total-item">
                <span>Descuento:</span>
                <span>-${totalDiscount.toFixed(2)}</span>
              </div>
              <div className="total-item">
                <span>Impuestos:</span>
                <span>${totalTax.toFixed(2)}</span>
              </div>
              <div className="total-item total-final">
                <span>Total:</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Notas adicionales (opcional)"
            />
          </div>

          <div className="form-actions">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Guardar Compra
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default PurchaseModal;

