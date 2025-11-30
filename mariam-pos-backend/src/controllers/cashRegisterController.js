import pkg from "@prisma/client";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

// ============================================================
// 📌 ABRIR TURNO DE CAJA
// ============================================================
export const openShift = async (req, res) => {
  try {
    const { branch, cashRegister, cashierName, initialCash } = req.body;

    // Validaciones
    if (!branch || !cashRegister || initialCash === undefined) {
      return res.status(400).json({
        error: "Faltan datos requeridos: branch, cashRegister, initialCash",
      });
    }

    // Verificar si ya hay un turno abierto para esta caja
    const activeShift = await prisma.cashRegisterShift.findFirst({
      where: {
        branch,
        cashRegister,
        status: "OPEN",
      },
    });

    if (activeShift) {
      return res.status(400).json({
        error: `Ya existe un turno abierto para ${branch} - ${cashRegister}`,
        activeShift,
      });
    }

    // Generar número de turno único
    const shiftNumber = `T-${branch}-${cashRegister}-${Date.now()}`;

    // Crear nuevo turno
    const shift = await prisma.cashRegisterShift.create({
      data: {
        shiftNumber,
        branch,
        cashRegister,
        cashierName: cashierName || null,
        initialCash: parseFloat(initialCash) || 0,
        status: "OPEN",
      },
    });

    res.status(201).json(shift);
  } catch (error) {
    console.error("Error al abrir turno:", error);
    res.status(500).json({ error: "Error al abrir turno de caja" });
  }
};

