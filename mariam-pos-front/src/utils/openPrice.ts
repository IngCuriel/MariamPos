// Pure, side-effect-free utilities for the "Precio Abierto" (open price) sale type.
//
// These functions concentrate the business logic of the feature so it can be
// unit-tested and property-tested in isolation, decoupled from the UI layer.
// They never mutate their inputs and always return new objects.
//
// Feature: precio-abierto

import type { Product, SaleTypeValue } from "../types";
import type { PendingSaleDetail } from "../api/pendingSales";

/** Canonical saleType value for open-price products. */
export const OPEN_PRICE_SALE_TYPE = "PrecioAbierto" as const;

/**
 * Minimal structural type for a cart line.
 *
 * Mirrors the shape of `ItemCart` in `salesPage.tsx` (which extends `Product`
 * with `quantity`/`price`) without importing from the UI module, keeping these
 * utilities pure and free of circular dependencies.
 */
export type OpenPriceCartLine = Product & {
  quantity: number;
  price: number;
  selectedPresentation?: unknown;
};

/**
 * Loose form-state shape accepted by `buildOpenPriceProduct`.
 *
 * The product form holds many fields in a transient state (price, cost,
 * presentations, tiers, promo, inventory). We accept any partial product-like
 * object and normalize it, so prior incompatible configurations are discarded.
 */
export type OpenPriceFormState = Partial<Product> & Record<string, unknown>;

/**
 * Returns true when the given product is sold using the open-price flow.
 */
export function isOpenPrice(product: { saleType?: SaleTypeValue }): boolean {
  return product.saleType === OPEN_PRICE_SALE_TYPE;
}

/**
 * Builds a normalized open-price product from an arbitrary form state.
 *
 * Regardless of any prior configuration (price, cost, presentations, tiered
 * pricing, promo, inventory), the result is forced into a consistent shape:
 * price/cost at 0, simple pricing, no tiers, no promo, no presentations and no
 * inventory tracking. This guarantees no contradictory data is persisted.
 *
 * Validates: Requirements 1.4, 2.5
 */
export function buildOpenPriceProduct(formState: OpenPriceFormState): Product {
  return {
    ...formState,
    price: 0,
    cost: 0,
    saleType: OPEN_PRICE_SALE_TYPE as SaleTypeValue,
    pricingMode: "simple",
    priceTiers: [],
    isPromo: false,
    promoPrice: 0,
    presentations: undefined,
    trackInventory: false,
  } as Product;
}

/**
 * Validates an open-price product for catalog saving.
 *
 * Valid if and only if `name` and `category` (categoryId) are non-empty.
 * It deliberately does NOT require `price > 0` nor `cost > 0`, since the price
 * is captured at sale time rather than stored in the catalog.
 *
 * Validates: Requirements 1.5, 1.6
 */
export function validateOpenPriceProduct(
  product: Pick<Product, "name" | "categoryId">
): boolean {
  const hasName = typeof product.name === "string" && product.name.trim().length > 0;
  const hasCategory =
    typeof product.categoryId === "string" && product.categoryId.trim().length > 0;
  return hasName && hasCategory;
}

/**
 * Builds a cart line for an open-price product using the captured price.
 *
 * The resulting line always has `quantity = 1` and `price = precio`, with no
 * selected presentation. Each call produces an independent line.
 *
 * Validates: Requirements 3.4, 3.7
 */
export function buildOpenPriceCartLine(
  product: Product,
  precio: number
): OpenPriceCartLine {
  return {
    ...product,
    quantity: 1,
    price: precio,
    selectedPresentation: undefined,
  };
}

/**
 * Returns true if the captured price is a valid open price: a finite number
 * strictly greater than 0.
 *
 * Validates: Requirements 3.5
 */
