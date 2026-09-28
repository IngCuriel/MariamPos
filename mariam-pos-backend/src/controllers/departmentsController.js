import prisma from "../utils/prisma.js";

// Listar departamentos. Filtro opcional ?activeOnly=true (status != 0).
export const getDepartments = async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const where = {};
    if (activeOnly === "true") {
      where.OR = [{ status: { not: 0 } }, { status: null }];
    }

    const departments = await prisma.department.findMany({
      where,
      include: {
        _count: { select: { categories: true } },
      },
      orderBy: { name: "asc" },
    });

    res.json(departments);
  } catch (error) {
    console.error("Error al obtener departamentos:", error);
    res.status(500).json({ error: "Error al obtener departamentos" });
  }
};

export const createDepartment = async (req, res) => {
  try {
    const { name, description, icon, status, branch } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }

    const department = await prisma.department.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        icon: icon?.trim() || null,
        status: status === undefined ? 1 : status,
        branch: branch || "Sucursal Default",
        syncStatus: "pendiente",
      },
    });

    res.status(201).json(department);
  } catch (error) {
    console.error("Error al crear departamento:", error);
    res.status(500).json({ error: "Error al crear departamento" });
  }
};

export const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, status, branch } = req.body;

    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Departamento no encontrado" });
    }

    const department = await prisma.department.update({
      where: { id },
      data: {
        name: name?.trim() ?? existing.name,
        description: description !== undefined ? description?.trim() || null : existing.description,
        icon: icon !== undefined ? icon?.trim() || null : existing.icon,
        status: status !== undefined ? status : existing.status,
        branch: branch || existing.branch || "Sucursal Default",
        syncStatus: "pendiente",
      },
    });

    res.json(department);
  } catch (error) {
    console.error("Error al actualizar departamento:", error);
    res.status(500).json({ error: "Error al actualizar departamento" });
  }
};

// Categorías de un departamento (?departmentId) o sin departamento (?unassigned=true).
export const getDepartmentCategories = async (req, res) => {
  try {
    const { id } = req.params;
    const categories = await prisma.category.findMany({
      where: { departmentId: id },
      orderBy: { name: "asc" },
    });
    res.json(categories);
  } catch (error) {
    console.error("Error al obtener categorías del departamento:", error);
    res.status(500).json({ error: "Error al obtener categorías del departamento" });
  }
};

// Categorías sin departamento asignado.
export const getUnassignedCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { departmentId: null },
      orderBy: { name: "asc" },
    });
    res.json(categories);
  } catch (error) {
    console.error("Error al obtener categorías sin departamento:", error);
    res.status(500).json({ error: "Error al obtener categorías sin departamento" });
  }
};

// Asignar una categoría a un departamento.
export const assignCategory = async (req, res) => {
  try {
    const { id, categoryId } = req.params;

    const department = await prisma.department.findUnique({ where: { id } });
    if (!department) {
      return res.status(404).json({ error: "Departamento no encontrado" });
    }

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data: { departmentId: id, syncStatus: "pendiente" },
    });
    res.json(updated);
  } catch (error) {
    console.error("Error al asignar categoría:", error);
    res.status(500).json({ error: "Error al asignar categoría" });
  }
};

// Quitar una categoría de su departamento (queda sin departamento).
export const removeCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data: { departmentId: null, syncStatus: "pendiente" },
    });
    res.json(updated);
  } catch (error) {
    console.error("Error al quitar categoría:", error);
    res.status(500).json({ error: "Error al quitar categoría" });
  }
};

export const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { categories: true } } },
    });
    if (!existing) {
      return res.status(404).json({ error: "Departamento no encontrado" });
    }

    // No borrar si tiene categorías asignadas (protege la integridad).
    if (existing._count.categories > 0) {
      return res.status(400).json({
        error: `No se puede eliminar: el departamento tiene ${existing._count.categories} categoría(s) asignada(s). Reasigne o quite esas categorías primero.`,
      });
    }

    await prisma.department.delete({ where: { id } });
    res.json({ message: "Departamento eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar departamento:", error);
    res.status(500).json({ error: "Error al eliminar departamento" });
  }
};
