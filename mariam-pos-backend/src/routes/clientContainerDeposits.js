import express from "express";
import {
  createClientContainerDeposit,
  getClientPendingDeposits,
  returnClientContainerDeposit,
  returnAllClientContainerDeposits,
  getAllClientContainerDeposits,
} from "../controllers/clientContainerDepositsController.js";

const router = express.Router();

// Crear depósito de envase de cliente
router.post("/", createClientContainerDeposit);

// Obtener todos los depósitos (con filtros opcionales)
router.get("/", getAllClientContainerDeposits);

// Obtener depósitos pendientes de un cliente
router.get("/client/:clientId/pending", getClientPendingDeposits);

// Marcar depósito como devuelto
router.post("/:id/return", returnClientContainerDeposit);

// Marcar todos los depósitos pendientes de un cliente como devueltos
router.post("/client/:clientId/return-all", returnAllClientContainerDeposits);

export default router;

