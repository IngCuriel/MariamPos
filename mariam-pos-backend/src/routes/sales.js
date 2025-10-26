import express from "express";
 import { createSales, getSales, getSalesById, getSalesByDateRange, getSalesSummary, getDailySales, getTopProducts, getSalesByPaymentMethod} from "../controllers/salesController.js";
const router = express.Router();

// 🟢 Rutas específicas primero
router.get("/by-date-range", getSalesByDateRange);
router.get("/summary", getSalesSummary)
router.get("/daily", getDailySales)
router.get("/top-products", getTopProducts)
router.get("/by-payment-method", getSalesByPaymentMethod)

// 🟢 Rutas generales después
router.get("/", getSales);
router.get("/:id", getSalesById);
router.post("/", createSales);

export default router;