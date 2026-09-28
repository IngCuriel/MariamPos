import Swal from "sweetalert2";
import type { Product, ProductPriceTier } from "../../types/index";

// Resuelve el precio unitario según la cantidad (escalón simple).
export const resolveTierUnitPrice = (
  tiers: ProductPriceTier[],
  quantity: number
): number => {
  for (const t of tiers) {
    const maxOk = t.maxQty === null || t.maxQty === undefined || quantity <= t.maxQty;
    if (quantity >= t.minQty && maxOk) return t.unitPrice;
  }
  return tiers.length ? tiers[tiers.length - 1].unitPrice : 0;
};

/**
 * Modal para vender un producto con precio escalonado (tiered).
 * Pide la cantidad y muestra el precio del tramo aplicado + total.
 * Devuelve { cantidad, unitPrice } o null si se cancela.
 */
export const TieredQuantityModal = async (
  product: Product
): Promise<{ cantidad: number; unitPrice: number } | null> => {
  const tiers = (product.priceTiers || [])
    .slice()
    .sort((a, b) => a.minQty - b.minQty);

  if (tiers.length === 0) return null;

  const unitLabel = product.unit?.name || "pieza";

  // Tabla de tramos para mostrar como referencia.
  const tiersHTML = tiers
    .map((t) => {
      const rango = t.maxQty === null ? `${t.minQty} o más` : `${t.minQty} a ${t.maxQty}`;
      return `<div style="display:flex;justify-content:space-between;padding:4px 8px;border-bottom:1px solid #f1f5f9;font-size:0.85rem;">
        <span style="color:#475569;">${rango} ${unitLabel}${t.maxQty === 1 ? "" : "s"}</span>
        <strong style="color:#059669;">$${t.unitPrice.toFixed(2)} c/u</strong>
      </div>`;
    })
    .join("");

  const { value } = await Swal.fire({
    title: "",
    html: `
      <div style="text-align:center;margin-bottom:0.75rem;">
        <h3 style="margin:0;color:#1f2937;font-size:1.1rem;">${product.name}</h3>
        <p style="margin:0.2rem 0 0;color:#6b7280;font-size:0.82rem;">Precio según la cantidad</p>
      </div>
      <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:0.75rem;">
        ${tiersHTML}
      </div>
      <label for="tier-qty" style="display:block;text-align:left;font-weight:600;font-size:0.85rem;margin-bottom:0.35rem;">
        Cantidad:
      </label>
      <input id="tier-qty" type="number" min="1" step="1" value="1" inputmode="numeric"
        class="swal2-input" style="margin:0;width:100%;" placeholder="Ej: 15" />
      <div id="tier-result" style="margin-top:0.75rem;padding:0.6rem;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;font-size:0.95rem;color:#065f46;text-align:center;"></div>
    `,
    width: "420px",
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "✓ Agregar",
    cancelButtonText: "✕ Cancelar",
    confirmButtonColor: "#10b981",
    cancelButtonColor: "#64748b",
    allowEnterKey: true,
    didOpen: () => {
      const input = document.getElementById("tier-qty") as HTMLInputElement | null;
      const result = document.getElementById("tier-result") as HTMLElement | null;
      if (!input || !result) return;

      const update = () => {
        const qty = parseInt(input.value, 10) || 0;
        if (qty <= 0) {
          result.textContent = "Ingresa una cantidad válida";
          return;
        }
        const price = resolveTierUnitPrice(tiers, qty);
        result.innerHTML = `${qty} × $${price.toFixed(2)} = <strong>$${(qty * price).toFixed(2)}</strong>`;
      };

      input.addEventListener("input", update);
      update();
      setTimeout(() => {
        input.focus();
        input.select();
      }, 50);
    },
    preConfirm: () => {
      const input = document.getElementById("tier-qty") as HTMLInputElement | null;
      const qty = parseInt(input?.value || "0", 10);
      if (!qty || qty <= 0) {
        Swal.showValidationMessage("Ingresa una cantidad mayor a 0");
        return false;
      }
      return { cantidad: qty, unitPrice: resolveTierUnitPrice(tiers, qty) };
    },
  });

  if (value && typeof value === "object") {
    return value as { cantidad: number; unitPrice: number };
  }
  return null;
};
