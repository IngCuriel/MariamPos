import express from "express";
import { getProducts, createProduct, filterProducts, getProductsByCategoryId, updateProduct, deleteProduct } from "../controllers/productsController.js";
const router = express.Router();

router.get("/filters", filterProducts);
router.get("/category/:categoryId", getProductsByCategoryId);


router.get("/", getProducts);
router.post("/", createProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

export default router;