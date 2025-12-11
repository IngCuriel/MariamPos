import express from "express";
import { getSyncStats, forceSync } from "../sync/syncService.mjs";
import { getProductSyncStats, forceProductSync } from "../sync/productSyncService.mjs";

const router = express.Router();

// Obtener estadísticas de sincronización de ventas
router.get("/stats", async (req, res) => {
  try {
    const stats = await getSyncStats();
    res.json(stats);
  } catch (error) {
    console.error("Error al obtener estadísticas de sincronización:", error);
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

// Forzar sincronización inmediata de ventas
router.post("/force", async (req, res) => {
  try {
    await forceSync();
    res.json({ message: "Sincronización forzada iniciada" });
  } catch (error) {
    console.error("Error al forzar sincronización:", error);
    res.status(500).json({ error: error.message || "Error al forzar sincronización" });
  }
});

// Obtener estadísticas de sincronización de productos
router.get("/products/stats", async (req, res) => {
  try {
    const stats = await getProductSyncStats();
    res.json(stats);
  } catch (error) {
    console.error("Error al obtener estadísticas de sincronización de productos:", error);
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

// Forzar sincronización inmediata de productos
router.post("/products/force", async (req, res) => {
  try {
    const { limit } = req.body; // Límite opcional de productos a sincronizar
    const limitNumber = limit ? parseInt(limit) : 100; // Por defecto 100
    
    if (isNaN(limitNumber) || limitNumber < 1) {
      return res.status(400).json({ error: "El límite debe ser un número mayor a 0" });
    }
    
    const result = await forceProductSync(limitNumber);
    res.json(result);
  } catch (error) {
    console.error("Error al forzar sincronización de productos:", error);
    res.status(500).json({ error: error.message || "Error al forzar sincronización" });
  }
});

export default router;

