// utils/returnCalculations.js
// Pure calculation helpers for cancellations and partial returns.
//
// IMPORTANT: Every function in this module is PURE — no database access, no
// side effects, no I/O. These functions are the base for property-based tests
// and are reused by `returnsController.js` to orchestrate transactional work.
//
// Terminology:
// - "sale unit" (unidad de venta): the unit `SaleDetail.quantity` is expressed
//   in (e.g. presentations such as "Bulto").
// - "base unit" (unidad base): the product's base unit used for inventory
//   movements (e.g. kg or pieces). `SaleDetail.baseUnitQuantity` holds the whole
//   row expressed in base units.

/**
 * Quantity still available to return for a sale detail line, in sale units.
 *
 * @param {{ quantity: number, returnedQuantity?: number }} detail
 * @returns {number}
 */
export function availableToReturn(detail) {
  const quantity = detail?.quantity ?? 0;
  const returnedQuantity = detail?.returnedQuantity ?? 0;
  return quantity - returnedQuantity;
}

/**
 * Validate a set of return lines against the sale's details.
 *
 * A line is invalid when the requested quantity is not strictly positive, when
 * it references a non-existent detail, or when it exceeds the quantity still
 * available to return for that detail (`quantity - returnedQuantity`).
 *
 * @param {Array<{ id: number, quantity: number, returnedQuantity?: number }>} details
 * @param {Array<{ saleDetailId: number, quantity: number }>} lines
 * @returns {{ ok: boolean, errors: Array<{ saleDetailId: number, requested: number, available: number }> }}
 */
export function validateReturnLines(details, lines) {
  const detailsById = new Map((details ?? []).map((d) => [d.id, d]));
  const errors = [];

  for (const line of lines ?? []) {
    const detail = detailsById.get(line.saleDetailId);
    const requested = line?.quantity ?? 0;

    // Unknown line, or non-positive quantity → no quantity is returnable.
    if (!detail) {
      errors.push({ saleDetailId: line.saleDetailId, requested, available: 0 });
      continue;
    }

    const available = availableToReturn(detail);

    if (requested <= 0 || requested > available) {
      errors.push({ saleDetailId: line.saleDetailId, requested, available });
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Conversion factor from a sale-unit quantity to the product's base unit.
 *
 * baseUnitFactor = baseUnitQuantity / quantity.
 * Falls back to 1 when the row has no base-unit data or a zero quantity (safe
 * for simple products and historical sales created before `baseUnitQuantity`).
 *
 * @param {{ quantity: number, baseUnitQuantity?: number }} detail
 * @returns {number}
 */
export function baseUnitFactor(detail) {
  const quantity = detail?.quantity ?? 0;
  if (!quantity) return 1;
  const baseUnitQuantity = detail?.baseUnitQuantity ?? quantity;
  return baseUnitQuantity / quantity;
}

/**
 * Quantity in base units to move in inventory for a returned line.
 *
 * @param {{ quantity: number, baseUnitQuantity?: number }} detail
 * @param {number} returnQuantity returned amount expressed in sale units
 * @returns {number}
 */
export function inventoryDeltaForLine(detail, returnQuantity) {
  return returnQuantity * baseUnitFactor(detail);
}

/**
 * Derive the sale status after applying returns.
 *
 * - "Devuelta": every line is fully returned (returnedQuantity == quantity).
 * - "Parcialmente Devuelta": at least one line has returnedQuantity > 0 and at
 *   least one line is not fully returned.
 * - null: nothing has been returned yet (caller keeps the current status).
 *
 * @param {Array<{ quantity: number, returnedQuantity?: number }>} details
 * @returns {"Devuelta" | "Parcialmente Devuelta" | null}
 */
export function computeNewSaleStatus(details) {
  const list = details ?? [];
  if (list.length === 0) return null;

  let anyReturned = false;
  let allFullyReturned = true;

  for (const detail of list) {
    const quantity = detail?.quantity ?? 0;
    const returnedQuantity = detail?.returnedQuantity ?? 0;

    if (returnedQuantity > 0) anyReturned = true;
    if (returnedQuantity < quantity) allFullyReturned = false;
  }

  if (!anyReturned) return null;
  return allFullyReturned ? "Devuelta" : "Parcialmente Devuelta";
}

/**
 * Extract the cash portion of a payment method string.
 *
 * Mirrors the parsing in `cashRegisterController.js` exactly so that reversals
 * and the shift cut (`getShiftSummary` / `closeShift`) agree on how much cash a
 * sale produced:
 *   - "Mixto (Efectivo: $X, Tarjeta: $Y)" → X (parsed from the string)
 *   - "Efectivo" / "cash"                 → the full `total`
 *   - anything else (tarjeta, regalo, …)  → 0
 *
 * The cash portion is clamped to be non-negative.
 *
 * @param {string | null | undefined} paymentMethod
 * @param {number} total total amount of the sale (used for pure-cash payments)
 * @returns {number}
 */
export function cashPortionFromPaymentMethod(paymentMethod, total) {
  const method = (paymentMethod || "").toLowerCase();
  const totalAmount = total || 0;

  let cash;
  if (method.includes("mixto")) {
    // Format: "Mixto (Efectivo: $X, Tarjeta: $Y)"
    const cashMatch = method.match(/efectivo[:\s]*\$?([\d.]+)/i);
    cash = cashMatch ? parseFloat(cashMatch[1]) : 0;
  } else if (method.includes("efectivo") || method === "cash") {
    cash = totalAmount;
  } else {
    cash = 0;
  }

  if (!Number.isFinite(cash) || cash < 0) return 0;
  return cash;
}

/**
 * Cash amount to refund for a reversal.
 *
 * - Cancellation: pass `{ paymentMethod, amount: total }` to get the cash
 *   portion of the whole sale (handles mixed payments).
 * - Return: pass `{ paymentMethod, amount: Σ returned line subtotals }` to get
 *   the cash portion of the returned lines.
 *
 * The result is never negative.
 *
 * @param {{ paymentMethod?: string | null, amount?: number }} params
 * @returns {number}
 */
export function cashRefundAmount({ paymentMethod, amount } = {}) {
  return cashPortionFromPaymentMethod(paymentMethod, amount);
}