// ============================================================
// 📌 CERRAR TURNO DE CAJA
// ============================================================
export const closeShift = async (req, res) => {
  try {
    const { id } = req.params;
    const { finalCash, notes } = req.body;

    if (finalCash === undefined) {
      return res.status(400).json({
        error: "Debe proporcionar el monto de efectivo contado (finalCash)",
      });
    }

    // Buscar el turno
    const shift = await prisma.cashRegisterShift.findUnique({
      where: { id: parseInt(id) },
      include: {
        sales: true,
        cashMovements: true,
      },
    });

    if (!shift) {
      return res.status(404).json({ error: "Turno no encontrado" });
    }

    if (shift.status !== "OPEN") {
      return res.status(400).json({
        error: `El turno ya está ${shift.status}`,
      });
    }

    // Calcular totales por método de pago desde las ventas
    const sales = shift.sales;
    let totalCash = 0;
    let totalCard = 0;
    let totalTransfer = 0;
    let totalOther = 0;

    sales.forEach((sale) => {
      const amount = sale.total || 0;
      const method = (sale.paymentMethod || "").toLowerCase();

      // Detectar pago mixto
      if (method.includes("mixto")) {
        // Extraer montos de efectivo y tarjeta del string
        // Formato: "Mixto (Efectivo: $X, Tarjeta: $Y)"
        const cashMatch = method.match(/efectivo[:\s]*\$?([\d.]+)/i);
        const cardMatch = method.match(/tarjeta[:\s]*\$?([\d.]+)/i);
        
        const cashAmount = cashMatch ? parseFloat(cashMatch[1]) : 0;
        const cardAmount = cardMatch ? parseFloat(cardMatch[1]) : 0;
        
        totalCash += cashAmount;
        totalCard += cardAmount;
      } else if (method.includes("efectivo") || method === "cash") {
        totalCash += amount;
      } else if (method.includes("tarjeta") || method.includes("card")) {
        totalCard += amount;
      } else if (
        method.includes("transferencia") ||
        method.includes("transfer")
      ) {
        totalTransfer += amount;
      } else if (method.includes("regalo")) {
        // Los regalos NO se suman a totalCash ni a expectedCash
        // Se cuentan en totalOther pero con etiqueta "Regalo"
        totalOther += amount;
      } else {
        totalOther += amount;
      }
    });

    // Calcular movimientos de efectivo (entradas y salidas)
    let totalCashMovements = 0;
    shift.cashMovements.forEach((movement) => {
      if (movement.type === "ENTRADA") {
        totalCashMovements += movement.amount;
      } else if (movement.type === "SALIDA") {
        totalCashMovements -= movement.amount;
      }
    });

    // Obtener IDs de las ventas del turno
    const saleIds = sales.map(sale => sale.id);

    // Obtener créditos generados durante el turno (ventas del turno que tienen crédito)
    const creditsGenerated = await prisma.clientCredit.findMany({
      where: {
        saleId: { in: saleIds },
      },
      include: {
        client: true,
        sale: true,
      },
    });

    // Calcular total de créditos generados
    const totalCreditsGenerated = creditsGenerated.reduce((sum, credit) => sum + credit.originalAmount, 0);

    // Obtener abonos recibidos durante el turno
    // Los abonos se consideran si fueron creados durante el turno
    const creditIds = creditsGenerated.map(credit => credit.id);
    const creditPayments = await prisma.creditPayment.findMany({
      where: {
        creditId: { in: creditIds },
        createdAt: {
          gte: shift.startTime,
          lte: shift.endTime || new Date(),
        },
      },
      include: {
        credit: {
          include: {
            sale: true,
            client: true,
          },
        },
      },
    });

    // Calcular abonos en efectivo (se suman al efectivo esperado)
    let totalCreditPaymentsCash = 0;
    let totalCreditPaymentsCard = 0;
    let totalCreditPaymentsOther = 0;

    creditPayments.forEach((payment) => {
      const method = (payment.paymentMethod || "").toLowerCase();
      if (method.includes("efectivo") || method === "cash" || !payment.paymentMethod) {
        // Si no se especifica método, asumimos efectivo
        totalCreditPaymentsCash += payment.amount;
      } else if (method.includes("tarjeta") || method.includes("card")) {
        totalCreditPaymentsCard += payment.amount;
      } else {
        totalCreditPaymentsOther += payment.amount;
      }
    });

    // Calcular efectivo esperado (fondo inicial + ventas en efectivo + movimientos + abonos en efectivo)
    // Calcular efectivo esperado: Fondo + Ventas efectivo + Movimientos + Abonos efectivo - Créditos generados
    // Los créditos se restan porque representan dinero que NO se recibió en efectivo
    const expectedCash = shift.initialCash + totalCash + totalCashMovements + totalCreditPaymentsCash - totalCreditsGenerated;

    // Calcular diferencia
    const difference = parseFloat(finalCash) - expectedCash;

    // Actualizar y cerrar el turno
    const updatedShift = await prisma.cashRegisterShift.update({
      where: { id: parseInt(id) },
      data: {
        endTime: new Date(),
        finalCash: parseFloat(finalCash),
        expectedCash,
        difference,
        totalCash,
        totalCard,
        totalTransfer,
        totalOther,
        status: "CLOSED",
        notes: notes || null,
      },
    });

    // Incluir información de créditos y abonos en la respuesta
    const response = {
      ...updatedShift,
      creditsInfo: {
        totalCreditsGenerated,
        totalCreditPaymentsCash,
        totalCreditPaymentsCard,
        totalCreditPaymentsOther,
        creditsCount: creditsGenerated.length,
        paymentsCount: creditPayments.length,
        credits: creditsGenerated,
        payments: creditPayments,
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Error al cerrar turno:", error);
    res.status(500).json({ error: "Error al cerrar turno de caja" });
  }
};

// ============================================================
// 📌 OBTENER TURNO ACTIVO
// ============================================================
export const getActiveShift = async (req, res) => {
  try {
    const { branch, cashRegister } = req.query;

    if (!branch || !cashRegister) {
      return res.status(400).json({
        error: "Debe proporcionar branch y cashRegister",
      });
    }

    const shift = await prisma.cashRegisterShift.findFirst({
      where: {
        branch,
        cashRegister,
        status: "OPEN",
      },
      include: {
        sales: {
          select: {
            id: true,
            total: true,
            paymentMethod: true,
            createdAt: true,
          },
        },
        cashMovements: {
          select: {
            id: true,
            type: true,
            amount: true,
            reason: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        startTime: "desc",
      },
    });

    if (!shift) {
      return res.status(404).json({ error: "No hay turno activo" });
    }

    // Calcular totales actualizados
    let totalCash = 0;
    let totalCard = 0;
    let totalTransfer = 0;
    let totalOther = 0;

    shift.sales.forEach((sale) => {
      const amount = sale.total || 0;
      const method = (sale.paymentMethod || "").toLowerCase();

      // Detectar pago mixto
      if (method.includes("mixto")) {
        // Extraer montos de efectivo y tarjeta del string
        const cashMatch = method.match(/efectivo[:\s]*\$?([\d.]+)/i);
        const cardMatch = method.match(/tarjeta[:\s]*\$?([\d.]+)/i);
        
        const cashAmount = cashMatch ? parseFloat(cashMatch[1]) : 0;
        const cardAmount = cardMatch ? parseFloat(cardMatch[1]) : 0;
        
        totalCash += cashAmount;
        totalCard += cardAmount;
      } else if (method.includes("efectivo") || method === "cash") {
        totalCash += amount;
      } else if (method.includes("tarjeta") || method.includes("card")) {
        totalCard += amount;
      } else if (
        method.includes("transferencia") ||
        method.includes("transfer")
      ) {
        totalTransfer += amount;
      } else if (method.includes("regalo")) {
        // Los regalos NO se suman a totalCash ni a expectedCash
        // Se cuentan en totalOther pero con etiqueta "Regalo"
        totalOther += amount;
      } else {
        totalOther += amount;
      }
    });

    // Calcular movimientos de efectivo (entradas y salidas)
    let totalCashMovements = 0;
    shift.cashMovements.forEach((movement) => {
      if (movement.type === "ENTRADA") {
        totalCashMovements += movement.amount;
      } else if (movement.type === "SALIDA") {
        totalCashMovements -= movement.amount;
      }
    });

    // Obtener IDs de las ventas del turno
    const saleIds = shift.sales.map(sale => sale.id);

    // Obtener créditos generados durante el turno
    const creditsGenerated = await prisma.clientCredit.findMany({
      where: {
        saleId: { in: saleIds },
      },
      include: {
        client: true,
        sale: true,
      },
    });

    // Calcular total de créditos generados
    const totalCreditsGenerated = creditsGenerated.reduce((sum, credit) => sum + credit.originalAmount, 0);

    // Obtener abonos recibidos durante el turno
    const creditIds = creditsGenerated.map(credit => credit.id);
    const creditPayments = await prisma.creditPayment.findMany({
      where: {
        creditId: { in: creditIds },
        createdAt: {
          gte: shift.startTime,
        },
      },
      include: {
        credit: {
          include: {
            sale: true,
            client: true,
          },
        },
      },
    });

    // Calcular abonos en efectivo
    let totalCreditPaymentsCash = 0;
    creditPayments.forEach((payment) => {
      const method = (payment.paymentMethod || "").toLowerCase();
      if (method.includes("efectivo") || method === "cash" || !payment.paymentMethod) {
        totalCreditPaymentsCash += payment.amount;
      }
    });

    // Actualizar totales en memoria (no en BD hasta cerrar)
    // El efectivo esperado incluye: fondo inicial + ventas en efectivo + movimientos + abonos en efectivo
    const shiftWithTotals = {
      ...shift,
      totalCash,
      totalCard,
      totalTransfer,
      totalOther,
      // Calcular efectivo esperado restando créditos generados
      // Los créditos se restan porque representan dinero que NO se recibió en efectivo
      expectedCash: shift.initialCash + totalCash + totalCashMovements + totalCreditPaymentsCash - totalCreditsGenerated,
      creditsInfo: {
        totalCreditsGenerated,
        totalCreditPaymentsCash,
        creditsCount: creditsGenerated.length,
        paymentsCount: creditPayments.length,
        credits: creditsGenerated,
        payments: creditPayments,
      },
    };

    res.json(shiftWithTotals);
  } catch (error) {
    console.error("Error al obtener turno activo:", error);
    res.status(500).json({ error: "Error al obtener turno activo" });
  }
};

// ============================================================
// 📌 OBTENER TURNO POR ID
// ============================================================
export const getShiftById = async (req, res) => {
  try {
    const { id } = req.params;

    const shift = await prisma.cashRegisterShift.findUnique({
      where: { id: parseInt(id) },
      include: {
        sales: {
          include: {
            details: {
              include: {
                product: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!shift) {
      return res.status(404).json({ error: "Turno no encontrado" });
    }

    res.json(shift);
  } catch (error) {
    console.error("Error al obtener turno:", error);
    res.status(500).json({ error: "Error al obtener turno" });
  }
};

// ============================================================
// 📌 LISTAR TURNOS POR RANGO DE FECHAS
// ============================================================
export const getShiftsByDateRange = async (req, res) => {
  try {
    const { startDate, endDate, branch, cashRegister, status } = req.query;

    let where = {};

    // Filtro por fechas
    if (startDate && endDate) {
      const start = new Date(`${startDate}T00:00:00.000`);
      const end = new Date(`${endDate}T23:59:59.999`);
      where.startTime = {
        gte: start,
        lte: end,
      };
    }

    // Filtro por sucursal
    if (branch) {
      where.branch = branch;
    }

    // Filtro por caja
    if (cashRegister) {
      where.cashRegister = cashRegister;
    }

    // Filtro por estado
    if (status) {
      where.status = status;
    }

    const shifts = await prisma.cashRegisterShift.findMany({
      where,
      include: {
        sales: {
          select: {
            id: true,
            total: true,
            paymentMethod: true,
          },
        },
      },
      orderBy: {
        startTime: "desc",
      },
    });

    res.json(shifts);
  } catch (error) {
    console.error("Error al obtener turnos:", error);
    res.status(500).json({ error: "Error al obtener turnos" });
  }
};

// ============================================================
// 📌 RESUMEN DE TURNO
// ============================================================
export const getShiftSummary = async (req, res) => {
  try {
    const { id } = req.params;

    const shift = await prisma.cashRegisterShift.findUnique({
      where: { id: parseInt(id) },
      include: {
        sales: {
          include: {
            details: {
              include: {
                product: true,
              },
            },
          },
        },
        cashMovements: true,
      },
    });

    if (!shift) {
      return res.status(404).json({ error: "Turno no encontrado" });
    }

    // Calcular estadísticas
    const totalSales = shift.sales.length;
    const totalAmount = shift.sales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const averageTicket = totalSales > 0 ? totalAmount / totalSales : 0;

    // Desglose por método de pago
    const paymentMethods = {};
    shift.sales.forEach((sale) => {
      const method = sale.paymentMethod || "Otros";
      const methodLower = method.toLowerCase();
      
      // Para pagos mixtos, crear entradas separadas para efectivo y tarjeta
      if (methodLower.includes("mixto")) {
        const cashMatch = method.match(/efectivo[:\s]*\$?([\d.]+)/i);
        const cardMatch = method.match(/tarjeta[:\s]*\$?([\d.]+)/i);
        
        const cashAmount = cashMatch ? parseFloat(cashMatch[1]) : 0;
        const cardAmount = cardMatch ? parseFloat(cardMatch[1]) : 0;
        
        // Agregar a efectivo
        if (!paymentMethods["efectivo"]) {
          paymentMethods["efectivo"] = { count: 0, total: 0 };
        }
        paymentMethods["efectivo"].count += 1;
        paymentMethods["efectivo"].total += cashAmount;
        
        // Agregar a tarjeta
        if (!paymentMethods["tarjeta"]) {
          paymentMethods["tarjeta"] = { count: 0, total: 0 };
        }
        paymentMethods["tarjeta"].count += 1;
        paymentMethods["tarjeta"].total += cardAmount;
      } else if (methodLower.includes("regalo")) {
        // Normalizar regalo
        if (!paymentMethods["Regalo"]) {
          paymentMethods["Regalo"] = { count: 0, total: 0 };
        }
        paymentMethods["Regalo"].count += 1;
        paymentMethods["Regalo"].total += sale.total || 0;
      } else {
        // Para otros métodos, mantener el comportamiento original
        // Normalizar nombres comunes
        let normalizedMethod = method;
        if (methodLower.includes("efectivo") || methodLower === "cash") {
          normalizedMethod = "Efectivo";
        } else if (methodLower.includes("tarjeta") || methodLower.includes("card")) {
          normalizedMethod = "Tarjeta";
        } else if (methodLower.includes("transferencia") || methodLower.includes("transfer")) {
          normalizedMethod = "Transferencia";
        } else if (method === "Otros" || method === "otros") {
          normalizedMethod = "Otros";
        }
        
        if (!paymentMethods[normalizedMethod]) {
          paymentMethods[normalizedMethod] = { count: 0, total: 0 };
        }
        paymentMethods[normalizedMethod].count += 1;
        paymentMethods[normalizedMethod].total += sale.total || 0;
      }
    });

    // Calcular movimientos de efectivo
    let totalCashMovements = 0;
    const movements = shift.cashMovements || [];
    movements.forEach((movement) => {
      if (movement.type === "ENTRADA") {
        totalCashMovements += movement.amount;
      } else if (movement.type === "SALIDA") {
        totalCashMovements -= movement.amount;
      }
    });

    // Obtener IDs de las ventas del turno
    const saleIds = shift.sales.map(sale => sale.id);

    // Obtener créditos generados durante el turno
    const creditsGenerated = await prisma.clientCredit.findMany({
      where: {
        saleId: { in: saleIds },
      },
      include: {
        client: true,
        sale: true,
      },
    });

    // Calcular total de créditos generados
    const totalCreditsGenerated = creditsGenerated.reduce((sum, credit) => sum + credit.originalAmount, 0);

    // Obtener abonos recibidos durante el turno
    const creditIds = creditsGenerated.map(credit => credit.id);
    const creditPayments = await prisma.creditPayment.findMany({
      where: {
        creditId: { in: creditIds },
        createdAt: {
          gte: shift.startTime,
          lte: shift.endTime || new Date(),
        },
      },
      include: {
        credit: {
          include: {
            sale: true,
            client: true,
          },
        },
      },
    });

    // Calcular abonos en efectivo, tarjeta y otros
    let totalCreditPaymentsCash = 0;
    let totalCreditPaymentsCard = 0;
    let totalCreditPaymentsOther = 0;

    creditPayments.forEach((payment) => {
      const method = (payment.paymentMethod || "").toLowerCase();
      if (method.includes("efectivo") || method === "cash" || !payment.paymentMethod) {
        totalCreditPaymentsCash += payment.amount;
      } else if (method.includes("tarjeta") || method.includes("card")) {
        totalCreditPaymentsCard += payment.amount;
      } else {
        totalCreditPaymentsOther += payment.amount;
      }
    });

    // Calcular ventas en efectivo basándose en las ventas actuales
    const ventasEfectivo = paymentMethods["efectivo"]?.total || paymentMethods["Efectivo"]?.total || 0;

    // Calcular efectivo esperado (incluye movimientos, abonos en efectivo y resta créditos generados)
    // Los créditos se restan porque representan dinero que NO se recibió en efectivo
    // Siempre calcular basándose en valores actuales, no en valores almacenados
    const calculatedExpectedCash = shift.initialCash + ventasEfectivo + totalCashMovements + totalCreditPaymentsCash - totalCreditsGenerated;

    const summary = {
      shift: {
        id: shift.id,
        shiftNumber: shift.shiftNumber,
        branch: shift.branch,
        cashRegister: shift.cashRegister,
        cashierName: shift.cashierName,
        startTime: shift.startTime,
        endTime: shift.endTime,
        status: shift.status,
        initialCash: shift.initialCash,
        finalCash: shift.finalCash,
        expectedCash: calculatedExpectedCash, // Valor calculado basado en ventas actuales
        difference: shift.difference,
        notes: shift.notes,
      },
      totals: {
        totalCash: ventasEfectivo, // Usar valor calculado de las ventas actuales
        totalCard: paymentMethods["tarjeta"]?.total || paymentMethods["Tarjeta"]?.total || 0,
        totalTransfer: paymentMethods["transferencia"]?.total || paymentMethods["Transferencia"]?.total || 0,
        totalOther: paymentMethods["Otros"]?.total || 0,
      },
      statistics: {
        totalSales,
        totalAmount,
        averageTicket,
      },
      paymentMethods,
      cashMovements: movements, // Incluir movimientos en el summary
      cashMovementsSummary: {
        totalEntradas: movements.filter(m => m.type === "ENTRADA").reduce((sum, m) => sum + m.amount, 0),
        totalSalidas: movements.filter(m => m.type === "SALIDA").reduce((sum, m) => sum + m.amount, 0),
        neto: totalCashMovements,
      },
      creditsInfo: {
        totalCreditsGenerated,
        totalCreditPaymentsCash,
        totalCreditPaymentsCard,
        totalCreditPaymentsOther,
        creditsCount: creditsGenerated.length,
        paymentsCount: creditPayments.length,
        credits: creditsGenerated,
        payments: creditPayments,
      },
    };

    res.json(summary);
  } catch (error) {
    console.error("Error al obtener resumen de turno:", error);
    res.status(500).json({ error: "Error al obtener resumen de turno" });
  }
};

// ============================================================
// 📌 CANCELAR TURNO
// ============================================================
export const cancelShift = async (req, res) => {
  try {
    const { id } = req.params;

    const shift = await prisma.cashRegisterShift.findUnique({
      where: { id: parseInt(id) },
      include: {
        sales: true,
      },
    });

    if (!shift) {
      return res.status(404).json({ error: "Turno no encontrado" });
    }

    if (shift.status !== "OPEN") {
      return res.status(400).json({
        error: `No se puede cancelar un turno que está ${shift.status}`,
      });
    }

    // Solo permitir cancelar si no tiene ventas
    if (shift.sales.length > 0) {
      return res.status(400).json({
        error: "No se puede cancelar un turno que tiene ventas registradas",
      });
    }

    const cancelledShift = await prisma.cashRegisterShift.update({
      where: { id: parseInt(id) },
      data: {
        status: "CANCELLED",
        endTime: new Date(),
      },
    });

    res.json(cancelledShift);
  } catch (error) {
    console.error("Error al cancelar turno:", error);
    res.status(500).json({ error: "Error al cancelar turno" });
  }
};

// ============================================================
// 📌 REGISTRAR MOVIMIENTO DE EFECTIVO (ENTRADA O SALIDA)
// ============================================================
export const createCashMovement = async (req, res) => {
  try {
    const { shiftId, type, amount, reason, notes, createdBy } = req.body;

    // Validaciones
    if (!shiftId || !type || amount === undefined) {
      return res.status(400).json({
        error: "Faltan datos requeridos: shiftId, type, amount",
      });
    }

    if (type !== "ENTRADA" && type !== "SALIDA") {
      return res.status(400).json({
        error: "El tipo debe ser ENTRADA o SALIDA",
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        error: "El monto debe ser mayor a 0",
      });
    }

    // Verificar que el turno existe y está abierto
    const shift = await prisma.cashRegisterShift.findUnique({
      where: { id: parseInt(shiftId) },
    });

    if (!shift) {
      return res.status(404).json({ error: "Turno no encontrado" });
    }

    if (shift.status !== "OPEN") {
      return res.status(400).json({
        error: "Solo se pueden registrar movimientos en turnos abiertos",
      });
    }

    // Crear el movimiento
    const movement = await prisma.cashMovement.create({
      data: {
        shiftId: parseInt(shiftId),
        type,
        amount: parseFloat(amount),
        reason: reason || null,
        notes: notes || null,
        createdBy: createdBy || null,
      },
    });

    res.status(201).json(movement);
  } catch (error) {
    console.error("Error al registrar movimiento de efectivo:", error);
    res.status(500).json({ error: "Error al registrar movimiento de efectivo" });
  }
};

// ============================================================
// 📌 OBTENER MOVIMIENTOS DE EFECTIVO DE UN TURNO
// ============================================================
export const getCashMovementsByShift = async (req, res) => {
  try {
    const { shiftId } = req.params;

    const movements = await prisma.cashMovement.findMany({
      where: {
        shiftId: parseInt(shiftId),
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(movements);
  } catch (error) {
    console.error("Error al obtener movimientos de efectivo:", error);
    res.status(500).json({ error: "Error al obtener movimientos de efectivo" });
  }
};

// ============================================================
// 📌 OBTENER MOVIMIENTOS DE EFECTIVO POR RANGO DE FECHAS
// ============================================================
export const getCashMovementsByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Debe proporcionar startDate y endDate" });
    }

    const start = new Date(`${startDate}T00:00:00.000`);
    const end = new Date(`${endDate}T23:59:59.999`);

    const movements = await prisma.cashMovement.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        shift: {
          select: {
            id: true,
            shiftNumber: true,
            branch: true,
            cashRegister: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(movements);
  } catch (error) {
    console.error("Error al obtener movimientos por rango de fechas:", error);
    res.status(500).json({ error: "Error al obtener movimientos por rango de fechas" });
  }
};

// ============================================================
// 📌 ELIMINAR MOVIMIENTO DE EFECTIVO
// ============================================================
export const deleteCashMovement = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el movimiento existe
    const movement = await prisma.cashMovement.findUnique({
      where: { id: parseInt(id) },
      include: {
        shift: true,
      },
    });

    if (!movement) {
      return res.status(404).json({ error: "Movimiento no encontrado" });
    }

    // Solo permitir eliminar si el turno está abierto
    if (movement.shift.status !== "OPEN") {
      return res.status(400).json({
        error: "Solo se pueden eliminar movimientos de turnos abiertos",
      });
    }

    // Eliminar el movimiento
    await prisma.cashMovement.delete({
      where: { id: parseInt(id) },
    });

    res.json({ message: "Movimiento eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar movimiento de efectivo:", error);
    res.status(500).json({ error: "Error al eliminar movimiento de efectivo" });
  }
};

// ============================================================
// 📌 OBTENER HISTORIAL DE MOVIMIENTOS POR RANGO DE FECHAS
// ============================================================
export const getCashMovementsHistory = async (req, res) => {
  try {
    const { startDate, endDate, cashRegister } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Debe proporcionar startDate y endDate" });
    }

    const start = new Date(`${startDate}T00:00:00.000`);
    const end = new Date(`${endDate}T23:59:59.999`);

    const where = {
      createdAt: {
        gte: start,
        lte: end,
      },
    };

    // Agregar filtro de caja si se especifica
    if (cashRegister) {
      where.shift = {
        cashRegister: cashRegister,
      };
    }

    const movements = await prisma.cashMovement.findMany({
      where,
      include: {
        shift: {
          select: {
            id: true,
            shiftNumber: true,
            branch: true,
            cashRegister: true,
            cashierName: true,
            startTime: true,
            endTime: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(movements);
  } catch (error) {
    console.error("Error al obtener historial de movimientos:", error);
    res.status(500).json({ error: "Error al obtener historial de movimientos" });
  }
};

