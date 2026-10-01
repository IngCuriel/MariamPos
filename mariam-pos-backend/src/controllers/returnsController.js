// controllers/returnsController.js
// Transactional controllers for sale reversals: cancellations and partial
// returns. The guiding invariant is that a sale is NEVER deleted — a reversal
// only changes `Sale.status` and creates independent, immutable audit records
// (`SaleCancellation` / `SaleReturn`). Inventory and cash effects reuse the
// existing `InventoryMovement`, `Inventory`, and `CashMovement` mechanisms so
// the shift cut keeps balancing without parallel logic.
//
// Every mutating operation runs inside `prisma.$transaction` so the status
// change, audit record, inventory movements, and cash movement are applied
// atomically (all-or-nothing).

import prisma from "../utils/prisma.js";
import {
  cashRefundAmount,
  validateReturnLines,
  inventoryDeltaForLine,
  computeNewSaleStatus,
} from "../utils/returnCalculations.js";

// ------------------------------------------------------------
// Shared helpers (kept at the top so sibling controllers such as `returnSale`
// can reuse them when they are added to this file).
// ------------------------------------------------------------

// Canonical reasons that must always be classified as "merma" (shrinkage):
// the product does NOT return to stock. The backend revalidates these two
// reasons regardless of the client-provided classification (design: "the
// backend revalidates merma for the canonical reasons").
const CANONICAL_MERMA_REASONS = new Set([
  "Producto caducado",
  "Producto defectuoso / dañado",
]);

// Prisma enum values for the reversal reason classification.
const REASON_TYPE_MERMA = "MERMA";
const REASON_TYPE_ESTANDAR = "ESTANDAR";

/**
 * Resolve the effective reversal reason classification.
 *
 * Rules:
 * - Canonical merma reasons ("Producto caducado", "Producto defectuoso /
 *   dañado") are ALWAYS merma, regardless of the client classification.
 * - Otherwise the client-provided `reasonType` is honored ("merma" marks the
 *   free-text reason as shrinkage).
 *
 * @param {string} reason - Reason text.
 * @param {string | undefined} reasonType - Client classification ("merma" | "estandar").
 * @returns {"MERMA" | "ESTANDAR"} Prisma enum value.
 */
export function resolveReasonType(reason, reasonType) {
  const text = (reason || "").trim();
  if (CANONICAL_MERMA_REASONS.has(text)) {
    return REASON_TYPE_MERMA;
  }
  return String(reasonType || "").toLowerCase() === "merma"
    ? REASON_TYPE_MERMA
    : REASON_TYPE_ESTANDAR;
}

/**
 * Resolve the OPEN shift for a given branch + cash register.
 *
 * Mirrors `createSales`: looks up the active (`status: "OPEN"`) shift for the
 * cash register where the operation is executed TODAY (not the sale's original
 * shift). Returns `null` when no open shift exists.
 *
 * @param {object} tx - Prisma client or transaction client.
 * @param {string | null | undefined} branch
 * @param {string | null | undefined} cashRegister
 * @returns {Promise<object | null>}
 */
export async function resolveOpenShift(tx, branch, cashRegister) {
  if (!branch || !cashRegister) return null;
  return tx.cashRegisterShift.findFirst({
    where: { branch, cashRegister, status: "OPEN" },
  });
}

