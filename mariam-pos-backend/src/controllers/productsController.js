import prisma from "../utils/prisma.js";

export const getProducts = async (req, res) => {
  const products = await prisma.product.findMany({ 
    orderBy: { createdAt: "desc" }, 
    include: {
              category: true, // 👈 esto hace que Prisma traiga toda la info de la categoría
              presentations: true,
              inventory: true,
              kitItems: { // 🆕 Incluir items del kit si es un kit
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
    take: 50, 
    });
  res.json(products);
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
      trackInventory,
      presentations = [],   // 👈 nuevas presentaciones opcionales
      isKit = false,        // 🆕 NUEVO: Si es un kit
      kitItems = []         // 🆕 NUEVO: Items del kit
    } = req.body;

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
    
    // Generar código automático si no se proporciona (para kits principalmente)
    let finalCode = code && code.trim() !== "" ? code.trim() : null;
    if (!finalCode && isKit) {
      finalCode = `KIT-${Date.now()}`;
    }

    // Crear producto + presentaciones/kitItems en una transacción
    const newProduct = await prisma.$transaction(async (tx) => {
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
          trackInventory: isKit ? false : trackInventory, // Forzar false si es kit
          isKit // 🆕 NUEVO: Marcar como kit
        }
      });

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

      return product;
    });

    // Devolver con presentaciones/kitItems incluidas
    const result = await prisma.product.findUnique({
      where: { id: newProduct.id },
      include: { 
        presentations: true, 
        category: true,
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
      trackInventory,
      inventory, 
      presentations = [],   // 👈 nuevas presentaciones
      isKit,
      kitItems = []         // 🆕 items del kit
    } = req.body;

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
          trackInventory,
          isKit: isKit !== undefined ? isKit : existingProduct.isKit  // 🆕 Actualizar isKit si viene en el request
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
      for (const p of presentations) {
        if (p.id) {
          // actualizar
          await tx.productPresentation.update({
            where: { id: p.id },
            data: {
              name: p.name,
              quantity: p.quantity,
              unitPrice: p.unitPrice,
              isDefault: p.isDefault ?? false
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
              productId
            }
          });
        }
      }
        // Actualizar inventario
      if (inventory) {
        await tx.inventory.upsert({
          where: { productId: productId },
          create: { productId: productId, currentStock: inventory.currentStock, minStock: inventory.minStock, trackInventory: trackInventory},
          update: { currentStock: inventory?.currentStock, minStock: inventory.minStock, trackInventory: trackInventory},
        });
      } else {
        if (existingProduct.inventory) {
          await tx.inventory.update({
            where: { productId: productId },
            data: { trackInventory: false },
          });
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
  
  // ⚡ Búsqueda flexible
  const products = await prisma.product.findMany({
    where: whereConditions,
    include: {
      category: true,
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
     orderBy: { name: 'asc' },
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