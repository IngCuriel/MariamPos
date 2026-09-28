import prisma from "../utils/prisma.js";

// Listar unidades. Filtro opcional ?activeOnly=true (status != 0).
export const getUnits = async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const where = {};
    if (activeOnly === "true") {
      where.OR = [{ status: { not: 0 } }, { status: null }];
    }

    const units = await prisma.unitOfMeasure.findMany({
      where,
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" },
    });

    res.json(units);
  } catch (error) {
    console.error("Error al obtener unidades:", error);
    res.status(500).json({ error: "Error al obtener unidades de medida" });
  }
};

export const createUnit = async (req, res) => {
  try {
    const { name, abbreviation, status, branch } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }
    if (!abbreviation || !abbreviation.trim()) {
      return res.status(400).json({ error: "La abreviatura es obligatoria" });
    }

    const unit = await prisma.unitOfMeasure.create({
      data: {
        name: name.trim(),
        abbreviation: abbreviation.trim(),
        status: status === undefined ? 1 : status,
        branch: branch || "Sucursal Default",
        syncStatus: "pendiente",
      },
    });

    res.status(201).json(unit);
  } catch (error) {
    console.error("Error al crear unidad:", error);
    res.status(500).json({ error: "Error al crear unidad de medida" });
  }
};

export const updateUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, abbreviation, status, branch } = req.body;

    const existing = await prisma.unitOfMeasure.findUnique({ where: { id: Number(id) } });
    if (!existing) {
      return res.status(404).json({ error: "Unidad no encontrada" });
    }

    const unit = await prisma.unitOfMeasure.update({
      where: { id: Number(id) },
      data: {
        name: name?.trim() ?? existing.name,
        abbreviation: abbreviation?.trim() ?? existing.abbreviation,
        status: status !== undefined ? status : existing.status,
        branch: branch || existing.branch || "Sucursal Default",
        syncStatus: "pendiente",
      },
    });

    res.json(unit);
  } catch (error) {
    console.error("Error al actualizar unidad:", error);
    res.status(500).json({ error: "Error al actualizar unidad de medida" });
  }
};

export const deleteUnit = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.unitOfMeasure.findUnique({
      where: { id: Number(id) },
      include: { _count: { select: { products: true } } },
    });
    if (!existing) {
      return res.status(404).json({ error: "Unidad no encontrada" });
    }

    // No borrar si hay productos usando esta unidad (protege integridad).
    if (existing._count.products > 0) {
      return res.status(400).json({
        error: `No se puede eliminar: la unidad está asignada a ${existing._count.products} producto(s). Cambia la unidad de esos productos primero.`,
      });
    }

    await prisma.unitOfMeasure.delete({ where: { id: Number(id) } });
    res.json({ message: "Unidad eliminada correctamente" });
  } catch (error) {
    console.error("Error al eliminar unidad:", error);
    res.status(500).json({ error: "Error al eliminar unidad de medida" });
  }
};