export function isValidOpenPrice(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Attempts to update the quantity of a cart line.
 *
 * If the line is an open-price line, its quantity is immutable at 1: a new line
 * with `quantity = 1` is returned without mutating the input. Otherwise the
 * change is applied to produce a new line with the updated quantity.
 *
 * Validates: Requirements 4.2
 */
export function tryUpdateQuantity<T extends OpenPriceCartLine>(
  line: T,
  change: number
): T {
  if (isOpenPrice(line)) {
    return { ...line, quantity: 1 };
  }
  return { ...line, quantity: line.quantity + change };
}

/**
 * Computes the subtotal of a cart line as `price * quantity`.
 */
export function lineSubtotal(
  line: Pick<OpenPriceCartLine, "price" | "quantity">
): number {
  return line.price * line.quantity;
}

/**
 * Serializes an open-price cart line into a pending-sale detail.
 *
 * The captured price is preserved in both `price` and `basePrice`, quantity is
 * pinned to 1, and `subTotal` equals the captured price (price * 1). The real
 * product identity (`productId`, `productName`) is kept so reports and reload
 * work against the actual catalog product.
 *
 * Validates: Requirements 5.1
 */
export function toPendingDetail(
  line: OpenPriceCartLine
): Omit<PendingSaleDetail, "id"> {
  const precio = line.price;
  return {
    productId: line.id,
    quantity: 1,
    price: precio,
    subTotal: precio,
    productName: line.name,
    saleType: OPEN_PRICE_SALE_TYPE as SaleTypeValue,
    basePrice: precio,
  };
}

/**
 * Restores an open-price cart line from a pending-sale detail.
 *
 * The captured price is recovered from `basePrice` when present, falling back
 * to `price`. Quantity is pinned to 1 and the sale type is forced to the
 * open-price value. As a defensive fallback, if the resolved price is not a
 * valid open price (<= 0 or non-finite), it defaults to `price` so the line is
 * never restored with an invalid amount. The price modal is never reopened.
 *
 * Validates: Requirements 5.2
 */
export function fromPendingDetail(detail: PendingSaleDetail): OpenPriceCartLine {
  const resolved = detail.basePrice ?? detail.price;
  const precio = isValidOpenPrice(resolved) ? resolved : detail.price;

  const product: Product = {
    id: detail.productId,
    code: "",
    name: detail.productName || "Producto",
    status: 1,
    saleType: OPEN_PRICE_SALE_TYPE as SaleTypeValue,
    price: precio,
    cost: 0,
    icon: "",
    categoryId: "",
    unitId: detail.product?.unitId ?? null,
    unit: detail.product?.unit ?? null,
  };

  return {
    ...product,
    quantity: 1,
    price: precio,
    selectedPresentation: undefined,
  };
}

/**
 * Shape of a sale-detail line produced for an open-price product.
 *
 * Mirrors the `SaleDetailInput` object built in `salesPage.confirmPayment`
 * (`Omit<SaleDetail, "id" | "saleId" | "product">`-compatible subset) without
 * importing from the UI module, keeping these utilities pure. The fields match
 * what the backend persists per `SaleItem`, including the free-text `saleType`.
 */
export type OpenPriceSaleDetail = {
  quantity: number;
  price: number;
  productName: string;
  subTotal: number;
  productId: number;
  unitAbbrev: string | null;
  saleType: SaleTypeValue;
};

/**
 * Builds the sale-detail line persisted for an open-price product.
 *
 * The captured price is used as the unit price, quantity is pinned to 1 so the
 * subtotal equals the captured price (price * 1), and the real product identity
 * (`productId`, `productName`) is preserved. `saleType` is forced to the
 * open-price value so reports can tell the line apart. Keeping the real name
 * guarantees reports never fall back to "Producto no registrado".
 *
 * Validates: Requirements 6.3
 */
export function buildSaleDetail(line: OpenPriceCartLine): OpenPriceSaleDetail {
  const precio = line.price;
  return {
    quantity: 1,
    price: precio,
    productName: line.name,
    subTotal: precio * 1,
    productId: line.id,
    unitAbbrev: null,
    saleType: OPEN_PRICE_SALE_TYPE as SaleTypeValue,
  };
}
