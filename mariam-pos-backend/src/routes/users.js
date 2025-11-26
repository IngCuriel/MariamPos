import express from "express";
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
} from "../controllers/usersController.js";

const router = express.Router();

// Obtener todos los usuarios
router.get("/", getUsers);

// Obtener un usuario por ID
router.get("/:id", getUserById);

// Crear un nuevo usuario
router.post("/", createUser);

// Actualizar un usuario
router.put("/:id", updateUser);

// Eliminar un usuario
router.delete("/:id", deleteUser);

// Cambiar estado de usuario (activar/inactivar)
router.patch("/:id/toggle-status", toggleUserStatus);

export default router;

