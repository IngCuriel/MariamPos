import express from "express";
import {
  cancelSale,
  returnSale,
  getSaleReversals,
  listReversals,
} from "../controllers/returnsController.js";

const router = express.Router();

// Reversal operations act on a sale, so the sale-scoped routes live under the
// `sales` resource. This router is mounted at `/api` AFTER the sales router, so
// these paths resolve as `/api/sales/:id/cancel`, `/api/sales/:id/return`,
// `/api/sales/:id/reversals` and `/api/returns`. The POST routes do not collide
// with the existing GET `/:id`, and `:id/reversals` is a distinct path segment.

// 🟢 Operaciones de reversión sobre una venta
router.post("/sales/:id/cancel", cancelSale);
router.post("/sales/:id/return", returnSale);
router.get("/sales/:id/reversals", getSaleReversals);

// 🟢 Bitácora de auditoría de cancelaciones/devoluciones
router.get("/returns", listReversals);

export default router;
