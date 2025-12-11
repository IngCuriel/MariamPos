import prisma from "../utils/prisma.js";

export const getCategories = async (req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { createdAt: "desc" } });
  res.json(categories);
};

export const getCategoriesShowInPOS = async (req, res) => {
  const categories = await prisma.category.findMany({ where: { showInPOS: true }, orderBy: { createdAt: "desc" } });
  res.json(categories);
};

export const createCategory = async (req, res) => {
  const { name, description, showInPOS, branch } = req.body;
  if (!name) return res.status(400).json({ error: "El nombre es obligatorio" });

  const newCategory = await prisma.category.create({ 
    data: { 
      name, 
      description, 
      showInPOS,
      branch: branch || "Sucursal Default", // 🔄 Sucursal
      syncStatus: "pendiente" // 🔄 Marcar como pendiente de sincronización
    } 
  });
  res.status(201).json(newCategory);
};

export const updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, description, showInPOS, branch} = req.body;

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
        branch: branch || existingCategory.branch || "Sucursal Default", // 🔄 Actualizar sucursal
        syncStatus: "pendiente" // 🔄 Marcar como pendiente de sincronización
      },
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

    // Eliminar
    await prisma.category.delete({ where: { id } });

    res.status(200).json({ message: "Categoría eliminada correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al eliminar la categoría" });
  }
};
