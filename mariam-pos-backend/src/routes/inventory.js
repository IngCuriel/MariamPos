import { Router } from "express";
import {
  getInventory,
  getProductInventory,
  getLowStockProducts,
  createInventoryMovement,
  getProductMovements,
  getAllMovements,
  updateStock,
  toggleInventoryTracking,
} from "../controllers/inventoryController.js";

const router = Router();

router.get("/", getInventory);
router.get("/product/:productId", getProductInventory);
router.get("/low-stock", getLowStockProducts);
router.post("/movements", createInventoryMovement);
router.get("/movements/product/:productId", getProductMovements);
router.get("/movements", getAllMovements);
router.put("/stock", updateStock);
router.patch("/tracking/:productId", toggleInventoryTracking);

export default router;
