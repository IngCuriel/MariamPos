import pkg from "@prisma/client";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

export const getProducts = async (req, res) => {
  const products = await prisma.product.findMany({ 
    orderBy: { createdAt: "desc" }, 
    include: {
              category: true, // 👈 esto hace que Prisma traiga toda la info de la categoría
              presentations: true,
              inventory: true
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
      presentations = []   // 👈 nuevas presentaciones opcionales
    } = req.body;

    if (!name) return res.status(400).json({ error: "El nombre es obligatorio" });

    // Validar código de barras repetido
    if (code) {
      const existingCode = await prisma.product.findUnique({ where: { code } });
      if (existingCode)
        return res.status(400).json({
          error: `El código de barras ya está asignado al producto "${existingCode.name}".`
        });
    }

    // Crear producto + presentaciones en una transacción
    const newProduct = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: { code, name, price, status, saleType, cost, description, icon, categoryId, trackInventory}
      });

      // Si trae presentaciones, crearlas
      if (presentations.length > 0) {
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

      return product;
    });

    // Devolver con presentaciones incluidas
    const result = await prisma.product.findUnique({
      where: { id: newProduct.id },
      include: { presentations: true, category: true }
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
      presentations = []   // 👈 nuevas presentaciones
    } = req.body;

    if (!id) return res.status(400).json({ error: "El ID del producto es obligatorio" });

    const productId = Number(id);

    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: { presentations: true }
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
        data: { code, name, price, status, saleType, cost, description, icon, categoryId, trackInventory}
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

      return tx.product.findUnique({
        where: { id: productId },
        include: { presentations: true, category: true, inventory: true}
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
  const { search = '' } = req.query;
  // ⚡ Búsqueda flexible
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: search,  } },
        { description: { contains: search,  } },
        { code: { contains: search, } },
      ],
    },
    include: {
      category: true, 
      presentations: true,
      inventory: true
    },
    take: 25, 
    orderBy: { name: 'asc' },
  });

  res.json(products);
}

export const getProductsByCategoryId = async (req, res) => {
  const { categoryId } = req.params;
  // ⚡ Búsqueda flexible
  const products = await prisma.product.findMany({
    where: { categoryId:categoryId },
    include: {
      category: true,
    },
    take: 50, 
    orderBy: { name: 'asc' },
  });

  res.json(products);
}