import prisma from "../utils/prisma.js";

// ============================================================
// 🖨️ OBTENER TODAS LAS IMPRESORAS
// ============================================================
export const getPrinters = async (req, res) => {
  try {
    const printers = await prisma.printer.findMany({
      orderBy: [
        { isDefault: "desc" }, // Predeterminada primero
        { createdAt: "asc" },
      ],
    });

    res.json(printers);
  } catch (error) {
    console.error("Error al obtener impresoras:", error);
    res.status(500).json({ error: "Error al obtener impresoras" });
  }
};

// ============================================================
// 🖨️ OBTENER UNA IMPRESORA POR ID
// ============================================================
export const getPrinterById = async (req, res) => {
  try {
    const { id } = req.params;

    const printer = await prisma.printer.findUnique({
      where: { id: parseInt(id) },
    });

    if (!printer) {
      return res.status(404).json({ error: "Impresora no encontrada" });
    }

    res.json(printer);
  } catch (error) {
    console.error("Error al obtener impresora:", error);
    res.status(500).json({ error: "Error al obtener impresora" });
  }
};

// ============================================================
// 🖨️ OBTENER IMPRESORA PREDETERMINADA
// ============================================================
export const getDefaultPrinter = async (req, res) => {
  try {
    const printer = await prisma.printer.findFirst({
      where: { isDefault: true },
    });

    if (!printer) {
      return res.status(404).json({ error: "No hay impresora predeterminada configurada" });
    }

    res.json(printer);
  } catch (error) {
    console.error("Error al obtener impresora predeterminada:", error);
    res.status(500).json({ error: "Error al obtener impresora predeterminada" });
  }
};

// ============================================================
// 🖨️ CREAR UNA NUEVA IMPRESORA
// ============================================================
export const createPrinter = async (req, res) => {
  try {
    const { name, isDefault } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "El nombre de la impresora es requerido" });
    }

    // Verificar que no exista otra impresora con el mismo nombre
    const existingPrinter = await prisma.printer.findUnique({
      where: { name: name.trim() },
    });

    if (existingPrinter) {
      return res.status(400).json({ error: "Ya existe una impresora con ese nombre" });
    }

    // Si se marca como predeterminada, desmarcar las demás
    if (isDefault) {
      await prisma.printer.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    } else {
      // Si no hay impresoras, esta será la predeterminada
      const printerCount = await prisma.printer.count();
      if (printerCount === 0) {
        // Esta será la primera, así que será predeterminada
        const printer = await prisma.printer.create({
          data: {
            name: name.trim(),
            isDefault: true,
          },
        });
        return res.json(printer);
      }
    }

    const printer = await prisma.printer.create({
      data: {
        name: name.trim(),
        isDefault: isDefault || false,
      },
    });

    res.status(201).json(printer);
  } catch (error) {
    console.error("Error al crear impresora:", error);
    if (error.code === "P2002") {
      return res.status(400).json({ error: "Ya existe una impresora con ese nombre" });
    }
    res.status(500).json({ error: "Error al crear impresora" });
  }
};

// ============================================================
// 🖨️ ACTUALIZAR UNA IMPRESORA
// ============================================================
export const updatePrinter = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, isDefault } = req.body;

    // Verificar que la impresora existe
    const existingPrinter = await prisma.printer.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingPrinter) {
      return res.status(404).json({ error: "Impresora no encontrada" });
    }

    // Si se cambia el nombre, verificar que no exista otra con ese nombre
    if (name && name.trim() !== existingPrinter.name) {
      const duplicatePrinter = await prisma.printer.findUnique({
        where: { name: name.trim() },
      });

      if (duplicatePrinter) {
        return res.status(400).json({ error: "Ya existe una impresora con ese nombre" });
      }
    }

    // Si se marca como predeterminada, desmarcar las demás
    if (isDefault === true) {
      await prisma.printer.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (isDefault !== undefined) updateData.isDefault = isDefault;

    const printer = await prisma.printer.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    res.json(printer);
  } catch (error) {
    console.error("Error al actualizar impresora:", error);
    if (error.code === "P2002") {
      return res.status(400).json({ error: "Ya existe una impresora con ese nombre" });
    }
    res.status(500).json({ error: "Error al actualizar impresora" });
  }
};

// ============================================================
// 🖨️ ELIMINAR UNA IMPRESORA
// ============================================================
export const deletePrinter = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la impresora existe
    const existingPrinter = await prisma.printer.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingPrinter) {
      return res.status(404).json({ error: "Impresora no encontrada" });
    }

    // Eliminar la impresora
    await prisma.printer.delete({
      where: { id: parseInt(id) },
    });

    // Si era la predeterminada y hay otras impresoras, hacer la primera predeterminada
    if (existingPrinter.isDefault) {
      const firstPrinter = await prisma.printer.findFirst({
        orderBy: { createdAt: "asc" },
      });

      if (firstPrinter) {
        await prisma.printer.update({
          where: { id: firstPrinter.id },
          data: { isDefault: true },
        });
      }
    }

    res.json({ message: "Impresora eliminada correctamente" });
  } catch (error) {
    console.error("Error al eliminar impresora:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Impresora no encontrada" });
    }
    res.status(500).json({ error: "Error al eliminar impresora" });
  }
};

// ============================================================
// 🖨️ ESTABLECER IMPRESORA PREDETERMINADA
// ============================================================
export const setDefaultPrinter = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la impresora existe
    const existingPrinter = await prisma.printer.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingPrinter) {
      return res.status(404).json({ error: "Impresora no encontrada" });
    }

    // Desmarcar todas las impresoras como predeterminadas
    await prisma.printer.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });

    // Marcar esta como predeterminada
    const printer = await prisma.printer.update({
      where: { id: parseInt(id) },
      data: { isDefault: true },
    });

    res.json(printer);
  } catch (error) {
    console.error("Error al establecer impresora predeterminada:", error);
    res.status(500).json({ error: "Error al establecer impresora predeterminada" });
  }
};

