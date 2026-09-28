import React from "react";
import "../../styles/pages/products/productHelpModal.css";

export type ProductHelpTopic = "code" | "name" | "presentation";

interface ProductHelpModalProps {
  isOpen: boolean;
  topic: ProductHelpTopic;
  onClose: () => void;
}

interface RubroExample {
  rubro: string;
  icon: string;
  code: string;
  name: string;
}

// Ejemplos por rubro: sirven como referencia rápida para el cajero.
// El código sigue la estructura Departamento + Categoría + consecutivo.
const RUBRO_EXAMPLES: RubroExample[] = [
  { rubro: "Papelería › Cuadernos", icon: "✏️", code: "PAP-CUA-001", name: "Cuaderno Scribe profesional 100 hojas" },
  { rubro: "Abarrotes › Refrescos", icon: "🛒", code: "ABA-REF-001", name: "Coca-Cola 600 ml" },
  { rubro: "Ropa › Playeras", icon: "👕", code: "ROP-PLA-001", name: "Playera Nike talla M negra" },
  { rubro: "Zapatos › Tenis", icon: "👟", code: "ZAP-TEN-001", name: "Tenis Adidas 26.5 blanco" },
  { rubro: "Ferretería › Herramientas", icon: "🔧", code: "FER-HER-001", name: "Martillo Truper 16 oz" },
  { rubro: "Trastes › Sartenes", icon: "🍳", code: "TRA-SAR-001", name: "Sartén T-fal 24 cm" },
];

const CODE_TIPS = [
  "Si el producto ya tiene código de barras, escanéalo o cópialo tal cual. Es único y evita errores.",
  "Si no tiene código de barras, arma uno con esta estructura: Departamento + Categoría + número consecutivo.",
  "Usa 3 letras del departamento, 3 letras de la categoría y un consecutivo: ABA-REF-001, ABA-REF-002…",
  "Así los productos quedan agrupados por departamento y categoría, y son fáciles de encontrar.",
  "Sin espacios, sin acentos y sin caracteres raros (usa solo letras, números y guiones).",
  "Nunca repitas un código. Cada producto debe tener el suyo.",
  "Mantén siempre el mismo formato para que sea fácil de buscar y ordenar.",
];

const NAME_TIPS = [
  "Sigue la fórmula: Producto + Marca + Presentación o Tamaño.",
  "Ejemplo: Refresco → Coca-Cola 600 ml. Cuaderno → Scribe profesional 100 hojas.",
  "Escribe el nombre completo, sin abreviaturas raras (usa 'Refresco', no 'Rfsco').",
  "Incluye tamaño, color o talla cuando ayude a distinguirlo: 'Playera Nike talla M negra'.",
  "Sé consistente: si un producto lleva la marca, todos los similares también.",
  "Piensa en cómo lo buscaría el cajero al vender, y nómbralo así.",
];

const PRESENTATION_TIPS = [
  "Una presentación es una forma de vender el mismo producto en distinto empaque o cantidad.",
  "Sirve para vender a mayoreo sin crear otro producto: por caja, reja, six, cono, paquete, etc.",
  "La presentación base siempre es la unidad individual (1 pieza). No se puede borrar.",
  "Cada presentación indica cuántas piezas incluye y a qué precio se vende ese empaque.",
  "Al vender por mayoreo, el sistema descuenta del inventario las piezas que trae la presentación.",
  "Usa el mayoreo para dar un mejor precio por pieza y motivar la compra en volumen.",
];

interface PresentationExample {
  producto: string;
  icon: string;
  nombre: string;
  cantidad: string;
  precio: string;
  /** Precio por pieza cuando se compra suelta (más caro). */
  precioPieza: string;
  /** Precio por pieza dentro de la presentación (más barato, incentivo de mayoreo). */
  precioUnitario: string;
}

// Ejemplos de presentaciones para venta a mayoreo.
// El precio unitario de la presentación es MENOR al precio por pieza suelta
// para mostrar el ahorro que motiva la compra en volumen.
const PRESENTATION_EXAMPLES: PresentationExample[] = [
  { producto: "Refresco", icon: "🥤", nombre: "Six", cantidad: "6 piezas", precio: "$78.00", precioPieza: "$15.00", precioUnitario: "$13.00" },
  { producto: "Cerveza", icon: "🍺", nombre: "Caja", cantidad: "24 piezas", precio: "$320.00", precioPieza: "$15.00", precioUnitario: "$13.33" },
  { producto: "Refresco de vidrio", icon: "🧴", nombre: "Reja", cantidad: "12 piezas", precio: "$150.00", precioPieza: "$14.00", precioUnitario: "$12.50" },
  { producto: "Huevo", icon: "🥚", nombre: "Cono (30 pzas)", cantidad: "30 piezas", precio: "$95.00", precioPieza: "$3.50", precioUnitario: "$3.17" },
  { producto: "Papas", icon: "🥔", nombre: "Bulto", cantidad: "25 kg", precio: "$480.00", precioPieza: "$22.00", precioUnitario: "$19.20" },
];

