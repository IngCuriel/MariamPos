import express from "express";

const router = express.Router();

/**
 * Endpoint de health check para verificar que el servidor está activo
 * Útil para detección automática de conexión
 */
router.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "MariamPOS Backend está activo",
    timestamp: new Date().toISOString(),
  });
});

export default router;

