import prisma from "../utils/prisma.js";

// ============================================================
// 📦 CREAR DEPÓSITO DE ENVASES DE CLIENTE
// ============================================================
export const createClientContainerDeposit = async (req, res) => {
  try {
    const {
      clientId,
      saleId,
      containerName,
      quantity,
      importAmount,
      unitPrice,
      shiftId,
      cashMovementId,
      notes,
    } = req.body;

    console.log("📦 Datos recibidos para crear depósito de envase:", {
      clientId,
      saleId,
      containerName,
      quantity,
      importAmount,
      unitPrice,
      shiftId,
      cashMovementId,
      notes,
    });

    if (!clientId || !containerName || !quantity || !importAmount || !unitPrice) {
      console.error("❌ Datos incompletos:", { clientId, containerName, quantity, importAmount, unitPrice });
      return res.status(400).json({ error: "Datos incompletos" });
    }

    // Validar que el cliente existe
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      console.error("❌ Cliente no encontrado:", clientId);
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    // Validar que el shift existe si se proporciona
    if (shiftId) {
      const shift = await prisma.cashRegisterShift.findUnique({
        where: { id: parseInt(shiftId) },
      });

      if (!shift) {
        console.error("❌ Turno no encontrado:", shiftId);
        return res.status(404).json({ error: "Turno no encontrado" });
      }
    }

    // Validar que el cashMovement existe si se proporciona
    if (cashMovementId) {
      const cashMovement = await prisma.cashMovement.findUnique({
        where: { id: parseInt(cashMovementId) },
      });

      if (!cashMovement) {
        console.error("❌ Movimiento de efectivo no encontrado:", cashMovementId);
        return res.status(404).json({ error: "Movimiento de efectivo no encontrado" });
      }
    }

    const deposit = await prisma.clientContainerDeposit.create({
      data: {
        clientId,
        saleId: saleId ? parseInt(saleId) : null,
        containerName,
        quantity: parseInt(quantity),
        importAmount: parseFloat(importAmount),
        unitPrice: parseFloat(unitPrice),
        shiftId: shiftId ? parseInt(shiftId) : null,
        cashMovementId: cashMovementId ? parseInt(cashMovementId) : null,
        notes,
        status: "PENDING",
      },
      include: {
        client: true,
        shift: true,
      },
    });

    console.log("✅ Depósito de envase creado exitosamente:", deposit.id);
    res.json(deposit);
  } catch (error) {
    console.error("❌ Error al crear depósito de envase:", error);
    console.error("❌ Detalles del error:", {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
    });
    res.status(500).json({ 
      error: "Error al crear depósito de envase",
      details: error.message,
    });
  }
};