/**
 * Apply an inventory effect for a reversed line within a transaction.
 *
 * - Skips entirely when the product does not track inventory (`trackInventory`
 *   is false or there is no inventory row) — Req 6.1 / 6.2.
 * - ESTANDAR: creates an `ENTRADA` movement for the base-unit quantity and
 *   increments `Inventory.currentStock` — Req 6.3.
 * - MERMA: records the movement as an `AJUSTE` that leaves `currentStock`
 *   unchanged (stock is NOT incremented), so shrinkage stays auditable without
 *   returning product to stock — Req 6.4.
 *
 * `InventoryMovement.quantity` is an integer column, so the base-unit delta is
 * rounded to the nearest integer.
 *
 * @param {object} tx - Prisma transaction client.
 * @param {object} params
 * @param {object} params.inventory - The product's inventory row (or null).
 * @param {number} params.productId
 * @param {number} params.baseUnitDelta - Quantity to move in base units.
 * @param {"MERMA" | "ESTANDAR"} params.reasonType
 * @param {string} params.reason
 * @param {string} params.reference - e.g. "CANCEL#<id>".
 * @param {string | null} params.branch
 * @param {string | null} params.cashRegister
 * @param {string | null} params.createdBy
 * @returns {Promise<object | null>} The created movement, or null when skipped.
 */
export async function applyInventoryEffect(
  tx,
  {
    inventory,
    productId,
    baseUnitDelta,
    reasonType,
    reason,
    reference,
    branch,
    cashRegister,
    createdBy,
  }
) {
  // Req 6.1 / 6.2: only products with tracked inventory are affected.
  if (!inventory || !inventory.trackInventory) return null;

  const quantity = Math.round(baseUnitDelta);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const isMerma = reasonType === REASON_TYPE_MERMA;

  // MERMA (Req 6.4): record the movement as an AJUSTE that leaves the stock
  // equal to its current value, i.e. the product does NOT return to stock.
  // ESTANDAR (Req 6.3): ENTRADA that increments the stock by the base-unit
  // quantity.
  const movement = await tx.inventoryMovement.create({
    data: {
      productId,
      inventoryId: inventory.id,
      type: isMerma ? "AJUSTE" : "ENTRADA",
      quantity,
      reason,
      reference,
      notes: isMerma ? "Merma: el producto no regresa a existencias" : null,
      branch,
      cashRegister,
      createdBy,
    },
  });

  const newStock = isMerma
    ? inventory.currentStock
    : inventory.currentStock + quantity;

  await tx.inventory.update({
    where: { productId },
    data: { currentStock: newStock, lastMovementDate: new Date() },
  });

  return movement;
}

/**
 * Build the reversal receipt payload (Req 10).
 *
 * @param {object} params
 * @param {"CANCELACION" | "DEVOLUCION"} params.type
 * @param {object} params.sale
 * @param {string} params.reason
 * @param {"MERMA" | "ESTANDAR"} params.reasonType
 * @param {number} params.refundedAmount
 * @param {Array<{ productName: string, quantity: number, subTotal: number }> | undefined} params.lines
 * @returns {object} ReversalReceipt
 */
export function buildReversalReceipt({
  type,
  sale,
  reason,
  reasonType,
  refundedAmount,
  lines,
}) {
  const receipt = {
    type,
    originalFolio: sale.folio ?? null,
    dateTime: new Date().toISOString(),
    cashier: sale.createdBy ?? null,
    branch: sale.branch ?? null,
    cashRegister: sale.cashRegister ?? null,
    reason,
    reasonType: reasonType === REASON_TYPE_MERMA ? "merma" : "estandar",
    refundedAmount,
  };
  if (lines) receipt.lines = lines;
  return receipt;
}

// ------------------------------------------------------------
// POST /sales/:id/cancel — cancel a whole sale.
// ------------------------------------------------------------

/**
 * Cancel a complete sale.
 *
 * Flow (see design "Flujo de Cancelación"):
 * 1. Validate: non-empty reason (400), sale exists (404), sale not already
 *    "Cancelada" (409).
 * 2. Compute the cash portion to refund (handles mixed payments). If a cash
 *    refund is required and there is no OPEN shift on the cash register, reject
 *    with 409 `requiresShift` (Req 7.7).
 * 3. In a single transaction: set `Sale.status = "Cancelada"`, create the
 *    `SaleCancellation` audit record, create inventory movements (only for
 *    `trackInventory = true`; ESTANDAR increments stock, MERMA does not), and
 *    create a `CashMovement` SALIDA for the cash portion when applicable.
 * 4. Return the sale, the cancellation, the movements, and the receipt (201).
 */
