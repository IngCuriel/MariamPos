import { Router } from "express";
import {
  getAccountPayables,
  getAccountPayableById,
  createAccountPayable,
  registerPayment,
  updateAccountPayable,
  deleteAccountPayable,
  getAccountPayablesSummary,
} from "../controllers/accountPayablesController.js";

const router = Router();

router.get("/", getAccountPayables);
router.get("/summary", getAccountPayablesSummary);
router.get("/:id", getAccountPayableById);
router.post("/", createAccountPayable);
router.post("/:id/payment", registerPayment);
router.put("/:id", updateAccountPayable);
router.delete("/:id", deleteAccountPayable);

export default router;

