import pkg from "@prisma/client";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

// Obtener créditos pendientes de un cliente
export const getClientCredits = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { status } = req.query; // Opcional: filtrar por estado

    const where = {
      clientId,
    };

    if (status) {
      where.status = status;
    }

    const credits = await prisma.clientCredit.findMany({
      where,
      include: {
        client: true,
        sale: {
          include: {
            details: true,
          },
        },
        payments: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(credits);
  } catch (error) {
    console.error("Error al obtener créditos:", error);
    res.status(500).json({ error: "Error al obtener créditos" });
  }
};

// Obtener todos los créditos pendientes (para reportes)
export const getAllPendingCredits = async (req, res) => {
  try {
    const credits = await prisma.clientCredit.findMany({
      where: {
        status: {
          in: ["PENDING", "PARTIALLY_PAID"],
        },
      },
      include: {
        client: true,
        sale: true,
        payments: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(credits);
  } catch (error) {
    console.error("Error al obtener créditos pendientes:", error);
    res.status(500).json({ error: "Error al obtener créditos pendientes" });
  }
};

// Obtener resumen de créditos de un cliente (total pendiente)
export const getClientCreditSummary = async (req, res) => {
  try {
    const { clientId } = req.params;

    const credits = await prisma.clientCredit.findMany({
      where: {
        clientId,
        status: {
          in: ["PENDING", "PARTIALLY_PAID"],
        },
      },
    });

    const totalPending = credits.reduce((sum, credit) => sum + credit.remainingAmount, 0);
    const totalCredits = credits.length;

    res.json({
      totalPending,
      totalCredits,
      credits,
    });
  } catch (error) {
    console.error("Error al obtener resumen de créditos:", error);
    res.status(500).json({ error: "Error al obtener resumen de créditos" });
  }
};

// Crear un nuevo crédito
export const createCredit = async (req, res) => {
  try {
    const { clientId, saleId, amount, notes } = req.body;

    if (!clientId || !saleId || !amount || amount <= 0) {
      return res.status(400).json({ error: "Datos inválidos para crear crédito" });
    }

    // Verificar que la venta existe
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
    });

    if (!sale) {
      return res.status(404).json({ error: "Venta no encontrada" });
    }

    // Verificar que el cliente existe
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    // Verificar que no exista ya un crédito para esta venta
    const existingCredit = await prisma.clientCredit.findUnique({
      where: { saleId },
    });

    if (existingCredit) {
      return res.status(400).json({ error: "Ya existe un crédito para esta venta" });
    }

    const credit = await prisma.clientCredit.create({
      data: {
        clientId,
        saleId,
        originalAmount: amount,
        remainingAmount: amount,
        paidAmount: 0,
        status: "PENDING",
        notes: notes?.trim() || null,
      },
      include: {
        client: true,
        sale: true,
      },
    });

    res.status(201).json(credit);
  } catch (error) {
    console.error("Error al crear crédito:", error);
    res.status(500).json({ error: "Error al crear crédito" });
  }
};

// Registrar un abono a un crédito
export const createCreditPayment = async (req, res) => {
  try {
    const { creditId } = req.params;
    const { amount, paymentMethod, notes, createdBy } = req.body;

    // Convertir creditId a número
    const creditIdInt = parseInt(creditId, 10);
    if (isNaN(creditIdInt)) {
      return res.status(400).json({ error: "ID de crédito inválido" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "El monto del abono debe ser mayor a 0" });
    }

    // Obtener el crédito
    const credit = await prisma.clientCredit.findUnique({
      where: { id: creditIdInt },
    });

    if (!credit) {
      return res.status(404).json({ error: "Crédito no encontrado" });
    }

    if (credit.status === "PAID") {
      return res.status(400).json({ error: "Este crédito ya está completamente pagado" });
    }

    if (amount > credit.remainingAmount) {
      return res.status(400).json({
        error: `El monto del abono ($${amount.toFixed(2)}) no puede ser mayor al saldo pendiente ($${credit.remainingAmount.toFixed(2)})`,
      });
    }

    // Crear el pago
    const payment = await prisma.creditPayment.create({
      data: {
        creditId: creditIdInt,
        amount,
        paymentMethod: paymentMethod?.trim() || null,
        notes: notes?.trim() || null,
        createdBy: createdBy?.trim() || null,
      },
    });

    // Actualizar el crédito
    const newPaidAmount = credit.paidAmount + amount;
    const newRemainingAmount = credit.remainingAmount - amount;
    const newStatus = newRemainingAmount <= 0 ? "PAID" : "PARTIALLY_PAID";

    const updatedCredit = await prisma.clientCredit.update({
      where: { id: creditIdInt },
      data: {
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        status: newStatus,
        paidAt: newStatus === "PAID" ? new Date() : null,
      },
      include: {
        client: true,
        sale: true,
        payments: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    res.status(201).json({
      payment,
      credit: updatedCredit,
    });
  } catch (error) {
    console.error("Error al registrar abono:", error);
    res.status(500).json({ error: "Error al registrar abono" });
  }
};

// Obtener un crédito por ID
export const getCreditById = async (req, res) => {
  try {
    const { creditId } = req.params;

    // Convertir creditId a número
    const creditIdInt = parseInt(creditId, 10);
    if (isNaN(creditIdInt)) {
      return res.status(400).json({ error: "ID de crédito inválido" });
    }

    const credit = await prisma.clientCredit.findUnique({
      where: { id: creditIdInt },
      include: {
        client: true,
        sale: {
          include: {
            details: true,
          },
        },
        payments: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!credit) {
      return res.status(404).json({ error: "Crédito no encontrado" });
    }

    res.json(credit);
  } catch (error) {
    console.error("Error al obtener crédito:", error);
    res.status(500).json({ error: "Error al obtener crédito" });
  }
};

// Obtener créditos generados en un rango de fechas
export const getCreditsByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Debe proporcionar startDate y endDate" });
    }

    const start = new Date(`${startDate}T00:00:00.000`);
    const end = new Date(`${endDate}T23:59:59.999`);

    const credits = await prisma.clientCredit.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        client: true,
        sale: true,
        payments: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(credits);
  } catch (error) {
    console.error("Error al obtener créditos por rango de fechas:", error);
    res.status(500).json({ error: "Error al obtener créditos por rango de fechas" });
  }
};

// Obtener abonos (pagos de créditos) en un rango de fechas
export const getCreditPaymentsByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Debe proporcionar startDate y endDate" });
    }

    const start = new Date(`${startDate}T00:00:00.000`);
    const end = new Date(`${endDate}T23:59:59.999`);

    const payments = await prisma.creditPayment.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        credit: {
          include: {
            client: true,
            sale: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(payments);
  } catch (error) {
    console.error("Error al obtener abonos por rango de fechas:", error);
    res.status(500).json({ error: "Error al obtener abonos por rango de fechas" });
  }
};

