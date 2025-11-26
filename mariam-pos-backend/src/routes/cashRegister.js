import express from "express";
import {
  openShift,
  closeShift,
  getActiveShift,
  getShiftById,
  getShiftsByDateRange,
  getShiftSummary,
  cancelShift,
  createCashMovement,
  getCashMovementsByShift,
  deleteCashMovement,
} from "../controllers/cashRegisterController.js";

const router = express.Router();

// 🟢 Rutas específicas primero
router.get("/shifts/active", getActiveShift);
router.get("/shifts", getShiftsByDateRange);
router.get("/shifts/:id", getShiftById);
router.get("/shifts/:id/summary", getShiftSummary);

// 🟢 Rutas de acciones
router.post("/shifts/open", openShift);
router.post("/shifts/:id/close", closeShift);
router.delete("/shifts/:id", cancelShift);

// 🟢 Rutas de movimientos de efectivo
router.post("/cash-movements", createCashMovement);
router.get("/shifts/:shiftId/cash-movements", getCashMovementsByShift);
router.delete("/cash-movements/:id", deleteCashMovement);

export default router;