export const cancelSale = async (req, res) => {
  try {
    const saleId = parseInt(req.params.id, 10);
    // `refundMethod` (opcional): cómo se le devuelve el dinero al cliente al
    // cancelar. Lo decide explícitamente la cajera, no se deduce del método de
    // cobro de la venta:
    //   - "efectivo"      → se registra la SALIDA de efectivo de la caja.
    //   - "transferencia" → se devuelve por fuera; NO toca el efectivo de caja.
    //   - "none"          → no se devuelve dinero (p. ej. error del cajero).
    // Por compatibilidad, si no viene `refundMethod` se infiere del método de
    // pago de la venta (comportamiento anterior).
    const { reason, reasonType, createdBy, refundMethod } = req.body ?? {};

    // Req 3.1 / 1.4: a non-empty reason is mandatory.
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: "El motivo es obligatorio" });
    }

    if (!Number.isInteger(saleId)) {
      return res.status(400).json({ error: "Id de venta inválido" });
    }

    // Load the sale with its details and the inventory of each product so the
    // transaction can decide inventory effects without extra round trips.
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        details: { include: { product: { include: { inventory: true } } } },
      },
    });

    // Req: sale must exist.
    if (!sale) {
      return res.status(404).json({ error: "Venta no encontrada" });
    }

    // Req 1.5: a sale already "Cancelada" cannot be cancelled again; keep its
    // current state.
    if (sale.status === "Cancelada") {
      return res.status(409).json({ error: "La venta ya está cancelada" });
    }

    // Resolve audit/location fields. The branch and cash register default to
    // the sale's own values; the active shift is resolved for that register.
    const branch = req.body?.branch ?? sale.branch ?? null;
    const cashRegister = req.body?.cashRegister ?? sale.cashRegister ?? null;
    const cashier = createdBy?.trim?.() || sale.createdBy || null;

    const effectiveReasonType = resolveReasonType(reason, reasonType);

    // Decidir la devolución de efectivo según `refundMethod` (explícito).
    // Solo "efectivo" genera salida de efectivo de la caja. "transferencia" y
    // "none" no tocan la caja. Si `refundMethod` no viene (compatibilidad), se
    // mantiene el comportamiento anterior: deducir del método de pago.
    const normalizedRefund = String(refundMethod || "").trim().toLowerCase();
    let cashPortion;
    if (normalizedRefund === "efectivo") {
      // Devuelve en efectivo el total de la venta (no aplica a "Pendiente").
      cashPortion = sale.status === "Pendiente" ? 0 : sale.total || 0;
    } else if (
      normalizedRefund === "transferencia" ||
      normalizedRefund === "none"
    ) {
      cashPortion = 0;
    } else {
      // Compatibilidad: sin refundMethod, deducir del método de pago.
      cashPortion =
        sale.status === "Pendiente"
          ? 0
          : cashRefundAmount({
              paymentMethod: sale.paymentMethod,
              amount: sale.total,
            });
    }
    const requiresCashRefund = cashPortion > 0;

    // Resolve the OPEN shift for the register where the cancellation happens.
    const activeShift = await resolveOpenShift(prisma, branch, cashRegister);

    // Req 7.7: a cash refund requires an OPEN shift. Reject before mutating.
    if (requiresCashRefund && !activeShift) {
      return res.status(409).json({
        error:
          "Se requiere un turno de caja abierto para registrar la salida de efectivo",
        requiresShift: true,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Req 1.1: mark the sale as cancelled (original sale is preserved).
      const updatedSale = await tx.sale.update({
        where: { id: saleId },
        data: { status: "Cancelada" },
        include: { details: { include: { product: true } } },
      });

      // Req 7: register the cash movement first (when applicable) so its id can
      // be linked from the audit record. The `reason` is self-descriptive using
      // the sale's numeric table id (always present), and `notes` carries the
      // reversal reason only.
      let cashMovement = null;
      if (requiresCashRefund && activeShift) {
        cashMovement = await tx.cashMovement.create({
          data: {
            shiftId: activeShift.id,
            type: "SALIDA",
            amount: cashPortion,
            reason: `Venta #${saleId} cancelada`,
            notes: String(reason).trim(),
            createdBy: cashier,
          },
        });
      }

      // Req 1.6 / 5.1: create the cancellation audit record linked to the sale
      // and to the active shift.
      const cancellation = await tx.saleCancellation.create({
        data: {
          saleId,
          reason: String(reason).trim(),
          reasonType: effectiveReasonType,
          createdBy: cashier,
          branch,
          cashRegister,
          shiftId: activeShift?.id ?? null,
          cashMovementId: cashMovement?.id ?? null,
          refundedAmount: cashPortion,
        },
      });

      // Req 6: inventory effects, one movement per tracked line. The whole line
      // is reversed on a cancellation, so the base-unit delta is the line's
      // `baseUnitQuantity` (falls back to `quantity` for historical sales).
      const inventoryMovements = [];
      for (const detail of sale.details) {
        const inventory = detail.product?.inventory ?? null;
        const baseUnitDelta = detail.baseUnitQuantity ?? detail.quantity;
        const movement = await applyInventoryEffect(tx, {
          inventory,
          productId: detail.productId,
          baseUnitDelta,
          reasonType: effectiveReasonType,
          reason,
          reference: `CANCEL#${cancellation.id}`,
          branch,
          cashRegister,
          createdBy: cashier,
        });
        if (movement) inventoryMovements.push(movement);
      }

      return { updatedSale, cancellation, cashMovement, inventoryMovements };
    });

    const receipt = buildReversalReceipt({
      type: "CANCELACION",
      sale: result.updatedSale,
      reason: String(reason).trim(),
      reasonType: effectiveReasonType,
      refundedAmount: cashPortion,
    });

    return res.status(201).json({
      sale: result.updatedSale,
      cancellation: result.cancellation,
      cashMovement: result.cashMovement,
      inventoryMovements: result.inventoryMovements,
      receipt,
    });
  } catch (error) {
    console.error("Error al cancelar la venta:", error);
    return res.status(500).json({ error: "Error al cancelar la venta" });
  }
};

