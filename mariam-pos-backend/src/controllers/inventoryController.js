import prisma from "../utils/prisma.js";

// ============================================================
// 📌 OBTENER TODO EL INVENTARIO (CON PAGINACIÓN Y FILTROS)
// ============================================================
export const getInventory = async (req, res) => {
  try {
    const {
      page = "1",
      limit = "50",
      search = "",
      categoryId = "",
      lowStockOnly = "false",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // Construir filtros
    const where = {
      trackInventory: true, // Solo productos que rastrean inventario
    };

    // Filtro por categoría
    if (categoryId) {
      where.product = {
        categoryId: categoryId,
      };
    }

    // Filtro por stock bajo - se aplicará después de obtener los datos
    // porque Prisma no soporta comparación entre campos directamente en SQLite

    // Filtro por búsqueda (nombre o código de producto)
    if (search && search.length > 0) {
      where.product = {
        ...where.product,
        OR: [
          { name: { contains: search } },
          { code: { contains: search } },
        ],
      };
    }

    // Obtener todos los registros que cumplen los filtros básicos
    // ⚠️ NOTA DE RENDIMIENTO:
    // Para 10,000+ artículos, esta consulta funciona pero podría optimizarse:
    // 1. Agregar índices en la BD: trackInventory, categoryId, currentStock, minStock
    // 2. Usar consultas SQL raw para comparación entre campos (stock bajo)
    // 3. Implementar caché para consultas frecuentes
    // 4. Considerar virtualización en el frontend para renderizado
    let allInventory = await prisma.inventory.findMany({
      where,
      include: { product: true },
    });

    // Aplicar filtro de stock bajo si es necesario (comparación entre campos)
    // SQLite no soporta comparación directa entre campos en WHERE
    if (lowStockOnly === "true") {
      allInventory = allInventory.filter(
        (inv) => inv.currentStock <= inv.minStock
      );
    }

    // Ordenar antes de paginar
    allInventory.sort((a, b) => {
      // Primero por stock (bajo primero)
      if (a.currentStock !== b.currentStock) {
        return a.currentStock - b.currentStock;
      }
      // Luego por nombre
      return (a.product?.name || "").localeCompare(b.product?.name || "");
    });

    // Calcular total después de todos los filtros
    const total = allInventory.length;

    // Aplicar paginación
    const paginatedInventory = allInventory.slice(skip, skip + limitNumber);

    res.json({
      data: paginatedInventory,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
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
    const { productId, type, quantity, reason, reference, notes, branch, cashRegister } =
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
        cashRegister,
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
      include: { product: true },
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
    const { productId, newStock, reason, notes, branch, cashRegister } = req.body;

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
        branch,
        cashRegister,
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
