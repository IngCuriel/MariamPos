import prisma from "../utils/prisma.js";

// ============================================================
// 📌 OBTENER TODAS LAS CUENTAS POR PAGAR
// ============================================================
export const getAccountPayables = async (req, res) => {
  try {
    const {
      page = "1",
      limit = "50",
      supplierId,
      status,
      overdue = "false",
      startDate,
      endDate,
      includePurchases = "false", // Nuevo parámetro para incluir compras sin cuenta por pagar
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const where = {};

    if (supplierId) {
      where.supplierId = parseInt(supplierId, 10);
    }

    // Filtrar vencidas
    if (overdue === "true") {
      where.dueDate = {
        lt: new Date(),
      };
      where.status = {
        in: ["PENDING", "PARTIAL"],
      };
    } else if (status) {
      // Si se especifica un status, usarlo, pero nunca mostrar PAID
      if (status !== "PAID") {
        where.status = status;
      }
    } else {
      // Por defecto, excluir las cuentas completamente pagadas
      where.status = {
        not: "PAID",
      };
    }

    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) {
        where.dueDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.dueDate.lte = new Date(endDate + "T23:59:59");
      }
    }

    const [accountsPayable, total] = await Promise.all([
      prisma.accountPayable.findMany({
        where,
        include: {
          supplier: true,
          purchase: {
            include: {
              supplier: true,
            },
          },
        },
        orderBy: { dueDate: "asc" },
        skip,
        take: limitNumber,
      }),
      prisma.accountPayable.count({ where }),
    ]);

    res.json({
      data: accountsPayable,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Error getAccountPayables:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ============================================================
// 📌 OBTENER CUENTA POR PAGAR POR ID
// ============================================================
export const getAccountPayableById = async (req, res) => {
  try {
    const { id } = req.params;

    const accountPayable = await prisma.accountPayable.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        supplier: true,
        purchase: {
          include: {
            supplier: true,
            details: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!accountPayable) {
      return res.status(404).json({ error: "Cuenta por pagar no encontrada" });
    }

    res.json(accountPayable);
  } catch (error) {
    console.error("Error getAccountPayableById:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ============================================================
// 📌 CREAR CUENTA POR PAGAR
// ============================================================
export const createAccountPayable = async (req, res) => {
  try {
    const {
      purchaseId,
      supplierId,
      amount,
      dueDate,
      paymentMethod,
      notes,
      reference,
    } = req.body;

    if (!supplierId) {
      return res.status(400).json({ error: "El proveedor es requerido" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "El monto debe ser mayor a 0" });
    }

    if (!dueDate) {
      return res.status(400).json({ error: "La fecha de vencimiento es requerida" });
    }

    // Validar que el proveedor existe
    const supplier = await prisma.supplier.findUnique({
      where: { id: parseInt(supplierId, 10) },
    });

    if (!supplier) {
      return res.status(404).json({ error: "Proveedor no encontrado" });
    }

    // Si hay purchaseId, validar que existe
    if (purchaseId) {
      const purchase = await prisma.purchase.findUnique({
        where: { id: parseInt(purchaseId, 10) },
      });

      if (!purchase) {
        return res.status(404).json({ error: "Compra no encontrada" });
      }
    }

    const accountPayable = await prisma.accountPayable.create({
      data: {
        purchaseId: purchaseId ? parseInt(purchaseId, 10) : null,
        supplierId: parseInt(supplierId, 10),
        amount: parseFloat(amount),
        paidAmount: 0,
        balance: parseFloat(amount),
        dueDate: new Date(dueDate),
        status: "PENDING",
        paymentMethod: paymentMethod || null,
        notes: notes?.trim() || null,
        reference: reference?.trim() || null,
      },
      include: {
        supplier: true,
        purchase: true,
      },
    });

    res.status(201).json(accountPayable);
  } catch (error) {
    console.error("Error createAccountPayable:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ============================================================
// 📌 REGISTRAR PAGO A CUENTA POR PAGAR
// ============================================================
export const registerPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentAmount, paymentMethod, paymentDate, notes, reference } = req.body;

    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({ error: "El monto del pago debe ser mayor a 0" });
    }

    const accountPayable = await prisma.accountPayable.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!accountPayable) {
      return res.status(404).json({ error: "Cuenta por pagar no encontrada" });
    }

    if (accountPayable.status === "PAID") {
      return res.status(400).json({ error: "Esta cuenta ya está completamente pagada" });
    }

    const newPaidAmount = accountPayable.paidAmount + parseFloat(paymentAmount);
    const newBalance = accountPayable.amount - newPaidAmount;

    let newStatus = "PENDING";
    if (newBalance <= 0) {
      newStatus = "PAID";
    } else if (newPaidAmount > 0) {
      newStatus = "PARTIAL";
    }

    // Verificar si está vencida
    const today = new Date();
    const dueDate = new Date(accountPayable.dueDate);
    if (newStatus !== "PAID" && dueDate < today) {
      newStatus = "OVERDUE";
    }

    const updatedAccountPayable = await prisma.accountPayable.update({
      where: { id: parseInt(id, 10) },
      data: {
        paidAmount: newPaidAmount,
        balance: Math.max(0, newBalance),
        status: newStatus,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        paymentMethod: paymentMethod || accountPayable.paymentMethod,
        notes: notes?.trim() || accountPayable.notes,
        reference: reference?.trim() || accountPayable.reference,
      },
      include: {
        supplier: true,
        purchase: true,
      },
    });

    // Si hay una compra asociada, actualizar su estado de pago
    if (accountPayable.purchaseId) {
      const purchase = await prisma.purchase.findUnique({
        where: { id: accountPayable.purchaseId },
        include: {
          payments: true,
        },
      });

      if (purchase) {
        const totalPaid = purchase.payments.reduce(
          (sum, pay) => sum + pay.paidAmount,
          0
        );

        let purchasePaymentStatus = "PENDING";
        if (totalPaid >= purchase.total) {
          purchasePaymentStatus = "PAID";
        } else if (totalPaid > 0) {
          purchasePaymentStatus = "PARTIAL";
        }

        await prisma.purchase.update({
          where: { id: accountPayable.purchaseId },
          data: {
            paymentStatus: purchasePaymentStatus,
          },
        });
      }
    }

    res.json(updatedAccountPayable);
  } catch (error) {
    console.error("Error registerPayment:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Cuenta por pagar no encontrada" });
    }
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ============================================================
// 📌 ACTUALIZAR CUENTA POR PAGAR
// ============================================================
export const updateAccountPayable = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, dueDate, notes, reference } = req.body;

    const accountPayable = await prisma.accountPayable.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!accountPayable) {
      return res.status(404).json({ error: "Cuenta por pagar no encontrada" });
    }

    // Recalcular balance si cambia el amount
    let newBalance = accountPayable.balance;
    if (amount !== undefined) {
      const newAmount = parseFloat(amount);
      newBalance = newAmount - accountPayable.paidAmount;
    }

    // Recalcular status
    let newStatus = accountPayable.status;
    if (newBalance <= 0) {
      newStatus = "PAID";
    } else if (accountPayable.paidAmount > 0) {
      newStatus = "PARTIAL";
    } else {
      newStatus = "PENDING";
    }

    // Verificar si está vencida
    const finalDueDate = dueDate ? new Date(dueDate) : accountPayable.dueDate;
    const today = new Date();
    if (newStatus !== "PAID" && finalDueDate < today) {
      newStatus = "OVERDUE";
    }

    const updatedAccountPayable = await prisma.accountPayable.update({
      where: { id: parseInt(id, 10) },
      data: {
        amount: amount !== undefined ? parseFloat(amount) : undefined,
        balance: newBalance,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        status: newStatus,
        notes: notes !== undefined ? notes?.trim() : undefined,
        reference: reference !== undefined ? reference?.trim() : undefined,
      },
      include: {
        supplier: true,
        purchase: true,
      },
    });

    res.json(updatedAccountPayable);
  } catch (error) {
    console.error("Error updateAccountPayable:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Cuenta por pagar no encontrada" });
    }
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ============================================================
// 📌 ELIMINAR CUENTA POR PAGAR
// ============================================================
export const deleteAccountPayable = async (req, res) => {
  try {
    const { id } = req.params;

    const accountPayable = await prisma.accountPayable.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!accountPayable) {
      return res.status(404).json({ error: "Cuenta por pagar no encontrada" });
    }

    if (accountPayable.paidAmount > 0) {
      return res.status(400).json({
        error: "No se puede eliminar la cuenta por pagar porque tiene pagos registrados",
      });
    }

    await prisma.accountPayable.delete({
      where: { id: parseInt(id, 10) },
    });

    res.json({ message: "Cuenta por pagar eliminada correctamente" });
  } catch (error) {
    console.error("Error deleteAccountPayable:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Cuenta por pagar no encontrada" });
    }
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ============================================================
// 📌 OBTENER RESUMEN DE CUENTAS POR PAGAR
// ============================================================
export const getAccountPayablesSummary = async (req, res) => {
  try {
    const { supplierId } = req.query;

    const where = {};
    if (supplierId) {
      where.supplierId = parseInt(supplierId, 10);
    }

    const [total, pending, partial, paid, overdue] = await Promise.all([
      prisma.accountPayable.aggregate({
        where,
        _sum: {
          amount: true,
          paidAmount: true,
          balance: true,
        },
        _count: true,
      }),
      prisma.accountPayable.aggregate({
        where: { ...where, status: "PENDING" },
        _sum: {
          balance: true,
        },
        _count: true,
      }),
      prisma.accountPayable.aggregate({
        where: { ...where, status: "PARTIAL" },
        _sum: {
          balance: true,
        },
        _count: true,
      }),
      prisma.accountPayable.aggregate({
        where: { ...where, status: "PAID" },
        _sum: {
          amount: true,
        },
        _count: true,
      }),
      prisma.accountPayable.aggregate({
        where: {
          ...where,
          status: { in: ["PENDING", "PARTIAL"] },
          dueDate: { lt: new Date() },
        },
        _sum: {
          balance: true,
        },
        _count: true,
      }),
    ]);

    res.json({
      total: {
        amount: total._sum.amount || 0,
        paidAmount: total._sum.paidAmount || 0,
        balance: total._sum.balance || 0,
        count: total._count,
      },
      pending: {
        balance: pending._sum.balance || 0,
        count: pending._count,
      },
      partial: {
        balance: partial._sum.balance || 0,
        count: partial._count,
      },
      paid: {
        amount: paid._sum.amount || 0,
        count: paid._count,
      },
      overdue: {
        balance: overdue._sum.balance || 0,
        count: overdue._count,
      },
    });
  } catch (error) {
    console.error("Error getAccountPayablesSummary:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

