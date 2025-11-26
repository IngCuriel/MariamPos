import express from "express";
import { getSyncStats, forceSync } from "../sync/syncService.mjs";

const router = express.Router();

// Obtener estadísticas de sincronización
router.get("/stats", async (req, res) => {
  try {
    const stats = await getSyncStats();
    res.json(stats);
  } catch (error) {
    console.error("Error al obtener estadísticas de sincronización:", error);
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

// Forzar sincronización inmediata
router.post("/force", async (req, res) => {
  try {
    await forceSync();
    res.json({ message: "Sincronización forzada iniciada" });
  } catch (error) {
    console.error("Error al forzar sincronización:", error);
    res.status(500).json({ error: error.message || "Error al forzar sincronización" });
  }
});

export default router;

