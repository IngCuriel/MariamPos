import React, { useState, useEffect, useRef } from "react";
import type { Supplier, Product, ProductPresentation, CreatePurchaseInput } from "../../types";
import { getSuppliers } from "../../api/suppliers";
import { getProductsFilters } from "../../api/products";
import { createPurchase } from "../../api/purchases";
import Swal from "sweetalert2";
import "../../styles/pages/purchases/purchases.css";

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

// Una línea de la compra. Trabajamos en unidades de PRESENTACIÓN para la
// captura (ej: 3 rejas) y convertimos a unidades base al enviar al backend.
interface PurchaseLine {
  productId: number;
  product: Product;
  // Presentación elegida (si el producto tiene presentaciones). Si no,
  // se asume base (factor 1).
  presentation?: ProductPresentation;
  presentationQty: number; // cantidad en unidades de la presentación
  unitCost: number; // costo por 1 unidad de la presentación elegida
  discount: number; // descuento en dinero sobre la línea
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount || 0);

// Factor de conversión presentación → unidades base (piezas).
const presentationFactor = (line: PurchaseLine) =>
  line.presentation?.quantity && line.presentation.quantity > 0 ? line.presentation.quantity : 1;

// Subtotal de una línea = costoPresentación * cantidadPresentaciones - descuento.
const lineSubtotal = (line: PurchaseLine) =>
  Math.max(0, line.unitCost * line.presentationQty - line.discount);

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
  // Compras sin impuesto ni descuento general: se envían en 0 al backend.
  const tax = 0;
  const discount = 0;

  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSuppliers();
      resetForm();
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [isOpen]);

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
    setLines([]);
    setSearchTerm("");
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const searchProducts = async (term: string) => {
    if (term.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
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

  // Presentación inicial al agregar: la base (isDefault o quantity===1) o la primera.
  const pickDefaultPresentation = (product: Product): ProductPresentation | undefined => {
    const pres = product.presentations ?? [];
    if (pres.length === 0) return undefined;
    return pres.find((p) => p.isDefault) || pres.find((p) => p.quantity === 1) || pres[0];
  };

  const addProduct = (product: Product) => {
    if (lines.some((l) => l.productId === product.id)) {
      Swal.fire({
        icon: "info",
        title: "Producto ya agregado",
        text: "Este producto ya está en la lista. Puedes ajustar la cantidad o presentación.",
        timer: 1800,
        showConfirmButton: false,
      });
      setSearchTerm("");
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const presentation = pickDefaultPresentation(product);
    // Costo sugerido: de la presentación si existe, si no el costo del producto.
    const unitCost = presentation ? presentation.unitPrice : product.cost || 0;

    const newLine: PurchaseLine = {
      productId: product.id,
      product,
      presentation,
      presentationQty: 1,
      unitCost,
      discount: 0,
    };

    setLines((prev) => [...prev, newLine]);
    setSearchTerm("");
    setSearchResults([]);
    setShowSearchResults(false);
    searchRef.current?.focus();
  };

  const updateLine = (index: number, patch: Partial<PurchaseLine>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  // Cambia la presentación elegida y re-sugiere el costo de esa presentación.
  const changePresentation = (index: number, presentationName: string) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const pres = (l.product.presentations ?? []).find((p) => p.name === presentationName);
        return {
          ...l,
          presentation: pres,
          unitCost: pres ? pres.unitPrice : l.unitCost,
        };
      })
    );
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = lines.reduce((sum, l) => sum + lineSubtotal(l), 0);
  const total = subtotal - discount + tax;

  // Mantener monto pagado coherente con el estado/total.
  useEffect(() => {
    if (paymentStatus === "PAID") {
      setPaidAmount(total);
    } else if (paymentStatus === "PENDING" && paymentMethod !== "CREDIT") {
      setPaidAmount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, paymentStatus, paymentMethod]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSupplierId) {
      Swal.fire({ icon: "error", title: "Error", text: "Debe seleccionar un proveedor" });
      return;
    }
    if (lines.length === 0) {
      Swal.fire({ icon: "error", title: "Error", text: "Debe agregar al menos un producto" });
      return;
    }
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
        text: `El monto pagado (${formatCurrency(paidAmount)}) no puede ser mayor al total (${formatCurrency(total)})`,
      });
      return;
    }

    const finalPaidAmount = paymentStatus === "PAID" ? total : paidAmount;
    const balance = total - finalPaidAmount;
    const paidPercentage = total > 0 ? (finalPaidAmount / total) * 100 : 0;
    const pendingPercentage = total > 0 ? (balance / total) * 100 : 0;

    let finalPaymentStatus = paymentStatus;
    if (finalPaidAmount >= total) finalPaymentStatus = "PAID";
    else if (finalPaidAmount > 0) finalPaymentStatus = "PARTIAL";
    else finalPaymentStatus = "PENDING";

    // Convertir cada línea a UNIDADES BASE para el backend/inventario:
    // - quantity base = cantidadPresentaciones * factor
    // - unitCost base = costoPresentación / factor
    // - subtotal se conserva idéntico (costoPres * cantPres - descuento)
    const details = lines.map((l) => {
      const factor = presentationFactor(l);
      const baseQuantity = l.presentationQty * factor;
      const baseUnitCost = factor > 0 ? l.unitCost / factor : l.unitCost;
      return {
        productId: l.productId,
        quantity: baseQuantity,
        unitCost: baseUnitCost,
        subtotal: lineSubtotal(l),
        discount: l.discount,
      };
    });

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
        details,
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

  if (!isOpen) return null;

  const showPaymentFields =
    paymentStatus === "PARTIAL" || (paymentStatus === "PENDING" && paymentMethod === "CREDIT");

  return (
    <div className="pur-pos-overlay">
      <div className="pur-pos">
        {/* Header full-screen */}
        <div className="pur-pos-header">
          <h1>🛒 Nueva Compra</h1>
          <button type="button" className="pur-pos-close" onClick={onClose}>
            ✕ Cerrar
          </button>
        </div>

        <div className="pur-pos-body">
          {/* ===== Columna izquierda: PRODUCTOS (protagonista) ===== */}
          <div className="pur-pos-main">
            {/* Buscador */}
            <div className="pur-pos-search">
              <span className="pur-pos-search-icon">🔍</span>
              <input
                ref={searchRef}
                type="text"
                placeholder="Buscar producto por código o nombre para agregar..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  searchProducts(e.target.value);
                }}
                onFocus={() => {
                  if (searchResults.length > 0) setShowSearchResults(true);
                }}
              />
              {showSearchResults && searchResults.length > 0 && (
                <div className="pur-pos-search-results">
                  {searchResults.map((product) => (
                    <div
                      key={product.id}
                      className="pur-pos-search-item"
                      onClick={() => addProduct(product)}
                    >
                      <span className="pur-pos-search-code">{product.code || "N/A"}</span>
                      <span className="pur-pos-search-name">{product.name}</span>
                      {product.presentations && product.presentations.length > 0 && (
                        <span className="pur-pos-search-pres">
                          {product.presentations.length} present.
                        </span>
                      )}
                      <span className="pur-pos-search-cost">{formatCurrency(product.cost || 0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lista de productos agregados */}
            <div className="pur-pos-list">
              {lines.length === 0 ? (
                <div className="pur-pos-empty">
                  <div className="pur-pos-empty-icon">📦</div>
                  <p>Busca y agrega productos a la compra</p>
                  <small>
                    Si el producto tiene presentaciones (ej: reja, bulto), podrás elegirla en cada
                    línea. El inventario se actualiza en unidades base.
                  </small>
                </div>
              ) : (
                <table className="pur-pos-table">
                  <thead>
                    <tr>
                      <th className="pur-th-num">#</th>
                      <th>Producto</th>
                      <th>Presentación</th>
                      <th className="pur-td-right">Cantidad</th>
                      <th className="pur-td-right">Costo (present.)</th>
                      <th className="pur-td-right">Subtotal</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => {
                      const presList = line.product.presentations ?? [];
                      const hasPres = presList.length > 0;
                      const factor = presentationFactor(line);
                      const baseUnits = line.presentationQty * factor;
                      return (
                        <tr key={line.productId}>
                          <td className="pur-td-num">{index + 1}</td>
                          <td>
                            <div className="pur-pos-prod">
                              <span className="pur-pos-prod-name">{line.product.name}</span>
                              <span className="pur-pos-prod-code">
                                {line.product.code || "Sin código"}
                              </span>
                            </div>
                          </td>
                          <td>
                            {hasPres ? (
                              <select
                                className="pur-pos-pres-select"
                                value={line.presentation?.name || ""}
                                onChange={(e) => changePresentation(index, e.target.value)}
                              >
                                {presList.map((p) => (
                                  <option key={p.name} value={p.name}>
                                    {p.name} ({p.quantity} pza)
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="pur-pos-pres-base">Pieza</span>
                            )}
                          </td>
                          <td className="pur-td-right">
                            <input
                              type="number"
                              min="0.01"
                              step="1"
                              className="pur-pos-input"
                              value={line.presentationQty}
                              onChange={(e) =>
                                updateLine(index, {
                                  presentationQty: parseFloat(e.target.value) || 0,
                                })
                              }
                            />
                            {factor > 1 && (
                              <span className="pur-pos-base-hint">= {baseUnits} pza</span>
                            )}
                          </td>
                          <td className="pur-td-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="pur-pos-input"
                              value={line.unitCost}
                              onChange={(e) =>
                                updateLine(index, { unitCost: parseFloat(e.target.value) || 0 })
                              }
                            />
                            {/* Costo unitario derivado (costo de la presentación
                                dividido entre las piezas que trae). Es lo que se
                                guarda por pieza en el inventario. */}
                            {factor > 1 && (
                              <span className="pur-pos-base-hint">
                                {formatCurrency(line.unitCost / factor)}/pza
                              </span>
                            )}
                          </td>
                          <td className="pur-td-right">
                            <span className="pur-total">{formatCurrency(lineSubtotal(line))}</span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="pur-pos-remove"
                              title="Quitar producto"
                              onClick={() => removeLine(index)}
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ===== Columna derecha: datos + totales ===== */}
          <aside className="pur-pos-side">
            <form id="pur-pos-form" onSubmit={handleSubmit} className="pur-pos-side-scroll">
              <div className="pur-pos-side-section">
                <h3 className="pur-form-section-title">
                  <span className="section-icon">📋</span>Datos de la compra
                </h3>

                <div className="pur-form-group">
                  <label>
                    Proveedor <span className="pur-form-required">*</span>
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

                <div className="pur-form-row">
                  <div className="pur-form-group">
                    <label>Fecha de compra</label>
                    <input
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                    />
                  </div>
                  <div className="pur-form-group">
                    <label>Vencimiento</label>
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  </div>
                </div>

                <div className="pur-form-group">
                  <label>Número de factura</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>

                <div className="pur-form-row">
                  <div className="pur-form-group">
                    <label>Método de pago</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => {
                        setPaymentMethod(e.target.value);
                        if (e.target.value === "CREDIT") {
                          setPaymentStatus("PENDING");
                          setPaidAmount(0);
                        }
                      }}
                    >
                      <option value="CASH">Efectivo</option>
                      <option value="TRANSFER">Transferencia</option>
                      <option value="CHECK">Cheque</option>
                      <option value="CREDIT">Crédito</option>
                    </select>
                  </div>
                  <div className="pur-form-group">
                    <label>Estado de pago</label>
                    <select
                      value={paymentStatus}
                      onChange={(e) => {
                        const ns = e.target.value;
                        setPaymentStatus(ns);
                        if (ns === "PAID") setPaidAmount(total);
                        else if (ns === "PENDING") setPaidAmount(0);
                      }}
                    >
                      <option value="PENDING">Pendiente</option>
                      <option value="PARTIAL">Parcial</option>
                      <option value="PAID">Pagado</option>
                    </select>
                  </div>
                </div>

                {showPaymentFields && (
                  <div className="pur-form-group">
                    <label>
                      Monto pagado{" "}
                      {paymentStatus === "PARTIAL" && <span className="pur-form-required">*</span>}
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
                          if (amount === total) setPaymentStatus("PAID");
                          else if (amount > 0) setPaymentStatus("PARTIAL");
                          else setPaymentStatus("PENDING");
                        }
                      }}
                      placeholder="0.00"
                    />
                    <span className="pur-field-hint">Máximo: {formatCurrency(total)}</span>
                  </div>
                )}

                <div className="pur-form-group">
                  <label>Notas</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Notas adicionales (opcional)"
                  />
                </div>
              </div>
            </form>

            {/* Totales fijos al pie del panel */}
            <div className="pur-pos-side-footer">
              <div className="pur-pos-totals">
                <div className="pur-total-item">
                  <span>Subtotal ({lines.length} ítem{lines.length !== 1 ? "s" : ""})</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="pur-total-item pur-total-item--final">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="pur-pos-actions">
                <button type="button" className="pur-btn pur-btn--ghost" onClick={onClose}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="pur-pos-form"
                  className="pur-btn pur-btn--success pur-pos-save"
                  disabled={lines.length === 0}
                >
                  💾 Guardar Compra
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default PurchaseModal;
