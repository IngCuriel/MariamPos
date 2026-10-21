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
      // Incluir las presentaciones del producto para poder descomponer el
      // stock (en unidad base/pieza) en sus presentaciones (p. ej. rejas) y
      // para dar entradas por presentación.
      include: { product: { include: { presentations: true } } },
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

// ============================================================
// 📌 PRODUCTOS DE UN DEPARTAMENTO (para el asistente de inventario inicial)
// Devuelve todos los productos cuyas categorías pertenecen al departamento,
// con su estado de inventario actual (trackInventory y currentStock).
// ============================================================
export const getProductsByDepartmentForInventory = async (req, res) => {
  try {
    const { departmentId } = req.params;
    if (!departmentId) {
      return res.status(400).json({ error: "departmentId es requerido" });
    }

    const products = await prisma.product.findMany({
      where: {
        isKit: false,
        category: { departmentId: String(departmentId) },
      },
      include: {
        category: true,
        inventory: true,
        presentations: true,
      },
      orderBy: { name: "asc" },
    });

    res.json(products);
  } catch (error) {
    console.error("Error getProductsByDepartmentForInventory:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ============================================================
// 📌 INVENTARIO INICIAL EN LOTE
// Recibe una lista de { productId, currentStock, minStock? }. Para cada uno:
//  - activa trackInventory = true en el producto,
//  - establece el stock (upsert de Inventory a valor absoluto),
//  - registra un movimiento AJUSTE "Inventario inicial" para el Kardex.
// Todo dentro de una transacción (todo o nada).
// ============================================================
export const batchInitialInventory = async (req, res) => {
  try {
    const { items, branch, cashRegister, createdBy } = req.body ?? {};

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: "Se requiere al menos un producto" });
    }

    // Normalizar y validar entradas.
    const normalized = items
      .map((it) => ({
        productId: Number(it?.productId),
        currentStock: Number(it?.currentStock) || 0,
        minStock: Number(it?.minStock) || 0,
      }))
      .filter((it) => Number.isInteger(it.productId));

    if (normalized.length === 0) {
      return res.status(400).json({ error: "Productos inválidos" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = [];
      for (const it of normalized) {
        // 1) Activar trackInventory en el producto.
        await tx.product.update({
          where: { id: it.productId },
          data: { trackInventory: true },
        });

        // 2) Establecer el stock (upsert a valor absoluto).
        await tx.inventory.upsert({
          where: { productId: it.productId },
          create: {
            productId: it.productId,
            currentStock: it.currentStock,
            minStock: it.minStock,
            trackInventory: true,
            branch: branch ?? null,
            lastMovementDate: new Date(),
          },
          update: {
            currentStock: it.currentStock,
            minStock: it.minStock,
            trackInventory: true,
            lastMovementDate: new Date(),
          },
        });

        // 3) Movimiento AJUSTE para el Kardex (valor absoluto).
        await tx.inventoryMovement.create({
          data: {
            productId: it.productId,
            type: "AJUSTE",
            quantity: it.currentStock,
            reason: "Inventario inicial",
            notes: "Captura de inventario inicial por departamento",
            branch: branch ?? null,
            cashRegister: cashRegister ?? null,
            createdBy: createdBy ?? null,
          },
        });

        updated.push(it.productId);
      }
      return updated;
    });

    res.json({ ok: true, count: result.length, productIds: result });
  } catch (error) {
    console.error("Error batchInitialInventory:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};


// ============================================================
// 📌 ROTACIÓN DE INVENTARIO — PRODUCTOS SIN MOVIMIENTO (DORMIDOS)
// ------------------------------------------------------------
// Detecta productos que no rotan: cruza cada producto con la fecha de su
// ÚLTIMA VENTA real (SaleDetail) para calcular "días sin vender". Prioriza
// por capital inmovilizado (stock * costo) para atacar primero lo que más
// dinero tiene dormido.
//
// Query params (todos opcionales):
//   days        → umbral de días sin vender (default 60)
//   onlyStock   → "true" para incluir solo productos con stock > 0 (default false)
//   neverSold   → "true" para devolver SOLO los que nunca se vendieron
//   scope       → "all" (default, incluye productos sin inventario) | "inventory"
//                 (solo los que manejan inventario)
//   categoryId  → filtrar por categoría
//   search      → nombre o código
//
// Funciona SIN inventario: "días sin vender" y "última venta" se calculan
// sobre ventas reales (SaleDetail), que no dependen de trackInventory. Para
// productos sin inventario, stock/capital se reportan como no aplicables.
// ============================================================
export const getStaleProducts = async (req, res) => {
  try {
    const {
      days = "60",
      onlyStock = "false",
      neverSold = "false",
      scope = "all",
      categoryId = "",
      search = "",
      limit = "200",
    } = req.query;

    const daysThreshold = Math.max(0, parseInt(days, 10) || 0);
    // Tope de filas devueltas (seguridad/rendimiento). Default 200.
    const maxRows = Math.max(1, Math.min(2000, parseInt(limit, 10) || 200));
    const onlyWithStock = onlyStock === "true";
    const onlyNeverSold = neverSold === "true";
    const now = new Date();

    // 1) Productos candidatos. Por defecto TODOS los productos vendibles
    //    (excluye kits). Con scope="inventory" se limita a los que manejan stock.
    const where = { isKit: false };
    if (scope === "inventory") {
      where.inventory = { is: { trackInventory: true } };
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        inventory: true,
        category: { select: { id: true, name: true } },
      },
    });

    if (products.length === 0) {
      return res.json({ data: [], summary: emptyStaleSummary() });
    }

    // 2) Última venta y unidades vendidas por producto (una sola consulta).
    const productIds = products.map((p) => p.id);
    const salesAgg = await prisma.saleDetail.groupBy({
      by: ["productId"],
      where: { productId: { in: productIds } },
      _max: { createdAt: true },
      _sum: { quantity: true },
      _count: { _all: true },
    });

    const salesByProduct = new Map(
      salesAgg.map((row) => [
        row.productId,
        {
          lastSale: row._max.createdAt,
          soldUnits: row._sum.quantity || 0,
          salesCount: row._count._all || 0,
        },
      ])
    );

    // 3) Construir filas con métricas calculadas.
    const msPerDay = 1000 * 60 * 60 * 24;
    let rows = products.map((p) => {
      const stats = salesByProduct.get(p.id);
      const lastSale = stats?.lastSale || null;
      const everSold = Boolean(lastSale);

      // Días sin vender: desde la última venta, o desde el alta si nunca se vendió.
      const referenceDate = lastSale || p.createdAt;
      const daysWithoutSale = referenceDate
        ? Math.floor((now - new Date(referenceDate)) / msPerDay)
        : null;

      // ¿Este producto maneja inventario? Si no, stock/capital no aplican.
      const tracksInventory = Boolean(p.inventory?.trackInventory);
      const stock = tracksInventory ? p.inventory?.currentStock ?? 0 : null;
      const cost = p.cost ?? 0;
      const tiedCapital = tracksInventory ? (stock || 0) * cost : 0;

      return {
        id: p.id,
        code: p.code,
        name: p.name,
        categoryId: p.categoryId,
        categoryName: p.category?.name || null,
        tracksInventory,
        currentStock: stock, // null si no maneja inventario
        cost,
        price: p.price ?? 0,
        tiedCapital,
        lastSale,
        everSold,
        soldUnits: stats?.soldUnits || 0,
        salesCount: stats?.salesCount || 0,
        daysWithoutSale,
        createdAt: p.createdAt,
      };
    });

    // 4) Filtros de negocio.
    // "Solo con stock" solo tiene sentido para productos con inventario.
    if (onlyWithStock) {
      rows = rows.filter((r) => r.tracksInventory && (r.currentStock ?? 0) > 0);
    }
    if (onlyNeverSold) {
      rows = rows.filter((r) => !r.everSold);
    } else {
      // Solo "dormidos": superan el umbral de días (o nunca vendidos).
      rows = rows.filter(
        (r) => !r.everSold || (r.daysWithoutSale ?? 0) >= daysThreshold
      );
    }

    // 5) Orden: primero lo que más capital tiene parado.
    rows.sort((a, b) => b.tiedCapital - a.tiedCapital);

    // 6) Resumen (KPIs) sobre el TOTAL (antes de truncar), para no mentir.
    //    Capital/unidades solo suman productos con inventario.
    const summary = {
      totalProducts: rows.length,
      neverSold: rows.filter((r) => !r.everSold).length,
      tiedCapital: rows.reduce((sum, r) => sum + (r.tiedCapital || 0), 0),
      totalUnits: rows.reduce(
        (sum, r) => sum + (r.tracksInventory ? r.currentStock || 0 : 0),
        0
      ),
      daysThreshold,
      shown: Math.min(rows.length, maxRows),
      truncated: rows.length > maxRows,
      limit: maxRows,
    };

    // 7) Truncar al tope (los más relevantes por capital van primero).
    const data = rows.slice(0, maxRows);

    res.json({ data, summary });
  } catch (error) {
    console.error("Error getStaleProducts:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

function emptyStaleSummary() {
  return {
    totalProducts: 0,
    neverSold: 0,
    tiedCapital: 0,
    totalUnits: 0,
    daysThreshold: 60,
    shown: 0,
    truncated: false,
    limit: 200,
  };
}
