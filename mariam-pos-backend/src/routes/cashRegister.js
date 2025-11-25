import express from "express";
import {
  openShift,
  closeShift,
  getActiveShift,
  getShiftById,
  getShiftsByDateRange,
  getShiftSummary,
  cancelShift,
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

export default router;

