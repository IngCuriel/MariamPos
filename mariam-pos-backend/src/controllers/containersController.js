import pkg from "@prisma/client";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

// ============================================================
// 📦 OBTENER TODOS LOS ENVASES
// ============================================================
export const getContainers = async (req, res) => {
  try {
    const { isActive, productId, presentationId, forSales } = req.query;

    const where = {};
    
    // Si es para ventas, filtrar solo envases activos (status != 0 o null)
    if (forSales === "true") {
      where.OR = [
        { status: { not: 0 } },  // status != 0
        { status: null },         // status es null (se considera activo)
      ];
    } else if (isActive !== undefined) {
      // Mantener compatibilidad con el parámetro isActive (para el catálogo)
      if (isActive === "true") {
        where.OR = [
          { status: { not: 0 } },
          { status: null },
        ];
      } else {
        where.status = 0; // Solo inactivos
      }
    }
    
    if (productId) {
      where.productId = parseInt(productId);
    }
    if (presentationId) {
      where.presentationId = parseInt(presentationId);
    }

    const containers = await prisma.container.findMany({
      where,
      include: {
        product: {
          include: {
            category: true,
          },
        },
        presentation: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(containers);
  } catch (error) {
    console.error("Error al obtener envases:", error);
    res.status(500).json({ error: "Error al obtener envases" });
  }
};

// ============================================================
// 📦 OBTENER UN ENVASE POR ID
// ============================================================
export const getContainerById = async (req, res) => {
  try {
    const { id } = req.params;

    const container = await prisma.container.findUnique({
      where: { id: parseInt(id) },
      include: {
        product: {
          include: {
            category: true,
            presentations: true,
          },
        },
        presentation: true,
      },
    });

    if (!container) {
      return res.status(404).json({ error: "Envase no encontrado" });
    }

    res.json(container);
  } catch (error) {
    console.error("Error al obtener envase:", error);
    res.status(500).json({ error: "Error al obtener envase" });
  }
};

// ============================================================
// 📦 CREAR UN NUEVO ENVASE
// ============================================================
export const createContainer = async (req, res) => {
  try {
    const { name, quantity, importAmount, productId, presentationId, notes, status, isActive } = req.body;

    if (!name || !quantity || !importAmount) {
      return res.status(400).json({ error: "Nombre, cantidad e importe son requeridos" });
    }

    // Validar que si se proporciona presentationId, también debe tener productId
    if (presentationId && !productId) {
      return res.status(400).json({ error: "Si se especifica una presentación, también debe especificarse el producto" });
    }

    // Si se proporciona presentationId, validar que la presentación pertenezca al producto
    if (presentationId && productId) {
      const presentation = await prisma.productPresentation.findUnique({
        where: { id: parseInt(presentationId) },
      });

      if (!presentation) {
        return res.status(404).json({ error: "Presentación no encontrada" });
      }

      if (presentation.productId !== parseInt(productId)) {
        return res.status(400).json({ error: "La presentación no pertenece al producto especificado" });
      }
    }

    // Si se proporciona productId, validar que el producto existe
    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: parseInt(productId) },
      });

      if (!product) {
        return res.status(404).json({ error: "Producto no encontrado" });
      }
    }

    // Determinar el status: priorizar status, luego isActive (para compatibilidad), default null (activo)
    let finalStatus = null; // Default activo
    if (status !== undefined) {
      finalStatus = status === null ? null : parseInt(status);
    } else if (isActive !== undefined) {
      // Compatibilidad con isActive
      finalStatus = isActive ? null : 0;
    }

    const container = await prisma.container.create({
      data: {
        name,
        quantity: parseInt(quantity),
        importAmount: parseFloat(importAmount),
        productId: productId ? parseInt(productId) : null,
        presentationId: presentationId ? parseInt(presentationId) : null,
        notes,
        status: finalStatus,
      },
      include: {
        product: {
          include: {
            category: true,
          },
        },
        presentation: true,
      },
    });

    res.json(container);
  } catch (error) {
    console.error("Error al crear envase:", error);
    res.status(500).json({ error: "Error al crear envase" });
  }
};

// ============================================================
// 📦 ACTUALIZAR UN ENVASE
// ============================================================
export const updateContainer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, quantity, importAmount, productId, presentationId, notes, status, isActive } = req.body;

    // Validar que si se proporciona presentationId, también debe tener productId
    if (presentationId && !productId) {
      return res.status(400).json({ error: "Si se especifica una presentación, también debe especificarse el producto" });
    }

    // Si se proporciona presentationId, validar que la presentación pertenezca al producto
    if (presentationId && productId) {
      const presentation = await prisma.productPresentation.findUnique({
        where: { id: parseInt(presentationId) },
      });

      if (!presentation) {
        return res.status(404).json({ error: "Presentación no encontrada" });
      }

      if (presentation.productId !== parseInt(productId)) {
        return res.status(400).json({ error: "La presentación no pertenece al producto especificado" });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (quantity !== undefined) updateData.quantity = parseInt(quantity);
    if (importAmount !== undefined) updateData.importAmount = parseFloat(importAmount);
    if (productId !== undefined) updateData.productId = productId ? parseInt(productId) : null;
    if (presentationId !== undefined) updateData.presentationId = presentationId ? parseInt(presentationId) : null;
    if (notes !== undefined) updateData.notes = notes;
    
    // Manejar status: priorizar status, luego isActive (para compatibilidad)
    if (status !== undefined) {
      updateData.status = status === null ? null : parseInt(status);
    } else if (isActive !== undefined) {
      // Compatibilidad con isActive
      updateData.status = isActive ? null : 0;
    }

    const container = await prisma.container.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        product: {
          include: {
            category: true,
          },
        },
        presentation: true,
      },
    });

    res.json(container);
  } catch (error) {
    console.error("Error al actualizar envase:", error);
    res.status(500).json({ error: "Error al actualizar envase" });
  }
};

// ============================================================
// 📦 ELIMINAR UN ENVASE
// ============================================================
export const deleteContainer = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.container.delete({
      where: { id: parseInt(id) },
    });

    res.json({ message: "Envase eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar envase:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Envase no encontrado" });
    }
    res.status(500).json({ error: "Error al eliminar envase" });
  }
};

// ============================================================
// 📦 OBTENER PRODUCTOS CON PRESENTACIONES PARA SELECTOR
// ============================================================
export const getProductsForSelector = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: true,
        presentations: {
          where: { isDefault: false }, // Solo presentaciones no por defecto
        },
      },
      orderBy: { name: "asc" },
    });

    res.json(products);
  } catch (error) {
    console.error("Error al obtener productos:", error);
    res.status(500).json({ error: "Error al obtener productos" });
  }
};

