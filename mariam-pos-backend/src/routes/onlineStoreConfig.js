import express from "express";
import {
  getOnlineStoreConfig,
  upsertOnlineStoreConfig,
} from "../controllers/onlineStoreConfigController.js";

const router = express.Router();

router.get("/:branch", getOnlineStoreConfig); // Req 3 (también admite ?branch= si se omite el param)
router.put("/", upsertOnlineStoreConfig); // Req 4 (upsert)
router.post("/", upsertOnlineStoreConfig); // alias POST para el mismo upsert

// getDecryptedConfig NO se enruta: es un import interno para uso del propio backend.

export default router;
