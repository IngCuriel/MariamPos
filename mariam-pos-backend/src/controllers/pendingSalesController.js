import pkg from "@prisma/client";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

// Generar código único para venta pendiente
const generatePendingSaleCode = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `PEND-${timestamp}-${random}`;
};

// Obtener todas las ventas pendientes
export const getPendingSales = async (req, res) => {
  try {
    const pendingSales = await prisma.pendingSale.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        details: {
          include: {
            product: {
              include: {
                category: true,
                presentations: true,
              },
            },
          },
        },
      },
    });
    res.json(pendingSales);
  } catch (error) {
    console.error("Error al obtener ventas pendientes:", error);
    res.status(500).json({ error: "Error al obtener ventas pendientes" });
  }
};

// Obtener una venta pendiente por ID
export const getPendingSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    const pendingSale = await prisma.pendingSale.findUnique({
      where: { id: parseInt(id) },
      include: {
        details: {
          include: {
            product: {
              include: {
                category: true,
                presentations: true,
              },
            },
          },
        },
      },
    });

    if (!pendingSale) {
      return res.status(404).json({ error: "Venta pendiente no encontrada" });
    }

    res.json(pendingSale);
  } catch (error) {
    console.error("Error al obtener venta pendiente:", error);
    res.status(500).json({ error: "Error al obtener venta pendiente" });
  }
};

// Crear una nueva venta pendiente
export const createPendingSale = async (req, res) => {
  try {
    const { clientName, total, branch, cashRegister, details } = req.body;

    if (!details || details.length === 0) {
      return res
        .status(400)
        .json({ error: "Debe incluir al menos un detalle de venta" });
    }

    // Generar código único
    const code = generatePendingSaleCode();

    const pendingSale = await prisma.pendingSale.create({
      data: {
        code,
        clientName: clientName || null,
        total,
        branch: branch || "Sucursal Default",
        cashRegister: cashRegister || "Caja 1",
        details: {
          create: details.map((d) => ({
            productId: d.productId,
            quantity: d.quantity,
            price: d.price,
            subTotal: d.subTotal,
            productName: d.productName,
            presentationId: d.presentationId || null,
            presentationName: d.presentationName || null,
            saleType: d.saleType || null,
            basePrice: d.basePrice || null,
          })),
        },
      },
      include: {
        details: {
          include: {
            product: {
              include: {
                category: true,
                presentations: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json(pendingSale);
  } catch (error) {
    console.error("Error al crear venta pendiente:", error);
    res.status(500).json({ error: "Error al crear venta pendiente" });
  }
};

// Eliminar una venta pendiente
export const deletePendingSale = async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.pendingSale.delete({
      where: { id: parseInt(id) },
    });

    res.json({ message: "Venta pendiente eliminada correctamente" });
  } catch (error) {
    console.error("Error al eliminar venta pendiente:", error);
    res.status(500).json({ error: "Error al eliminar venta pendiente" });
  }
};

// Actualizar una venta pendiente
export const updatePendingSale = async (req, res) => {
  try {
    const { id } = req.params;
    const { clientName, total, details } = req.body;

    // Si se envían nuevos detalles, eliminar los antiguos y crear nuevos
    if (details && details.length > 0) {
      // Eliminar detalles existentes
      await prisma.pendingSaleDetail.deleteMany({
        where: { pendingSaleId: parseInt(id) },
      });

      // Crear nuevos detalles
      await prisma.pendingSaleDetail.createMany({
        data: details.map((d) => ({
          pendingSaleId: parseInt(id),
          productId: d.productId,
          quantity: d.quantity,
          price: d.price,
          subTotal: d.subTotal,
          productName: d.productName,
          presentationId: d.presentationId || null,
          presentationName: d.presentationName || null,
          saleType: d.saleType || null,
          basePrice: d.basePrice || null,
        })),
      });
    }

    // Actualizar la venta pendiente
    const updatedPendingSale = await prisma.pendingSale.update({
      where: { id: parseInt(id) },
      data: {
        clientName: clientName !== undefined ? clientName : undefined,
        total: total !== undefined ? total : undefined,
      },
      include: {
        details: {
          include: {
            product: {
              include: {
                category: true,
                presentations: true,
              },
            },
          },
        },
      },
    });

    res.json(updatedPendingSale);
  } catch (error) {
    console.error("Error al actualizar venta pendiente:", error);
    res.status(500).json({ error: "Error al actualizar venta pendiente" });
  }
};

