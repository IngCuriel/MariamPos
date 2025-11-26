import pkg from "@prisma/client";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

// Obtener todos los usuarios
export const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(users);
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
};

// Obtener un usuario por ID
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error al obtener usuario:", error);
    res.status(500).json({ error: "Error al obtener usuario" });
  }
};

// Crear un nuevo usuario
export const createUser = async (req, res) => {
  try {
    const { name, email, phone, username, role, branch, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }

    // Validar email único si se proporciona
    if (email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email },
      });
      if (existingEmail) {
        return res.status(400).json({ error: "El email ya está en uso" });
      }
    }

    // Validar username único si se proporciona
    if (username) {
      const existingUsername = await prisma.user.findUnique({
        where: { username },
      });
      if (existingUsername) {
        return res.status(400).json({ error: "El nombre de usuario ya está en uso" });
      }
    }

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        username: username?.trim() || null,
        role: role || "CASHIER",
        branch: branch?.trim() || null,
        notes: notes?.trim() || null,
        status: "ACTIVE",
      },
    });

    res.status(201).json(newUser);
  } catch (error) {
    console.error("Error al crear usuario:", error);
    res.status(500).json({ error: "Error al crear usuario" });
  }
};

// Actualizar un usuario
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, username, role, status, branch, notes } = req.body;

    // Verificar que el usuario existe
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Validar email único si se proporciona y es diferente al actual
    if (email && email !== existingUser.email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email },
      });
      if (existingEmail) {
        return res.status(400).json({ error: "El email ya está en uso" });
      }
    }

    // Validar username único si se proporciona y es diferente al actual
    if (username && username !== existingUser.username) {
      const existingUsername = await prisma.user.findUnique({
        where: { username },
      });
      if (existingUsername) {
        return res.status(400).json({ error: "El nombre de usuario ya está en uso" });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name: name?.trim() || existingUser.name,
        email: email?.trim() || existingUser.email,
        phone: phone?.trim() || existingUser.phone,
        username: username?.trim() || existingUser.username,
        role: role || existingUser.role,
        status: status || existingUser.status,
        branch: branch?.trim() !== undefined ? branch?.trim() : existingUser.branch,
        notes: notes?.trim() !== undefined ? notes?.trim() : existingUser.notes,
      },
    });

    res.json(updatedUser);
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
};

// Eliminar un usuario
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el usuario existe
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    await prisma.user.delete({
      where: { id },
    });

    res.json({ message: "Usuario eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    res.status(500).json({ error: "Error al eliminar usuario" });
  }
};

// Inactivar/Activar un usuario
export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const newStatus = existingUser.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        status: newStatus,
      },
    });

    res.json(updatedUser);
  } catch (error) {
    console.error("Error al cambiar estado del usuario:", error);
    res.status(500).json({ error: "Error al cambiar estado del usuario" });
  }
};