// ------------------------------------------------------------
// POST /sales/:id/return — partial return of one or more lines.
// ------------------------------------------------------------

/**
 * Register a partial return of one or more sale lines.
 *
 * Flow (see design "Flujo de Devolución parcial"):
 * 1. Validate: non-empty reason (400), at least one line (400), sale and every
 *    referenced detail exist (404). Use `validateReturnLines`; if any requested
 *    quantity exceeds the quantity still available for that line, reject with
 *    400 and the per-line availability map `availableByLine` (Req 2.3).
 * 2. Compute the cash portion to refund as the cash portion of the sum of the
 *    returned line subtotals (only when the client requested a physical cash
 *    refund via `refundsCash` and the sale was paid in cash — Req 7.4). If a
 *    cash refund is required and there is no OPEN shift, reject with 409
 *    `requiresShift` (Req 2.10 / 7.7).
 * 3. In a single transaction: create the `SaleReturn` + `SaleReturnLine[]`,
 *    increment `SaleDetail.returnedQuantity` per line, move inventory per
 *    `inventoryDeltaForLine` (only `trackInventory = true`; ESTANDAR increments
 *    stock, MERMA does not), derive the new `Sale.status` with
 *    `computeNewSaleStatus`, and create a `CashMovement` SALIDA for the cash
 *    portion when applicable.
 * 4. Return the sale, the return (with lines), the movements, and the receipt
 *    (201).
 */
