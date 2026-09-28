import prisma from "../utils/prisma.js";

export const getCategories = async (req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { createdAt: "desc" },
    include: { department: { select: { id: true, name: true } } },
  });
  res.json(categories);
};

export const getCategoriesShowInPOS = async (req, res) => {
  const categories = await prisma.category.findMany({
    where: { showInPOS: true },
    include: { department: true }, // Para agrupar por departamento en la venta
    orderBy: { name: "asc" },
  });
  res.json(categories);
};

export const createCategory = async (req, res) => {
  const { name, description, showInPOS, branch, departmentId } = req.body;
  if (!name) return res.status(400).json({ error: "El nombre es obligatorio" });

  const newCategory = await prisma.category.create({ 
    data: { 
      name, 
      description, 
      showInPOS,
      departmentId: departmentId || null, // Departamento (opcional)
      branch: branch || "Sucursal Default", // 🔄 Sucursal
      syncStatus: "pendiente" // 🔄 Marcar como pendiente de sincronización
    },
    include: { department: { select: { id: true, name: true } } },
  });
  res.status(201).json(newCategory);
};

export const updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, description, showInPOS, branch, departmentId } = req.body;

  try {
    // Verificar si existe la categoría
    const existingCategory = await prisma.category.findUnique({ where: { id } });
    if (!existingCategory) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }

    // Actualizar categoría
    const updatedCategory = await prisma.category.update({
      where: { id },
      data: { 
        name, 
        description, 
        showInPOS,
        // departmentId: si viene la clave se aplica (string o null); si no viene, no se toca.
        ...(departmentId !== undefined ? { departmentId: departmentId || null } : {}),
        branch: branch || existingCategory.branch || "Sucursal Default", // 🔄 Actualizar sucursal
        syncStatus: "pendiente" // 🔄 Marcar como pendiente de sincronización
      },
      include: { department: { select: { id: true, name: true } } },
    });

    res.status(200).json(updatedCategory);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar la categoría" });
  }
};

export const deleteCategory = async (req, res) => {
  const { id } = req.params;

  try {
    // Verificar si existe
    const existingCategory = await prisma.category.findUnique({ where: { id } });
    if (!existingCategory) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }

    // No permitir eliminar si tiene productos asignados (protege ventas históricas:
    // esos productos pueden estar referenciados en ventas ya realizadas).
    const productsCount = await prisma.product.count({ where: { categoryId: id } });
    if (productsCount > 0) {
      return res.status(400).json({
        error: `No se puede eliminar: la categoría tiene ${productsCount} producto(s) asignado(s). Reasigná o eliminá esos productos primero.`,
      });
    }

    // Eliminar
    await prisma.category.delete({ where: { id } });

    res.status(200).json({ message: "Categoría eliminada correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al eliminar la categoría" });
  }
};