// ============================================================
// 📦 OBTENER DEPÓSITOS PENDIENTES DE UN CLIENTE
// ============================================================
export const getClientPendingDeposits = async (req, res) => {
  try {
    const { clientId } = req.params;

    const deposits = await prisma.clientContainerDeposit.findMany({
      where: {
        clientId,
        status: "PENDING",
      },
      include: {
        shift: {
          select: {
            id: true,
            shiftNumber: true,
            branch: true,
            cashRegister: true,
            cashierName: true,
            startTime: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Agrupar por tipo de envase
    const grouped = {};
    deposits.forEach((deposit) => {
      if (!grouped[deposit.containerName]) {
        grouped[deposit.containerName] = {
          containerName: deposit.containerName,
          unitPrice: deposit.unitPrice,
          totalQuantity: 0,
          totalAmount: 0,
          deposits: [],
        };
      }
      grouped[deposit.containerName].totalQuantity += deposit.quantity;
      grouped[deposit.containerName].totalAmount += deposit.importAmount;
      grouped[deposit.containerName].deposits.push(deposit);
    });

    res.json({
      deposits: deposits,
      summary: Object.values(grouped),
      totalContainers: deposits.reduce((sum, d) => sum + d.quantity, 0),
      totalAmount: deposits.reduce((sum, d) => sum + d.importAmount, 0),
    });
  } catch (error) {
    console.error("Error al obtener depósitos pendientes:", error);
    res.status(500).json({ error: "Error al obtener depósitos pendientes" });
  }
};

// ============================================================
// 📦 MARCAR TODOS LOS DEPÓSITOS PENDIENTES DE UN CLIENTE COMO DEVUELTOS
// ============================================================
export const returnAllClientContainerDeposits = async (req, res) => {
  try {
    const { clientId } = req.params;

    if (!clientId) {
      return res.status(400).json({ error: "ID de cliente requerido" });
    }

    // Verificar que el cliente existe
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    // Obtener todos los depósitos pendientes del cliente
    const pendingDeposits = await prisma.clientContainerDeposit.findMany({
      where: {
        clientId,
        status: "PENDING",
      },
    });

    if (pendingDeposits.length === 0) {
      return res.status(400).json({ error: "No hay depósitos pendientes para este cliente" });
    }

    // Marcar todos como devueltos
    const updatedDeposits = await prisma.clientContainerDeposit.updateMany({
      where: {
        clientId,
        status: "PENDING",
      },
      data: {
        status: "RETURNED",
        returnedAt: new Date(),
      },
    });

    res.json({
      message: "Depósitos marcados como devueltos",
      count: updatedDeposits.count,
    });
  } catch (error) {
    console.error("Error al marcar depósitos como devueltos:", error);
    res.status(500).json({ error: "Error al marcar depósitos como devueltos" });
  }
};

// ============================================================
// 📦 MARCAR DEPÓSITO COMO DEVUELTO
// ============================================================
export const returnClientContainerDeposit = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body; // Cantidad a devolver (opcional, si no se especifica devuelve todo)

    const deposit = await prisma.clientContainerDeposit.findUnique({
      where: { id: parseInt(id) },
    });

    if (!deposit) {
      return res.status(404).json({ error: "Depósito no encontrado" });
    }

    if (deposit.status === "RETURNED") {
      return res.status(400).json({ error: "Este depósito ya fue devuelto" });
    }

    const quantityToReturn = quantity ? parseInt(quantity) : deposit.quantity;

    if (quantityToReturn > deposit.quantity) {
      return res.status(400).json({ error: "La cantidad a devolver excede la cantidad pendiente" });
    }

    // Si se devuelve todo, marcar como devuelto
    // Si se devuelve parcial, crear un nuevo registro con la cantidad restante
    if (quantityToReturn === deposit.quantity) {
      await prisma.clientContainerDeposit.update({
        where: { id: parseInt(id) },
        data: {
          status: "RETURNED",
          returnedAt: new Date(),
        },
      });
    } else {
      // Devolución parcial: actualizar el depósito actual y crear uno nuevo con lo restante
      const remainingQuantity = deposit.quantity - quantityToReturn;
      const remainingAmount = deposit.unitPrice * remainingQuantity;

      await prisma.clientContainerDeposit.update({
        where: { id: parseInt(id) },
        data: {
          quantity: quantityToReturn,
          importAmount: deposit.unitPrice * quantityToReturn,
          status: "RETURNED",
          returnedAt: new Date(),
        },
      });

      // Crear nuevo depósito con la cantidad restante
      await prisma.clientContainerDeposit.create({
        data: {
          clientId: deposit.clientId,
          saleId: deposit.saleId,
          containerName: deposit.containerName,
          quantity: remainingQuantity,
          importAmount: remainingAmount,
          unitPrice: deposit.unitPrice,
          shiftId: deposit.shiftId,
          notes: deposit.notes,
          status: "PENDING",
        },
      });
    }

    const updatedDeposit = await prisma.clientContainerDeposit.findUnique({
      where: { id: parseInt(id) },
      include: {
        client: true,
      },
    });

    res.json(updatedDeposit);
  } catch (error) {
    console.error("Error al devolver depósito:", error);
    res.status(500).json({ error: "Error al devolver depósito" });
  }
};

// ============================================================
// 📦 OBTENER TODOS LOS DEPÓSITOS (con filtros)
// ============================================================
export const getAllClientContainerDeposits = async (req, res) => {
  try {
    const { clientId, status, startDate, endDate } = req.query;

    const where = {};

    if (clientId) where.clientId = clientId;
    if (status) where.status = status;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(`${startDate}T00:00:00.000`);
      }
      if (endDate) {
        where.createdAt.lte = new Date(`${endDate}T23:59:59.999`);
      }
    }

    const deposits = await prisma.clientContainerDeposit.findMany({
      where,
      include: {
        client: true,
        shift: {
          select: {
            id: true,
            shiftNumber: true,
            branch: true,
            cashRegister: true,
            startTime: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(deposits);
  } catch (error) {
    console.error("Error al obtener depósitos:", error);
    res.status(500).json({ error: "Error al obtener depósitos" });
  }
};

