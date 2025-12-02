import prisma from "../utils/prisma.js";

// ============================================================
// 📌 OBTENER TODAS LAS COMPRAS
// ============================================================
export const getPurchases = async (req, res) => {
  try {
    const {
      page = "1",
      limit = "50",
      supplierId,
      paymentStatus,
      startDate,
      endDate,
      search,
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const where = {};

    if (supplierId) {
      where.supplierId = parseInt(supplierId, 10);
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    if (startDate || endDate) {
      where.purchaseDate = {};
      if (startDate) {
        where.purchaseDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.purchaseDate.lte = new Date(endDate + "T23:59:59");
      }
    }

    if (search) {
      where.OR = [
        { folio: { contains: search } },
        { invoiceNumber: { contains: search } },
        { supplier: { name: { contains: search } } },
      ];
    }

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        include: {
          supplier: true,
          details: {
            include: {
              product: true,
            },
          },
          _count: {
            select: {
              payments: true,
            },
          },
        },
        orderBy: { purchaseDate: "desc" },
        skip,
        take: limitNumber,
      }),
      prisma.purchase.count({ where }),
    ]);

    res.json({
      data: purchases,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Error getPurchases:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ============================================================
// 📌 OBTENER COMPRA POR ID
// ============================================================
export const getPurchaseById = async (req, res) => {
  try {
    const { id } = req.params;

    const purchase = await prisma.purchase.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        supplier: true,
        details: {
          include: {
            product: true,
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!purchase) {
      return res.status(404).json({ error: "Compra no encontrada" });
    }

    res.json(purchase);
  } catch (error) {
    console.error("Error getPurchaseById:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ============================================================
// 📌 CREAR COMPRA
// ============================================================
export const createPurchase = async (req, res) => {
  try {
    const {
      supplierId,
      purchaseDate,
      dueDate,
      subtotal,
      tax,
      discount,
      total,
      paymentMethod,
      paymentStatus,
      paidAmount = 0,
      balance = 0,
      paidPercentage = 0,
      pendingPercentage = 0,
      invoiceNumber,
      notes,
      branch,
      cashRegister,
      details,
      updateInventory = true, // Por defecto actualizar inventario
    } = req.body;

    if (!supplierId) {
      return res.status(400).json({ error: "El proveedor es requerido" });
    }

    if (!details || details.length === 0) {
      return res.status(400).json({ error: "Debe incluir al menos un detalle de compra" });
    }

    // Validar que el proveedor existe
    const supplier = await prisma.supplier.findUnique({
      where: { id: parseInt(supplierId, 10) },
    });

    if (!supplier) {
      return res.status(404).json({ error: "Proveedor no encontrado" });
    }

    // Generar folio único
    const folio = `COMP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Crear la compra con transacción
    const purchase = await prisma.$transaction(async (tx) => {
      // Calcular valores de pago si no se proporcionan
      const finalTotal = parseFloat(total) || 0;
      const finalPaidAmount = parseFloat(paidAmount) || 0;
      const finalBalance = balance !== undefined ? parseFloat(balance) : (finalTotal - finalPaidAmount);
      const finalPaidPercentage = paidPercentage !== undefined ? parseFloat(paidPercentage) : (finalTotal > 0 ? (finalPaidAmount / finalTotal) * 100 : 0);
      const finalPendingPercentage = pendingPercentage !== undefined ? parseFloat(pendingPercentage) : (finalTotal > 0 ? (finalBalance / finalTotal) * 100 : 0);

      // Determinar el estado final de pago
      let finalPaymentStatus = paymentStatus || "PENDING";
      if (finalPaidAmount >= finalTotal) {
        finalPaymentStatus = "PAID";
      } else if (finalPaidAmount > 0) {
        finalPaymentStatus = "PARTIAL";
      } else {
        finalPaymentStatus = "PENDING";
      }

      // Crear la compra
      const newPurchase = await tx.purchase.create({
        data: {
          folio,
          supplierId: parseInt(supplierId, 10),
          purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
          dueDate: dueDate ? new Date(dueDate) : null,
          subtotal: parseFloat(subtotal) || 0,
          tax: parseFloat(tax) || 0,
          discount: parseFloat(discount) || 0,
          total: finalTotal,
          paymentMethod: paymentMethod || null,
          paymentStatus: finalPaymentStatus,
          paidAmount: finalPaidAmount,
          balance: finalBalance,
          paidPercentage: finalPaidPercentage,
          pendingPercentage: finalPendingPercentage,
          invoiceNumber: invoiceNumber?.trim() || null,
          notes: notes?.trim() || null,
          branch: branch || "Sucursal Default",
          cashRegister: cashRegister || "Caja 1",
          details: {
            create: details.map((d) => ({
              productId: d.productId,
              quantity: parseFloat(d.quantity),
              unitCost: parseFloat(d.unitCost),
              subtotal: parseFloat(d.subtotal),
              discount: parseFloat(d.discount) || 0,
            })),
          },
        },
        include: {
          supplier: true,
          details: {
            include: {
              product: true,
            },
          },
        },
      });

      // Actualizar inventario si se solicita
      if (updateInventory) {
        for (const detail of details) {
          const productId = detail.productId;
          const quantity = parseFloat(detail.quantity);

          // Verificar si el producto tiene inventario
          const inventory = await tx.inventory.findUnique({
            where: { productId },
          });

          if (inventory && inventory.trackInventory) {
            // Actualizar stock
            await tx.inventory.update({
              where: { productId },
              data: {
                currentStock: {
                  increment: quantity,
                },
                lastMovementDate: new Date(),
              },
            });

            // Crear movimiento de inventario
            await tx.inventoryMovement.create({
              data: {
                productId,
                type: "ENTRADA",
                quantity,
                reason: `Compra ${folio}`,
                branch: branch || "Sucursal Default",
                cashRegister: cashRegister || "Caja 1",
              },
            });
          }
        }
      }

      // Si la compra es PENDING o PARTIAL, crear automáticamente una cuenta por pagar
      if (finalPaymentStatus === "PENDING" || finalPaymentStatus === "PARTIAL") {
        try {
          // Validar que hay un saldo pendiente válido
          const accountPayableAmount = Math.max(0, finalBalance > 0 ? finalBalance : finalTotal);
          
          // Solo crear cuenta por pagar si hay un monto válido
          if (accountPayableAmount > 0) {
            const accountPayableDueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días por defecto
            
            await tx.accountPayable.create({
              data: {
                purchaseId: newPurchase.id,
                supplierId: parseInt(supplierId, 10),
                amount: accountPayableAmount,
                paidAmount: finalPaidAmount || 0,
                balance: accountPayableAmount,
                dueDate: accountPayableDueDate,
                status: finalPaymentStatus === "PARTIAL" ? "PARTIAL" : "PENDING",
                paymentMethod: paymentMethod || null,
                notes: (notes?.trim() || `Cuenta por pagar generada automáticamente de la compra ${folio}`) || null,
                reference: invoiceNumber?.trim() || null,
              },
            });
          }
        } catch (accountPayableError) {
          console.error("Error al crear cuenta por pagar automática:", accountPayableError);
          console.error("Error details:", {
            message: accountPayableError.message,
            code: accountPayableError.code,
            meta: accountPayableError.meta,
          });
          // No lanzar error, solo registrar. La compra debe guardarse aunque falle la cuenta por pagar
        }
      }

      return newPurchase;
    });

    res.status(201).json(purchase);
  } catch (error) {
    console.error("Error createPurchase:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
    });
    if (error.code === "P2002") {
      return res.status(400).json({ error: "El folio de la compra ya existe" });
    }
    res.status(500).json({ 
      error: "Error interno del servidor",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ============================================================
// 📌 ACTUALIZAR COMPRA
// ============================================================
export const updatePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      purchaseDate,
      dueDate,
      subtotal,
      tax,
      discount,
      total,
      paymentMethod,
      paymentStatus,
      invoiceNumber,
      notes,
      details,
    } = req.body;

    const purchase = await prisma.purchase.findUnique({
      where: { id: parseInt(id, 10) },
      include: { details: true },
    });

    if (!purchase) {
      return res.status(404).json({ error: "Compra no encontrada" });
    }

    // Actualizar compra
    const updatedPurchase = await prisma.purchase.update({
      where: { id: parseInt(id, 10) },
      data: {
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        subtotal: subtotal !== undefined ? parseFloat(subtotal) : undefined,
        tax: tax !== undefined ? parseFloat(tax) : undefined,
        discount: discount !== undefined ? parseFloat(discount) : undefined,
        total: total !== undefined ? parseFloat(total) : undefined,
        paymentMethod: paymentMethod !== undefined ? paymentMethod : undefined,
        paymentStatus: paymentStatus !== undefined ? paymentStatus : undefined,
        invoiceNumber: invoiceNumber !== undefined ? invoiceNumber?.trim() : undefined,
        notes: notes !== undefined ? notes?.trim() : undefined,
      },
      include: {
        supplier: true,
        details: {
          include: {
            product: true,
          },
        },
      },
    });

    // Si se proporcionan detalles, actualizarlos
    if (details && Array.isArray(details)) {
      // Eliminar detalles existentes
      await prisma.purchaseDetail.deleteMany({
        where: { purchaseId: parseInt(id, 10) },
      });

      // Crear nuevos detalles
      await prisma.purchaseDetail.createMany({
        data: details.map((d) => ({
          purchaseId: parseInt(id, 10),
          productId: d.productId,
          quantity: parseFloat(d.quantity),
          unitCost: parseFloat(d.unitCost),
          subtotal: parseFloat(d.subtotal),
          discount: parseFloat(d.discount) || 0,
        })),
      });

      // Recargar con detalles actualizados
      const purchaseWithDetails = await prisma.purchase.findUnique({
        where: { id: parseInt(id, 10) },
        include: {
          supplier: true,
          details: {
            include: {
              product: true,
            },
          },
        },
      });

      return res.json(purchaseWithDetails);
    }

    res.json(updatedPurchase);
  } catch (error) {
    console.error("Error updatePurchase:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Compra no encontrada" });
    }
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ============================================================
// 📌 ELIMINAR COMPRA
// ============================================================
export const deletePurchase = async (req, res) => {
  try {
    const { id } = req.params;

    const purchase = await prisma.purchase.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        _count: {
          select: {
            payments: true,
          },
        },
      },
    });

    if (!purchase) {
      return res.status(404).json({ error: "Compra no encontrada" });
    }

    if (purchase._count.payments > 0) {
      return res.status(400).json({
        error: "No se puede eliminar la compra porque tiene pagos asociados",
      });
    }

    await prisma.purchase.delete({
      where: { id: parseInt(id, 10) },
    });

    res.json({ message: "Compra eliminada correctamente" });
  } catch (error) {
    console.error("Error deletePurchase:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Compra no encontrada" });
    }
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

