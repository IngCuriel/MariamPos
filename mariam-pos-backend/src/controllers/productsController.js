import prisma from "../utils/prisma.js";
import { buildCode } from "./codePrefixesController.js";

// Valida tramos de precio escalonado: arrancan en 1, sin huecos ni solapamientos,
// el último puede ser "en adelante" (maxQty null). Devuelve { ok, error, tiers }.
export const validatePriceTiers = (rawTiers) => {
  if (!Array.isArray(rawTiers) || rawTiers.length === 0) {
    return { ok: false, error: "Debe definir al menos un tramo de precio." };
  }
  // Normalizar y ordenar por minQty.
  const tiers = rawTiers
    .map((t) => ({
      minQty: Number(t.minQty),
      maxQty: t.maxQty === null || t.maxQty === undefined || t.maxQty === "" ? null : Number(t.maxQty),
      unitPrice: Number(t.unitPrice),
    }))
    .sort((a, b) => a.minQty - b.minQty);

  if (tiers[0].minQty !== 1) {
    return { ok: false, error: "El primer tramo debe iniciar en 1." };
  }

  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    const isLast = i === tiers.length - 1;

    if (!Number.isFinite(t.minQty) || t.minQty < 1) {
      return { ok: false, error: "Las cantidades mínimas deben ser enteros >= 1." };
    }
    if (!Number.isFinite(t.unitPrice) || t.unitPrice <= 0) {
      return { ok: false, error: "El precio de cada tramo debe ser mayor a 0." };
    }
    if (!isLast) {
      // Los tramos intermedios deben tener maxQty y no dejar huecos.
      if (t.maxQty === null || !Number.isFinite(t.maxQty)) {
        return { ok: false, error: "Solo el último tramo puede ser 'en adelante'." };
      }
      if (t.maxQty < t.minQty) {
        return { ok: false, error: "El máximo de un tramo no puede ser menor a su mínimo." };
      }
      const next = tiers[i + 1];
      if (next.minQty !== t.maxQty + 1) {
        return {
          ok: false,
          error: `Los tramos deben ser continuos: después de ${t.maxQty} debe seguir ${t.maxQty + 1}.`,
        };
      }
    } else {
      // Último tramo: maxQty puede ser null; si tiene, debe ser >= minQty.
      if (t.maxQty !== null && t.maxQty < t.minQty) {
        return { ok: false, error: "El máximo del último tramo no puede ser menor a su mínimo." };
      }
    }
  }
  return { ok: true, tiers };
};

// Dado un arreglo de tramos y una cantidad, devuelve el precio unitario aplicable
// (escalón simple: toda la cantidad al precio del tramo donde cae).
export const resolveTierUnitPrice = (tiers, quantity) => {
  const q = Number(quantity);
  for (const t of tiers) {
    const maxOk = t.maxQty === null || q <= t.maxQty;
    if (q >= t.minQty && maxOk) return t.unitPrice;
  }
  // Si excede todo (no debería con último null), usar el último tramo.
  return tiers.length ? tiers[tiers.length - 1].unitPrice : 0;
};

export const getProducts = async (req, res) => {
  // Paginación server-side. Por defecto: página 1, 25 por página, más nuevos primero.
  // Si no vienen page/pageSize, mantiene compatibilidad devolviendo un array plano
  // solo cuando se pide explícitamente ?paginate=false.
  const paginate = req.query.paginate !== "false";
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize, 10) || 25));

  // Filtro por estado: active (default) = status != 0 o null; inactive = status = 0.
  const statusFilter = req.query.status; // "active" | "inactive" | undefined
  const where = {};
  if (statusFilter === "inactive") {
    where.status = 0;
  } else if (statusFilter === "active") {
    where.OR = [{ status: { not: 0 } }, { status: null }];
  }

  const include = {
    category: true, // 👈 esto hace que Prisma traiga toda la info de la categoría
    unit: true, // Unidad de medida
    priceTiers: true, // Tramos de precio escalonado
    presentations: true,
    inventory: true,
    kitItems: { // 🆕 Incluir items del kit si es un kit
      include: {
        product: {
          include: {
            category: true,
            presentations: true,
          },
        },
        presentation: true,
      },
      orderBy: { displayOrder: "asc" },
    },
  };

  if (!paginate) {
    // Modo legacy: array plano (por si algún consumidor viejo lo espera).
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include,
      take: 50,
    });
    return res.json(products);
  }

  const [total, data] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({ data, total, page, pageSize });
};

