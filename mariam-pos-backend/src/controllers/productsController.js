import pkg from "@prisma/client";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

export const getProducts = async (req, res) => {
  const products = await prisma.product.findMany({ 
    orderBy: { createdAt: "desc" }, 
    include: {
              category: true, // 👈 esto hace que Prisma traiga toda la info de la categoría
             },
    take: 800, 
    });
  res.json(products);
};

export const createProduct = async (req, res) => {
  const { code, name, price,status, saleType, cost, description, icon, categoryId} = req.body;
  
  if (!name) return res.status(400).json({ error: "El nombre es obligatorio" });

   // Verificar que el producto existe
  if (code) {
      const existingCode = await prisma.product.findUnique({ where: { code } });
      console.log('existingCode', existingCode);
      if (existingCode) return res.status(404).json({ error: "El codigo de barras ya esta asignado a producto "+ existingCode.name });
     }

  const newProduct = await prisma.product.create(
      { data: { code, name, price, status, saleType, cost, description, icon, categoryId },
        include: {category: true },});
  res.status(201).json(newProduct);
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, price, status, saleType, cost, description, icon, categoryId } = req.body;

    // Validación básica
    if (!id) return res.status(400).json({ error: "El ID del producto es obligatorio" });

    // Verificar que el producto existe
    const existingProduct = await prisma.product.findUnique({ where: { id: Number(id) } });
    if (!existingProduct) return res.status(404).json({ error: "Producto no encontrado" });
    
    // 2️⃣ Solo validamos si el code cambió
    if (code && code !== existingProduct.code) {
      const existingCode = await prisma.product.findUnique({ where: { code } });
      if (existingCode && existingCode.id !== id) {
        return res.status(400).json({
          error: `El código de barras ya está asignado al producto "${existingCode.name}".`,
        });
      }
    }

    // Actualizar el producto
    const updatedProduct = await prisma.product.update({
      where: { id: Number(id) },
      data: { code, name, price, status, saleType, cost, description, icon, categoryId },
      include: { category: true },
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