export const returnSale = async (req, res) => {
  try {
    const saleId = parseInt(req.params.id, 10);
    // `refundMethod`: cómo se le devuelve el dinero al cliente. Lo decide la
    // cajera: "efectivo" (sale de la caja), "transferencia" (por fuera) o
    // "none" (no se devuelve). Compatibilidad: si llega el viejo `refundsCash`
    // booleano, se interpreta como "efectivo".
    const { reason, reasonType, createdBy, refundMethod, refundsCash, lines } =
      req.body ?? {};

    // Req 3.2: a non-empty reason is mandatory.
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: "El motivo es obligatorio" });
    }

    if (!Number.isInteger(saleId)) {
      return res.status(400).json({ error: "Id de venta inválido" });
    }

    // Req 2.1: at least one line is required.
    if (!Array.isArray(lines) || lines.length === 0) {
      return res
        .status(400)
        .json({ error: "Se requiere al menos una línea a devolver" });
    }

    // Normalize lines to { saleDetailId, quantity } with numeric values.
    const normalizedLines = lines.map((line) => ({
      saleDetailId: Number(line?.saleDetailId),
      quantity: Number(line?.quantity),
    }));

    // Load the sale with its details and the inventory of each product so the
    // transaction can decide inventory effects without extra round trips.
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        details: { include: { product: { include: { inventory: true } } } },
      },
    });

    // Req: sale must exist.
    if (!sale) {
      return res.status(404).json({ error: "Venta no encontrada" });
    }

    // 404 when any line references a detail that does not belong to the sale.
    const detailsById = new Map(sale.details.map((d) => [d.id, d]));
    const missingLine = normalizedLines.find(
      (line) => !detailsById.has(line.saleDetailId)
    );
    if (missingLine) {
      return res.status(404).json({
        error: "Renglón de venta no encontrado",
        saleDetailId: missingLine.saleDetailId,
      });
    }

    // Req 2.3: a requested quantity may not exceed the available quantity
    // (quantity - returnedQuantity). Report the available amount per line.
    const validation = validateReturnLines(sale.details, normalizedLines);
    if (!validation.ok) {
      const availableByLine = {};
      for (const err of validation.errors) {
        availableByLine[err.saleDetailId] = err.available;
      }
      return res.status(400).json({
        error:
          "La cantidad a devolver excede la cantidad disponible en una o más líneas",
        availableByLine,
      });
    }

    // Resolve audit/location fields. The branch and cash register default to
    // the sale's own values; the active shift is resolved for that register.
    const branch = req.body?.branch ?? sale.branch ?? null;
    const cashRegister = req.body?.cashRegister ?? sale.cashRegister ?? null;
    const cashier = createdBy?.trim?.() || sale.createdBy || null;

    const effectiveReasonType = resolveReasonType(reason, reasonType);

    // Build per-line subtotals from the ORIGINAL sale price of each detail so
    // the refund never depends on a (possibly changed) current price.
    const returnLines = normalizedLines.map((line) => {
      const detail = detailsById.get(line.saleDetailId);
      return {
        detail,
        saleDetailId: line.saleDetailId,
        quantity: line.quantity,
        subTotal: detail.price * line.quantity,
        baseUnitQuantity: inventoryDeltaForLine(detail, line.quantity),
      };
    });

    // Monto total devuelto al cliente = suma de subtotales de las líneas
    // devueltas (precio original). Esto es lo que se registra como
    // `refundedAmount` SIEMPRE (comprobante/bitácora), sin importar el medio.
    const returnedSubtotalSum = returnLines.reduce(
      (sum, line) => sum + line.subTotal,
      0
    );

    // Normalizar el medio de devolución. Compatibilidad: refundsCash=true → efectivo.
    const normalizedRefund = refundsCash
      ? "efectivo"
      : String(refundMethod || "").trim().toLowerCase();

    // La SALIDA de efectivo de la caja ocurre SOLO si se devuelve en efectivo.
    // Transferencia / none / vacío → no toca la caja (cashPortion = 0).
    const cashPortion =
      normalizedRefund === "efectivo" ? returnedSubtotalSum : 0;
    const requiresCashRefund = cashPortion > 0;

    // Resolve the OPEN shift for the register where the return happens.
    const activeShift = await resolveOpenShift(prisma, branch, cashRegister);

    // Req 2.10 / 7.7: a cash refund requires an OPEN shift. Reject before
    // mutating.
    if (requiresCashRefund && !activeShift) {
      return res.status(409).json({
        error:
          "Se requiere un turno de caja abierto para registrar la salida de efectivo",
        requiresShift: true,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Req 7: register the cash movement first (when applicable) so its id can
      // be linked from the audit record. The `reason` is self-descriptive
      // (operation + sale folio) and `notes` carries the full detail (folio,
      // reversal reason, and how many lines were returned).
      let cashMovement = null;
      if (requiresCashRefund && activeShift) {
        cashMovement = await tx.cashMovement.create({
          data: {
            shiftId: activeShift.id,
            type: "SALIDA",
            amount: cashPortion,
            reason: `Venta #${saleId} devuelta`,
            notes: String(reason).trim(),
            createdBy: cashier,
          },
        });
      }

      // Req 2.6 / 5.2: create the return audit record with its lines.
      const saleReturn = await tx.saleReturn.create({
        data: {
          saleId,
          reason: String(reason).trim(),
          reasonType: effectiveReasonType,
          createdBy: cashier,
          branch,
          cashRegister,
          shiftId: activeShift?.id ?? null,
          cashMovementId: cashMovement?.id ?? null,
          // Monto devuelto al cliente (siempre), independiente del medio.
          refundedAmount: returnedSubtotalSum,
          lines: {
            create: returnLines.map((line) => ({
              saleDetailId: line.saleDetailId,
              quantity: line.quantity,
              baseUnitQuantity: line.baseUnitQuantity,
              subTotal: line.subTotal,
            })),
          },
        },
        include: { lines: true },
      });

      // Req 2.1 / 6: per returned line, increment returnedQuantity and move
      // inventory (only for tracked products; ESTANDAR increments stock, MERMA
      // leaves it unchanged).
      const inventoryMovements = [];
      for (const line of returnLines) {
        await tx.saleDetail.update({
          where: { id: line.saleDetailId },
          data: { returnedQuantity: { increment: line.quantity } },
        });

        const inventory = line.detail.product?.inventory ?? null;
        const movement = await applyInventoryEffect(tx, {
          inventory,
          productId: line.detail.productId,
          baseUnitDelta: line.baseUnitQuantity,
          reasonType: effectiveReasonType,
          reason,
          reference: `RETURN#${saleReturn.id}`,
          branch,
          cashRegister,
          createdBy: cashier,
        });
        if (movement) inventoryMovements.push(movement);
      }

      // Req 2.4 / 2.5: derive the new sale status from the UPDATED details.
      // Reflect the increments in memory so the derivation sees them.
      const updatedDetails = sale.details.map((detail) => {
        const line = returnLines.find((l) => l.saleDetailId === detail.id);
        return line
          ? {
              ...detail,
              returnedQuantity: (detail.returnedQuantity ?? 0) + line.quantity,
            }
          : detail;
      });
      const newStatus = computeNewSaleStatus(updatedDetails);

      const updatedSale = await tx.sale.update({
        where: { id: saleId },
        data: newStatus ? { status: newStatus } : {},
        include: { details: { include: { product: true } } },
      });

      return { updatedSale, saleReturn, cashMovement, inventoryMovements };
    });

    // Req 10.2: receipt with the returned lines.
    const receiptLines = returnLines.map((line) => ({
      productName:
        line.detail.productName ?? line.detail.product?.name ?? null,
      quantity: line.quantity,
      subTotal: line.subTotal,
    }));

    const receipt = buildReversalReceipt({
      type: "DEVOLUCION",
      sale: result.updatedSale,
      reason: String(reason).trim(),
      reasonType: effectiveReasonType,
      refundedAmount: returnedSubtotalSum,
      lines: receiptLines,
    });

    return res.status(201).json({
      sale: result.updatedSale,
      return: result.saleReturn,
      cashMovement: result.cashMovement,
      inventoryMovements: result.inventoryMovements,
      receipt,
    });
  } catch (error) {
    console.error("Error al registrar la devolución:", error);
    return res.status(500).json({ error: "Error al registrar la devolución" });
  }
};

