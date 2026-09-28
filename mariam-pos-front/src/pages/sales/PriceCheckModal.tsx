import React, { useEffect, useRef, useState } from "react";
import { IoClose } from "react-icons/io5";
import { getProductsFilters } from "../../api/products";
import { getProductInventory } from "../../api/inventory";
import type { Product, Inventory } from "../../types/index";
import "../../styles/pages/sales/priceCheckModal.css";

interface PriceCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Verificador de precios (solo consulta). Busca por código o nombre y muestra
 * precio, presentaciones, tramos, unidad y stock. NO afecta la venta en curso.
 */
const PriceCheckModal: React.FC<PriceCheckModalProps> = ({ isOpen, onClose }) => {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Enfocar el input al abrir y limpiar al cerrar.
  useEffect(() => {
    if (isOpen) {
      setTerm("");
      setResults([]);
      setSelected(null);
      setInventory(null);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // Buscar con debounce cuando cambia el término.
  useEffect(() => {
    if (!isOpen) return;
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }
    const handler = setTimeout(async () => {
      try {
        setLoading(true);
        const data = await getProductsFilters(term.trim());
        setResults(data);
        // Si hay una sola coincidencia, seleccionarla directo (típico al escanear).
        if (data.length === 1) {
          selectProduct(data[0]);
        }
      } catch (e) {
        console.error("Error buscando producto:", e);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, isOpen]);

  // Cerrar con Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const selectProduct = async (product: Product) => {
    setSelected(product);
    setInventory(null);
    if (product.trackInventory && product.id !== 1) {
      try {
        const inv = await getProductInventory(product.id);
        setInventory(inv);
      } catch {
        setInventory(null);
      }
    }
  };

  const money = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

  const backToResults = () => {
    setSelected(null);
    setInventory(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  if (!isOpen) return null;

  const unitName = selected?.unit?.name || "";

  return (
    <div className="pchk-overlay" onClick={onClose} role="presentation">
      <div className="pchk-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="pchk-header">
          <h2 className="pchk-title">🔎 Verificar precio</h2>
          <button className="pchk-close" onClick={onClose} aria-label="Cerrar">
            <IoClose size={24} />
          </button>
        </div>

        <div className="pchk-body">
          {/* Buscador (código o nombre) */}
          <input
            ref={inputRef}
            className="pchk-input"
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Escanea o escribe código / nombre…"
          />

          {loading && <div className="pchk-hint">Buscando…</div>}

          {/* Detalle del producto seleccionado */}
          {selected ? (
            <div className="pchk-detail">
              {results.length > 1 && (
                <button className="pchk-back" onClick={backToResults}>
                  ← Ver resultados
                </button>
              )}

              <div className="pchk-detail-head">
                <span className="pchk-detail-icon">{selected.icon || "📦"}</span>
                <div className="pchk-detail-info">
                  <div className="pchk-detail-name">{selected.name}</div>
                  <div className="pchk-detail-code">
                    {selected.code ? `Código: ${selected.code}` : "Sin código"}
                    {selected.category?.name ? ` · ${selected.category.name}` : ""}
                  </div>
                </div>
              </div>

              {/* Precio principal: solo si NO es tiered ni tiene presentaciones */}
              {selected.pricingMode !== "tiered" &&
                (!selected.presentations || selected.presentations.length <= 1) && (
                  <div className="pchk-price-main">
                    {money(selected.price)}
                    {unitName ? <span className="pchk-price-unit"> / {unitName}</span> : null}
                  </div>
                )}

              {/* Presentaciones */}
              {selected.pricingMode !== "tiered" &&
                selected.presentations &&
                selected.presentations.length > 1 && (
                  <div className="pchk-section">
                    <div className="pchk-section-title">Presentaciones</div>
                    <div className="pchk-table">
                      {(() => {
                        // Precio base = unitPrice de la presentación base (1 unidad / isDefault).
                        const base = selected.presentations!.find(
                          (p) => p.isDefault || p.quantity === 1
                        );
                        const basePrice = base ? base.unitPrice : selected.price;
                        return selected.presentations!.map((p, i) => {
                          const total = p.quantity * p.unitPrice;
                          const sinDescuento = p.quantity * basePrice;
                          const ahorro = sinDescuento - total;
                          const isBase = p.isDefault || p.quantity === 1;
                          return (
                            <div key={i} className="pchk-row pchk-row--pres">
                              <span className="pchk-row-label">{p.name}</span>
                              <span className="pchk-row-muted">
                                {p.quantity} {unitName || "u"} · {money(p.unitPrice)} c/u
                              </span>
                              <span className="pchk-row-totals">
                                <span className="pchk-row-price">Total: {money(total)}</span>
                                {!isBase && ahorro > 0 && (
                                  <span className="pchk-row-save">Ahorras {money(ahorro)}</span>
                                )}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}

              {/* Precio escalonado (tramos) */}
              {selected.pricingMode === "tiered" &&
                selected.priceTiers &&
                selected.priceTiers.length > 0 && (
                  <div className="pchk-section">
                    <div className="pchk-section-title">Precio por cantidad</div>
                    <div className="pchk-table">
                      {[...selected.priceTiers]
                        .sort((a, b) => a.minQty - b.minQty)
                        .map((t, i) => (
                          <div key={i} className="pchk-row">
                            <span className="pchk-row-label">
                              {t.maxQty === null ? `${t.minQty} o más` : `${t.minQty} a ${t.maxQty}`}
                            </span>
                            <span className="pchk-row-price">{money(t.unitPrice)} c/u</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

              {/* Stock */}
              {selected.trackInventory && (
                <div className="pchk-stock">
                  📦 Stock disponible:{" "}
                  <strong>
                    {inventory ? inventory.currentStock : "…"} {unitName}
                  </strong>
                </div>
              )}
            </div>
          ) : (
            /* Lista de resultados */
            <div className="pchk-results">
              {term.trim().length >= 2 && !loading && results.length === 0 && (
                <div className="pchk-hint">Sin resultados para “{term}”.</div>
              )}
              {results.map((p) => (
                <button key={p.id} className="pchk-result" onClick={() => selectProduct(p)}>
                  <span className="pchk-result-name">{p.name}</span>
                  <span className="pchk-result-price">{money(p.price)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PriceCheckModal;
