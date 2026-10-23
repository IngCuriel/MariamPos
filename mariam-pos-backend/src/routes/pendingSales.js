import express from "express";
import {
  getPendingSales,
  getPendingSaleById,
  createPendingSale,
  deletePendingSale,
  updatePendingSale,
  markPendingSalePaidHandler,
} from "../controllers/pendingSalesController.js";

const router = express.Router();

router.get("/", getPendingSales);
router.get("/:id", getPendingSaleById);
router.post("/", createPendingSale);
router.delete("/:id", deletePendingSale);
router.put("/:id", updatePendingSale);
router.patch("/:id/pay", markPendingSalePaidHandler); // nuevo (Req 4)

export default router;