// ------------------------------------------------------------
// GET /sales/:id/reversals — per-sale reversal audit log (Req 9.4).
// ------------------------------------------------------------

/**
 * Return a sale together with its reversal audit records.
 *
 * Req 9.4: when the owner looks up a sale with status "Cancelada",
 * "Parcialmente Devuelta" or "Devuelta", the system presents the original sale
 * along with its associated `SaleCancellation` / `SaleReturn` records. The sale
 * is never deleted, so this is the per-sale audit log (bitácora de esa venta).
 *
 * Includes:
 * - `details` (the original, immutable sale lines) with their product.
 * - `cancellation` (1:1, may be null).
 * - `returns` (1:N) with their `lines` (per-line returned quantities).
 */
export const getSaleReversals = async (req, res) => {
  try {
    const saleId = parseInt(req.params.id, 10);

    if (!Number.isInteger(saleId)) {
      return res.status(400).json({ error: "Id de venta inválido" });
    }

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        details: { include: { product: true } },
        cancellation: true,
        returns: {
          orderBy: { createdAt: "desc" },
          // Incluir el renglón original de cada línea para mostrar su nombre
          // (productName) en la bitácora de reversiones.
          include: { lines: { include: { saleDetail: true } } },
        },
      },
    });

    // Req: sale must exist.
    if (!sale) {
      return res.status(404).json({ error: "Venta no encontrada" });
    }

    return res.status(200).json(sale);
  } catch (error) {
    console.error("Error al consultar las reversiones de la venta:", error);
    return res
      .status(500)
      .json({ error: "Error al consultar las reversiones de la venta" });
  }
};

