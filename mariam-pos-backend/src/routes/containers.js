import express from "express";
import {
  getContainers,
  getContainerById,
  createContainer,
  updateContainer,
  deleteContainer,
  getProductsForSelector,
} from "../controllers/containersController.js";

const router = express.Router();

// Obtener todos los envases
router.get("/", getContainers);

// Obtener productos para selector
router.get("/products", getProductsForSelector);

// Obtener un envase por ID
router.get("/:id", getContainerById);

// Crear un nuevo envase
router.post("/", createContainer);

// Actualizar un envase
router.put("/:id", updateContainer);

// Eliminar un envase
router.delete("/:id", deleteContainer);

export default router;