export const createProduct = async (req, res) => {
  try {
    const {
      code,
      name,
      price,
      status,
      saleType,
      cost,
      description,
      icon,
      categoryId,
      unitId,               // Unidad de medida (opcional, informativa)
      pricingMode = "simple", // "simple" | "tiered"
      priceTiers = [],      // Tramos de precio (solo si pricingMode = "tiered")
      trackInventory,
      inventory,            // 🔄 Datos de inventario si trackInventory es true
      presentations = [],   // 👈 nuevas presentaciones opcionales
      isKit = false,        // 🆕 NUEVO: Si es un kit
      kitItems = [],        // 🆕 NUEVO: Items del kit
      branch                // 🔄 Sucursal del producto
    } = req.body;

    // Validar tramos si el producto es de precio escalonado.
    let validatedTiers = [];
    if (pricingMode === "tiered") {
      if (isKit) {
        return res.status(400).json({ error: "Un kit no puede tener precio escalonado." });
      }
      if (presentations.length > 0) {
        return res.status(400).json({ error: "Un producto con precio escalonado no puede tener presentaciones." });
      }
      const v = validatePriceTiers(priceTiers);
      if (!v.ok) return res.status(400).json({ error: v.error });
      validatedTiers = v.tiers;
    }

    if (!name) return res.status(400).json({ error: "El nombre es obligatorio" });

    // 🆕 Validaciones para kits
    if (isKit) {
      // Los kits no pueden tener inventario
      if (trackInventory) {
        return res.status(400).json({ error: "Los kits no pueden tener control de inventario" });
      }
      // Los kits no pueden tener presentaciones
      if (presentations.length > 0) {
        return res.status(400).json({ error: "Los kits no pueden tener presentaciones" });
      }
      // Los kits deben tener al menos 2 productos
      if (!kitItems || kitItems.length < 2) {
        return res.status(400).json({ error: "Un kit debe contener al menos 2 productos" });
      }
    }

    // Validar código de barras repetido (solo si se proporciona)
    if (code && code.trim() !== "") {
      const existingCode = await prisma.product.findUnique({ where: { code: code.trim() } });
      if (existingCode)
        return res.status(400).json({
          error: `El código de barras ya está asignado al producto "${existingCode.name}".`
        });
    }
    
    // Código proporcionado manualmente (si viene).
    const manualCode = code && code.trim() !== "" ? code.trim() : null;

    // Crear producto + presentaciones/kitItems en una transacción
    const newProduct = await prisma.$transaction(async (tx) => {
      // Resolver el código final:
      // 1) Si viene manual, se usa tal cual.
      // 2) Si no viene y la categoría tiene prefijo, se genera consecutivo (reservado aquí).
      // 3) Si no viene y es kit, se usa KIT-timestamp.
      // 4) Si no hay nada, queda null.
      let finalCode = manualCode;

      if (!finalCode && categoryId) {
        const prefixRow = await tx.categoryCodePrefix.findUnique({
          where: { categoryId },
        });
        if (prefixRow) {
          // Buscar el siguiente número cuyo código NO exista todavía.
          // Evita colisiones con códigos de barras manuales o consecutivos
          // desincronizados. El consecutivo avanza hasta un código libre.
          let nextNumber = prefixRow.lastNumber + 1;
          let candidate = buildCode(prefixRow.prefix, nextNumber, prefixRow.padding);
          // Límite de seguridad para no ciclar infinito.
          let guard = 0;
          while (guard < 10000) {
            const clash = await tx.product.findUnique({ where: { code: candidate } });
            if (!clash) break;
            nextNumber += 1;
            candidate = buildCode(prefixRow.prefix, nextNumber, prefixRow.padding);
            guard += 1;
          }
          finalCode = candidate;
          // Reservar el consecutivo (se incrementa solo al guardar).
          await tx.categoryCodePrefix.update({
            where: { id: prefixRow.id },
            data: { lastNumber: nextNumber, syncStatus: "pendiente" },
          });
        }
      }

      if (!finalCode && isKit) {
        finalCode = `KIT-${Date.now()}`;
      }

      const product = await tx.product.create({
        data: { 
          code: finalCode, 
          name, 
          price, 
          status, 
          saleType, 
          cost, 
          description, 
          icon, 
          categoryId, 
          unitId: unitId ? Number(unitId) : null, // Unidad de medida opcional
          pricingMode: pricingMode === "tiered" ? "tiered" : "simple",
          trackInventory: isKit ? false : trackInventory, // Forzar false si es kit
          isKit, // 🆕 NUEVO: Marcar como kit
          branch: branch || "Sucursal Default", // 🔄 Sucursal
          syncStatus: "pendiente" // 🔄 Marcar como pendiente de sincronización
        }
      });

      // Crear tramos de precio si es tiered.
      if (pricingMode === "tiered" && validatedTiers.length > 0) {
        for (const t of validatedTiers) {
          await tx.productPriceTier.create({
            data: {
              productId: product.id,
              minQty: t.minQty,
              maxQty: t.maxQty,
              unitPrice: t.unitPrice,
              branch: branch || "Sucursal Default",
              syncStatus: "pendiente",
            },
          });
        }
      }

      // Si trae presentaciones (solo si NO es kit), crearlas
      if (!isKit && presentations.length > 0) {
        for (const p of presentations) {
          await tx.productPresentation.create({
            data: {
              name: p.name,
              quantity: p.quantity,
              unitPrice: p.unitPrice,
              isDefault: p.isDefault ?? false,
              productId: product.id,
              branch: branch || "Sucursal Default", // 🔄 Sucursal heredada del producto
              syncStatus: "pendiente" // 🔄 Marcar como pendiente
            }
          });
        }
      }

      // 🆕 NUEVO: Si es kit, crear los items del kit
      if (isKit && kitItems.length > 0) {
        for (let i = 0; i < kitItems.length; i++) {
          const item = kitItems[i];
          await tx.kitItem.create({
            data: {
              kitId: product.id,
              productId: item.productId,
              presentationId: item.presentationId || null,
              quantity: item.quantity || 1,
              displayOrder: i
            }
          });
        }
      }

      // 🔄 Crear inventario si trackInventory es true
      if (trackInventory && inventory) {
        const productBranch = branch || "Sucursal Default";
        await tx.inventory.create({
          data: {
            productId: product.id,
            currentStock: inventory.currentStock || 0,
            minStock: inventory.minStock || 0,
            trackInventory: true,
            branch: productBranch, // 🔄 Sucursal
            syncStatus: "pendiente" // 🔄 Marcar como pendiente
          }
        });
      }

      return product;
    });

    // Devolver con presentaciones/kitItems/inventario incluidas
    const result = await prisma.product.findUnique({
      where: { id: newProduct.id },
      include: { 
        presentations: true, 
        category: true,
        unit: true, // Unidad de medida
        priceTiers: true, // Tramos de precio escalonado
        inventory: true, // 🔄 Incluir inventario si existe
        kitItems: isKit ? {
          include: {
            product: {
              include: {
                category: true,
                presentations: true
              }
            },
            presentation: true
          },
          orderBy: { displayOrder: 'asc' }
        } : false
      }
    });

    res.status(201).json(result);

  } catch (error) {
    console.error("Error al crear producto:", error);
    // Colisión de código único (P2002 en Prisma).
    if (error?.code === "P2002" && error?.meta?.target?.includes?.("code")) {
      return res.status(400).json({
        error: "El código ya está asignado a otro producto. Verifica el código o el prefijo de la categoría.",
      });
    }
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      code,
      name,
      price,
      status,
      saleType,
      cost,
      description,
      icon,
      categoryId,
      unitId,               // Unidad de medida (opcional, informativa)
      pricingMode,          // "simple" | "tiered" (opcional en update)
      priceTiers,           // Tramos (opcional)
      trackInventory,
      inventory, 
      presentations = [],   // 👈 nuevas presentaciones
      isKit,
      kitItems = [],        // 🆕 items del kit
      branch                // 🔄 Sucursal del producto
    } = req.body;

    // Validar tramos si viene pricingMode tiered.
    let validatedTiersU = [];
    if (pricingMode === "tiered") {
      const v = validatePriceTiers(priceTiers || []);
      if (!v.ok) return res.status(400).json({ error: v.error });
      validatedTiersU = v.tiers;
    }

    if (!id) return res.status(400).json({ error: "El ID del producto es obligatorio" });

    const productId = Number(id);

    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: { 
        presentations: true,
        kitItems: true  // 🆕 Incluir items del kit
      }
    });

    if (!existingProduct)
      return res.status(404).json({ error: "Producto no encontrado" });

    // Validar código de barras repetido si cambia
    if (code && code !== existingProduct.code) {
      const existingCode = await prisma.product.findUnique({ where: { code } });
      if (existingCode && existingCode.id !== productId) {
        return res.status(400).json({
          error: `El código de barras ya está asignado al producto "${existingCode.name}".`,
        });
      }
    }

    // Iniciamos la transacción
    const updatedProduct = await prisma.$transaction(async (tx) => {
      // 1️⃣ Actualizar datos del producto
      await tx.product.update({
        where: { id: productId },
        data: { 
          code, 
          name, 
          price, 
          status, 
          saleType, 
          cost, 
          description, 
          icon, 
          categoryId, 
          unitId: unitId !== undefined ? (unitId ? Number(unitId) : null) : existingProduct.unitId, // Unidad de medida opcional
          pricingMode: pricingMode !== undefined ? (pricingMode === "tiered" ? "tiered" : "simple") : existingProduct.pricingMode,
          trackInventory,
          isKit: isKit !== undefined ? isKit : existingProduct.isKit,  // 🆕 Actualizar isKit si viene en el request
          branch: branch || existingProduct.branch || "Sucursal Default", // 🔄 Actualizar sucursal
          syncStatus: "pendiente" // 🔄 Marcar como pendiente de sincronización
        }
      });

      // 2️⃣ Manejo de presentaciones
      const existing = existingProduct.presentations.map((p) => p.id);
      const incoming = presentations.filter((p) => p.id).map((p) => p.id);

      // 👉 Presentaciones a eliminar (si existen en BD y ya no vienen en el request)
      const toDelete = existing.filter((id) => !incoming.includes(id));

      if (toDelete.length > 0) {
        await tx.productPresentation.deleteMany({
          where: { id: { in: toDelete } }
        });
      }

      // 👉 Actualizar y crear presentaciones
      const productBranch = branch || existingProduct.branch || "Sucursal Default";
      for (const p of presentations) {
        if (p.id) {
          // actualizar
          await tx.productPresentation.update({
            where: { id: p.id },
            data: {
              name: p.name,
              quantity: p.quantity,
              unitPrice: p.unitPrice,
              isDefault: p.isDefault ?? false,
              branch: productBranch, // 🔄 Actualizar sucursal
              syncStatus: "pendiente" // 🔄 Marcar como pendiente
            }
          });
        } else {
          // crear
          await tx.productPresentation.create({
            data: {
              name: p.name,
              quantity: p.quantity,
              unitPrice: p.unitPrice,
              isDefault: p.isDefault ?? false,
              productId,
              branch: productBranch, // 🔄 Sucursal heredada del producto
              syncStatus: "pendiente" // 🔄 Marcar como pendiente
            }
          });
        }
      }
        // Actualizar inventario
      if (inventory) {
        const productBranch = branch || existingProduct.branch || "Sucursal Default";
        await tx.inventory.upsert({
          where: { productId: productId },
          create: { 
            productId: productId, 
            currentStock: inventory.currentStock, 
            minStock: inventory.minStock, 
            trackInventory: trackInventory,
            branch: productBranch, // 🔄 Sucursal
            syncStatus: "pendiente" // 🔄 Marcar como pendiente
          },
          update: { 
            currentStock: inventory?.currentStock, 
            minStock: inventory.minStock, 
            trackInventory: trackInventory,
            branch: productBranch, // 🔄 Actualizar sucursal
            syncStatus: "pendiente" // 🔄 Marcar como pendiente
          },
        });
      } else {
        if (existingProduct.inventory) {
          await tx.inventory.update({
            where: { productId: productId },
            data: { 
              trackInventory: false,
              syncStatus: "pendiente" // 🔄 Marcar como pendiente si se desactiva inventario
            },
          });
        }
      }

      // Manejo de tramos de precio (tiered): borrar y recrear si viene pricingMode.
      if (pricingMode !== undefined) {
        await tx.productPriceTier.deleteMany({ where: { productId } });
        if (pricingMode === "tiered") {
          const productBranch = branch || existingProduct.branch || "Sucursal Default";
          for (const t of validatedTiersU) {
            await tx.productPriceTier.create({
              data: {
                productId,
                minQty: t.minQty,
                maxQty: t.maxQty,
                unitPrice: t.unitPrice,
                branch: productBranch,
                syncStatus: "pendiente",
              },
            });
          }
        }
      }

      // 🆕 3️⃣ Manejo de kitItems (si es un kit)
      if (isKit || existingProduct.isKit) {
        // Eliminar todos los kitItems existentes
        await tx.kitItem.deleteMany({
          where: { kitId: productId }
        });

        // Crear los nuevos kitItems
        if (kitItems && kitItems.length > 0) {
          await tx.kitItem.createMany({
            data: kitItems.map((item) => ({
              kitId: productId,
              productId: item.productId,
              presentationId: item.presentationId || null,
              quantity: item.quantity || 1,
              displayOrder: item.displayOrder || 0,
            }))
          });
        }
      }

      return tx.product.findUnique({
        where: { id: productId },
        include: { 
          presentations: true, 
          category: true, 
          unit: true, // Unidad de medida
          priceTiers: true, // Tramos de precio escalonado
          inventory: true,
          kitItems: {  // 🆕 Incluir kitItems en la respuesta
            include: {
              product: true,
              presentation: true
            }
          }
        }
      });
    });

    res.status(200).json(updatedProduct);

  } catch (error) {
    console.error("Error al actualizar producto:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};


export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) return res.status(400).json({ error: "El ID del producto es obligatorio" });

    // Verificar que el producto existe
    const existingProduct = await prisma.product.findUnique({ where: { id: Number(id) } });
    if (!existingProduct) return res.status(404).json({ error: "Producto no encontrado" });

    // Eliminar el producto
    await prisma.product.delete({ where: { id: Number(id) } });

    res.status(200).json({ message: "Producto eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar producto:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

export const filterProducts = async (req, res) => {
  const { search = '', forSales = 'false' } = req.query;
  
  // Construir condiciones de búsqueda
  const whereConditions = {
    OR: [
      { name: { contains: search,  } },
      { description: { contains: search,  } },
      { code: { contains: search, } },
    ],
  };
  
  // Si es para ventas, excluir productos inactivos (status = 0)
  // status puede ser null, 0 (inactivo) o 1 (activo)
  if (forSales === 'true') {
    whereConditions.AND = [
      {
        OR: [
          { status: { not: 0 } },  // status != 0
          { status: null },         // status es null (se considera activo)
        ]
      }
    ];
  }
  
  // ⚡ Búsqueda flexible
  const products = await prisma.product.findMany({
    where: whereConditions,
    include: {
      category: true, 
      unit: true, // Unidad de medida
      priceTiers: true, // Tramos de precio escalonado
      presentations: true,
      inventory: true,
      kitItems: {
        include: {
          product: {
            include: {
              category: true,
              presentations: true
            }
          },
          presentation: true
        },
        orderBy: { displayOrder: 'asc' }
      }
    },
    take: 25, 
    orderBy: { name: 'asc' },
  });

  res.json(products);
}

export const getProductsByCategoryId = async (req, res) => {
  const { categoryId } = req.params;
  const { forSales = 'false' } = req.query;

  // Paginación OPCIONAL: solo se activa si viene ?page.
  // Así ventas (forSales) sigue trayendo todos los de la categoría como antes.
  const shouldPaginate = req.query.page !== undefined;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize, 10) || 25));

  // Construir condiciones de búsqueda
  const whereConditions = { categoryId: categoryId };
  
  // Si es para ventas, excluir productos inactivos (status = 0)
  // status puede ser null, 0 (inactivo) o 1 (activo)
  if (forSales === 'true') {
    whereConditions.AND = [
      {
        OR: [
          { status: { not: 0 } },  // status != 0
          { status: null },         // status es null (se considera activo)
        ]
      }
    ];
  }

  // Filtro por estado en el catálogo (paginado): active (default) / inactive.
  if (shouldPaginate) {
    const statusFilter = req.query.status;
    if (statusFilter === "inactive") {
      whereConditions.status = 0;
    } else if (statusFilter === "active") {
      whereConditions.AND = [
        { OR: [{ status: { not: 0 } }, { status: null }] },
      ];
    }
  }
  
  const include = {
    category: true,
    unit: true, // Unidad de medida
    priceTiers: true, // Tramos de precio escalonado
    presentations: true,
    inventory: true,
    kitItems: {
      include: {
        product: {
          include: {
            category: true,
            presentations: true,
          },
        },
        presentation: true,
      },
      orderBy: { displayOrder: "asc" },
    },
  };

  if (shouldPaginate) {
    // Catálogo: paginado, más nuevos primero.
    const [total, data] = await Promise.all([
      prisma.product.count({ where: whereConditions }),
      prisma.product.findMany({
        where: whereConditions,
        include,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return res.json({ data, total, page, pageSize });
  }

  // Ventas / legacy: todos los de la categoría, ordenados por nombre.
  const products = await prisma.product.findMany({
    where: whereConditions,
    include,
    orderBy: { name: "asc" },
  });

  res.json(products);
}

export const getProductByCode = async (req, res) => {
  try {
    const { code } = req.params;

    if (!code) {
      return res.status(400).json({ error: "El código de barras es obligatorio" });
    }

    const product = await prisma.product.findUnique({
      where: { code: code },
      include: {
        category: true,
        unit: true, // Unidad de medida
        priceTiers: true, // Tramos de precio escalonado
        presentations: true,
        inventory: true
      }
    });

    if (!product) {
      return res.status(404).json({ error: "Producto no encontrado con ese código de barras" });
    }

    res.json(product);
  } catch (error) {
    console.error("Error al buscar producto por código:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}