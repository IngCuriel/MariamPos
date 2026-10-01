import express from "express";
 import { createSales, getSales, getSalesById, getSalesByDateRange, getSalesSummary, getDailySales, getTopProducts, getSalesByPaymentMethod, getSalesByCategory, getSalesByDepartment, getSalesByClient, updateSalePaymentMethod} from "../controllers/salesController.js";
const router = express.Router();

// 🟢 Rutas específicas primero
router.get("/by-date-range", getSalesByDateRange);
router.get("/summary", getSalesSummary)
router.get("/daily", getDailySales)
router.get("/top-products", getTopProducts)
router.get("/by-payment-method", getSalesByPaymentMethod)
router.get("/by-category", getSalesByCategory)
router.get("/by-department", getSalesByDepartment)
router.get("/by-client", getSalesByClient)

// 🟢 Rutas generales después
router.get("/", getSales);
router.get("/:id", getSalesById);
router.post("/", createSales);
router.patch("/:id/payment-method", updateSalePaymentMethod);

export default router;