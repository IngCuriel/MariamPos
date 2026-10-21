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
  getProductsByDepartmentForInventory,
  batchInitialInventory,
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
// Inventario inicial por departamento (asistente)
router.get("/by-department/:departmentId", getProductsByDepartmentForInventory);
router.post("/initial-batch", batchInitialInventory);

export default router;
