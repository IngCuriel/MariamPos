import React, { useEffect, useState } from "react";
import { IoClose } from "react-icons/io5";
import { getPromotions } from "../../api/products";
import type { Product } from "../../types/index";
import "../../styles/pages/sales/promotionsModal.css";

interface PromotionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
}

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

// Fecha corta en hora local (ej: 30/09/2026).
const formatDate = (value?: string | Date | null): string => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const PromotionsModal: React.FC<PromotionsModalProps> = ({ isOpen, onClose, onSelectProduct }) => {
  const [active, setActive] = useState<Product[]>([]);
  const [expired, setExpired] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        setLoading(true);
        const data = await getPromotions();
        setActive(data.active || []);
        setExpired(data.expired || []);
      } catch (e) {
        console.error("Error cargando promociones:", e);
        setActive([]);
        setExpired([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (isOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const select = (p: Product) => {
    onSelectProduct(p);
    onClose();
  };

  return (
    <div className="promo-overlay" onClick={onClose} role="presentation">
      <div className="promo-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="promo-header">
          <h2 className="promo-header-title">🎁 Promociones</h2>
          <button className="promo-close" onClick={onClose} aria-label="Cerrar">
            <IoClose size={24} />
          </button>
        </div>

        <div className="promo-body">
          {loading ? (
            <div className="promo-empty">Cargando promociones…</div>
          ) : active.length === 0 && expired.length === 0 ? (
            <div className="promo-empty">No hay productos en promoción por ahora.</div>
          ) : (
            <>
              {/* Vigentes: vendibles */}
              {active.length > 0 && (
                <>
                  <div className="promo-section-title">✅ Vigentes</div>
                  <div className="promo-grid">
                    {active.map((p) => {
                      const real = p.price;
                      const promo = p.promoPrice ?? p.price;
                      const ahorro = real - promo;
                      const pct = real > 0 ? Math.round((ahorro / real) * 100) : 0;
                      const ends = formatDate(p.promoEndsAt);
                      return (
                        <button key={p.id} className="promo-card" onClick={() => select(p)} title={p.name}>
                          {pct > 0 && <span className="promo-card-badge">-{pct}%</span>}
                          <span className="promo-card-name">{p.name}</span>
                          <span className="promo-card-prices">
                            <span className="promo-card-real">{money(real)}</span>
                            <span className="promo-card-promo">{money(promo)}</span>
                          </span>
                          <span className="promo-card-ends">
                            {ends ? `Vence: ${ends}` : "Sin vencimiento"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Vencidas: solo informativas (gris, no clickeable) */}
              {expired.length > 0 && (
                <>
                  <div className="promo-section-title promo-section-title--expired">
                    ⛔ Vencidas (revisar)
                  </div>
                  <div className="promo-grid">
                    {expired.map((p) => {
                      const promo = p.promoPrice ?? p.price;
                      const ends = formatDate(p.promoEndsAt);
                      return (
                        <div key={p.id} className="promo-card promo-card--expired" title={p.name}>
                          <span className="promo-card-name">{p.name}</span>
                          <span className="promo-card-prices">
                            <span className="promo-card-promo promo-card-promo--muted">{money(promo)}</span>
                          </span>
                          <span className="promo-card-ends promo-card-ends--expired">
                            Venció: {ends}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PromotionsModal;
