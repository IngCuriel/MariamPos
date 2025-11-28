import express from "express";
import {
  getPendingSales,
  getPendingSaleById,
  createPendingSale,
  deletePendingSale,
  updatePendingSale,
} from "../controllers/pendingSalesController.js";

const router = express.Router();

router.get("/", getPendingSales);
router.get("/:id", getPendingSaleById);
router.post("/", createPendingSale);
router.delete("/:id", deletePendingSale);
router.put("/:id", updatePendingSale);

export default router;

