import express from "express";
import {
  getClientCredits,
  getAllPendingCredits,
  getClientCreditSummary,
  createCredit,
  createCreditPayment,
  getCreditById,
  getCreditsByDateRange,
  getCreditPaymentsByDateRange,
} from "../controllers/creditsController.js";

const router = express.Router();

// Obtener créditos de un cliente específico
router.get("/client/:clientId", getClientCredits);

// Obtener resumen de créditos de un cliente
router.get("/client/:clientId/summary", getClientCreditSummary);

// Obtener todos los créditos pendientes
router.get("/pending", getAllPendingCredits);

// Obtener créditos por rango de fechas
router.get("/by-date-range", getCreditsByDateRange);

// Obtener abonos por rango de fechas
router.get("/payments/by-date-range", getCreditPaymentsByDateRange);

// Obtener un crédito por ID
router.get("/:creditId", getCreditById);

// Crear un nuevo crédito
router.post("/", createCredit);

// Registrar un abono a un crédito
router.post("/:creditId/payment", createCreditPayment);

export default router;