// ------------------------------------------------------------
// GET /returns — reversal audit log with filters (Req 5.4).
// ------------------------------------------------------------

/**
 * List cancellation and return audit records (bitácora de auditoría).
 *
 * Req 5.4: the owner can review the reversal audit log, which presents the
 * cashier, date and time, reason, branch, cash register and the sale of each
 * record. Returns a structured response `{ cancellations, returns }`.
 *
 * Optional query filters:
 * - `startDate` / `endDate` (YYYY-MM-DD): inclusive date range on `createdAt`,
 *   following the full-day range style used in `salesController.js`
 *   (`gte` start-of-day, `lte` end-of-day).
 * - `branch`: exact branch match.
 * - `cashRegister`: exact cash register match.
 */
export const listReversals = async (req, res) => {
  try {
    const { startDate, endDate, branch, cashRegister } = req.query;

    // Build a shared `where` applied to both cancellation and return records.
    const where = {};

    // Date range on createdAt (same full-day style as salesController.js).
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(`${startDate}T00:00:00.000`);
      }
      if (endDate) {
        where.createdAt.lte = new Date(`${endDate}T23:59:59.999`);
      }
    }

    if (branch) where.branch = branch;
    if (cashRegister) where.cashRegister = cashRegister;

    // Fetch both audit logs in parallel; include the original sale so the
    // consumer can present the sale of each record (Req 5.4).
    const [cancellations, returns] = await Promise.all([
      prisma.saleCancellation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { sale: true },
      }),
      prisma.saleReturn.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { sale: true, lines: true },
      }),
    ]);

    return res.status(200).json({ cancellations, returns });
  } catch (error) {
    console.error("Error al consultar la bitácora de reversiones:", error);
    return res
      .status(500)
      .json({ error: "Error al consultar la bitácora de reversiones" });
  }
};
