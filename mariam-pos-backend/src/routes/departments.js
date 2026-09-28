import express from "express";
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentCategories,
  getUnassignedCategories,
  assignCategory,
  removeCategory,
} from "../controllers/departmentsController.js";

const router = express.Router();

router.get("/", getDepartments);
router.get("/unassigned-categories", getUnassignedCategories);
router.post("/", createDepartment);
router.put("/:id", updateDepartment);
router.delete("/:id", deleteDepartment);

// Gestión de categorías del departamento
router.get("/:id/categories", getDepartmentCategories);
router.post("/:id/assign-category/:categoryId", assignCategory);
router.post("/remove-category/:categoryId", removeCategory);

export default router;
