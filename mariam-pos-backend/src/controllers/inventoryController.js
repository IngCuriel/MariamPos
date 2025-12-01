import prisma from "../utils/prisma.js";

// ============================================================
// 📌 OBTENER TODO EL INVENTARIO
// ============================================================
export const getInventory = async (req, res) => {
  try {
    const inventory = await prisma.inventory.findMany({
      include: { product: true },
    });

    res.json(inventory);
  } catch (error) {
    console.error("Error getInventory:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ============================================================
// 📌 OBTENER INVENTARIO DE UN PRODUCTO
// ============================================================
export const getProductInventory = async (req, res) => {
  try {
    const { productId } = req.params;

    const inventory = await prisma.inventory.findUnique({
      where: { productId: Number(productId) },
      include: { product: true },
    });

    if (!inventory)
      return res.status(404).json({ error: "Inventario no encontrado" });

    res.json(inventory);
  } catch (error) {
    console.error("Error getProductInventory:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ============================================================
// 📌 PRODUCTOS CON STOCK BAJO
// ============================================================
export const getLowStockProducts = async (req, res) => {
  try {
    const lowStock = await prisma.inventory.findMany({
      where: {
        trackInventory: true,
        currentStock: { lt: prisma.inventory.fields.minStock },
      },
      include: { product: true },
    });

    res.json(lowStock);
  } catch (error) {
    console.error("Error getLowStockProducts:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ============================================================
// 📌 CREAR MOVIMIENTO DE INVENTARIO
// ============================================================
export const createInventoryMovement = async (req, res) => {
  try {
    const { productId, type, quantity, reason, reference, notes, branch } =
      req.body;

    if (!productId || !type || !quantity)
      return res.status(400).json({ error: "Datos incompletos" });

    const productInventory = await prisma.inventory.findUnique({
      where: { productId },
    });

    if (!productInventory)
      return res.status(404).json({ error: "Inventario no encontrado" });

    let newStock = productInventory.currentStock;

    switch (type) {
      case "ENTRADA":
        newStock += quantity;
        break;
      case "SALIDA":
        newStock -= quantity;
        if (newStock < 0) newStock = 0;
        break;
      case "AJUSTE":
        newStock = quantity; // cantidad absoluta
        break;
    }

    // Crear movimiento
    const movement = await prisma.inventoryMovement.create({
      data: {
        productId,
        type,
        quantity,
        reason,
        reference,
        notes,
        branch,
      },
    });

    // Actualizar inventario
    await prisma.inventory.update({
      where: { productId },
      data: {
        currentStock: newStock,
        lastMovementDate: new Date(),
      },
    });

    res.json(movement);
  } catch (error) {
    console.error("Error createInventoryMovement:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ============================================================
// 📌 MOVIMIENTOS POR PRODUCTO
// ============================================================
export const getProductMovements = async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit } = req.query;

    const movements = await prisma.inventoryMovement.findMany({
      where: { productId: Number(productId) },
      orderBy: { createdAt: "desc" },
      take: limit ? Number(limit) : undefined,
    });

    res.json(movements);
  } catch (error) {
    console.error("Error getProductMovements:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ============================================================
// 📌 OBTENER TODOS LOS MOVIMIENTOS (CON FILTRO DE FECHAS)
// ============================================================
export const getAllMovements = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const filters = {};

    if (startDate) {
      filters.createdAt = { gte: new Date(startDate) };
    }

    if (endDate) {
      filters.createdAt = {
        ...filters.createdAt,
        lte: new Date(endDate + "T23:59:59"),
      };
    }

    const movements = await prisma.inventoryMovement.findMany({
      where: filters,
      orderBy: { createdAt: "desc" },
      include: { product: true },
    });

    res.json(movements);
  } catch (error) {
    console.error("Error getAllMovements:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ============================================================
// 📌 ACTUALIZAR STOCK DIRECTAMENTE (AJUSTE RÁPIDO)
// ============================================================
export const updateStock = async (req, res) => {
  try {
    const { productId, newStock, reason, notes } = req.body;

    if (productId == null || newStock == null)
      return res.status(400).json({ error: "Datos incompletos" });

    // Crear movimiento tipo AJUSTE
    await prisma.inventoryMovement.create({
      data: {
        productId,
        type: "AJUSTE",
        quantity: newStock,
        reason,
        notes,
      },
    });

    const updated = await prisma.inventory.update({
      where: { productId },
      data: {
        currentStock: newStock,
        lastMovementDate: new Date(),
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error updateStock:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ============================================================
// 📌 ACTIVAR / DESACTIVAR "trackInventory"
// ============================================================
export const toggleInventoryTracking = async (req, res) => {
  try {
    const { productId } = req.params;
    const { trackInventory, currentStock, minStock} = req.body;

    const updatedProduct = await prisma.product.update({
      where: { id: Number(productId) },
      data: { trackInventory },
    });

    // Si se activa el inventario y no existe registro, crearlo
    if (trackInventory) {
      await prisma.inventory.upsert({
        where: { productId: Number(productId) },
        create: { productId: Number(productId), currentStock, minStock},
        update: {},
      });
    }

    res.json(updatedProduct);
  } catch (error) {
    console.error("Error toggleInventoryTracking:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};
