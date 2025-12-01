import express from "express";
import {
  getPrinters,
  getPrinterById,
  getDefaultPrinter,
  createPrinter,
  updatePrinter,
  deletePrinter,
  setDefaultPrinter,
} from "../controllers/printersController.js";

const router = express.Router();

// Obtener todas las impresoras
router.get("/", getPrinters);

// Obtener impresora predeterminada
router.get("/default", getDefaultPrinter);

// Obtener una impresora por ID
router.get("/:id", getPrinterById);

// Crear una nueva impresora
router.post("/", createPrinter);

// Actualizar una impresora
router.put("/:id", updatePrinter);

// Establecer impresora predeterminada
router.put("/:id/default", setDefaultPrinter);

// Eliminar una impresora
router.delete("/:id", deletePrinter);

export default router;

