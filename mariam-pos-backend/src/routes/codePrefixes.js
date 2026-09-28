import express from "express";
import {
  getCodePrefixes,
  getPrefixByCategory,
  previewNextCode,
  suggestPrefix,
  createCodePrefix,
  updateCodePrefix,
  deleteCodePrefix,
} from "../controllers/codePrefixesController.js";

const router = express.Router();

router.get("/", getCodePrefixes);
router.get("/category/:categoryId", getPrefixByCategory);
router.get("/category/:categoryId/preview", previewNextCode);
router.get("/category/:categoryId/suggest", suggestPrefix);
router.post("/", createCodePrefix);
router.put("/:id", updateCodePrefix);
router.delete("/:id", deleteCodePrefix);

export default router;