const ProductHelpModal: React.FC<ProductHelpModalProps> = ({ isOpen, topic, onClose }) => {
  if (!isOpen) return null;

  const isCode = topic === "code";
  const isPresentation = topic === "presentation";

  const title = isPresentation
    ? "Presentaciones para venta a mayoreo"
    : isCode
    ? "Cómo crear el Código del producto"
    : "Cómo crear el Nombre del producto";

  const subtitle = isPresentation
    ? "Vende el mismo producto por caja, reja, six o cono sin duplicar productos."
    : isCode
    ? "Arma el código por Departamento + Categoría + consecutivo para agrupar y encontrar rápido."
    : "Un buen nombre facilita encontrar el producto y evita confusiones al vender.";

  const tips = isPresentation ? PRESENTATION_TIPS : isCode ? CODE_TIPS : NAME_TIPS;
  const headerIcon = isPresentation ? "📦" : isCode ? "🏷️" : "📝";
  const exampleKey: keyof RubroExample = isCode ? "code" : "name";

  return (
    <div className="phelp-overlay" onClick={onClose}>
      <div
        className="phelp-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="phelp-header">
          <div className="phelp-header-icon">{headerIcon}</div>
          <div className="phelp-header-text">
            <h2 className="phelp-title">{title}</h2>
            <p className="phelp-subtitle">{subtitle}</p>
          </div>
          <button
            type="button"
            className="phelp-close"
            onClick={onClose}
            title="Cerrar"
            aria-label="Cerrar ayuda"
          >
            ×
          </button>
        </div>

        <div className="phelp-body">
          <section className="phelp-section">
            <h3 className="phelp-section-title">✅ Buenas prácticas</h3>
            <ul className="phelp-tips">
              {tips.map((tip, i) => (
                <li key={i} className="phelp-tip">
                  {tip}
                </li>
              ))}
            </ul>
          </section>

          <section className="phelp-section">
            <h3 className="phelp-section-title">
              {isPresentation ? "📦 Ejemplos de presentaciones" : "📚 Ejemplos por rubro"}
            </h3>

            {isPresentation ? (
              <div className="phelp-pres-table">
                <div className="phelp-pres-row phelp-pres-head">
                  <span>Producto</span>
                  <span>Presentación</span>
                  <span>Contiene</span>
                  <span className="phelp-pres-right">Precio por pieza</span>
                  <span className="phelp-pres-right">Pieza en mayoreo</span>
                  <span className="phelp-pres-right">Total</span>
                </div>
                {PRESENTATION_EXAMPLES.map((ex) => (
                  <div key={ex.producto + ex.nombre} className="phelp-pres-row">
                    <span className="phelp-pres-prod">
                      <span className="phelp-example-icon">{ex.icon}</span>
                      {ex.producto}
                    </span>
                    <span className="phelp-pres-badge">{ex.nombre}</span>
                    <span className="phelp-pres-muted">{ex.cantidad}</span>
                    <span className="phelp-pres-right phelp-pres-strike">{ex.precioPieza}</span>
                    <span className="phelp-pres-right phelp-pres-unit">{ex.precioUnitario}</span>
                    <span className="phelp-pres-right phelp-pres-price">{ex.precio}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="phelp-examples">
                {RUBRO_EXAMPLES.map((ex) => (
                  <div key={ex.rubro} className="phelp-example-card">
                    <div className="phelp-example-rubro">
                      <span className="phelp-example-icon">{ex.icon}</span>
                      <span>{ex.rubro}</span>
                    </div>
                    <div className="phelp-example-value">{ex[exampleKey]}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {isPresentation ? (
            <div className="phelp-note">
              💡 Consejo: al comprar por caja, reja o six, la pieza sale más barata que suelta. Ese ahorro es lo
              que motiva al cliente a llevar más. La presentación base (1 pieza) siempre es obligatoria.
            </div>
          ) : isCode ? (
            <div className="phelp-note">
              💡 Estructura recomendada: <strong>DEPARTAMENTO - CATEGORÍA - CONSECUTIVO</strong>. Ejemplo:
              Abarrotes › Refrescos › 001 = <strong>ABA-REF-001</strong>. Define los prefijos una sola vez y
              respétalos siempre.
            </div>
          ) : (
            <div className="phelp-note">
              💡 Consejo: nombra el producto como lo buscarías tú al vender. Si dudas, lee el ejemplo del rubro.
            </div>
          )}
        </div>

        <div className="phelp-footer">
          <button type="button" className="phelp-btn-ok" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductHelpModal;
