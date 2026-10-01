import prisma from "../utils/prisma.js";

/**
 * Computes the base-unit quantity for a sale detail line.
 *
 * When the line comes from a product presentation (e.g. a "Bulto" that
 * contains 20 kg), the quantity must be expressed in the product's base unit
 * so inventory can later be moved in base units on returns/cancellations.
 *
 * The presentation multiplier (units contained per presentation) is read from
 * the detail payload. The following field names are accepted, in order:
 * `baseUnitQuantity` (already computed by the client), `presentationQuantity`,
 * or `presentationUnits`.
 *
 * - If `baseUnitQuantity` is provided and valid, it is used as-is.
 * - Else if a presentation multiplier > 1 is provided: quantity * multiplier.
 * - Otherwise (simple product / historical sale): falls back to quantity.
 *
 * @param {object} detail - The incoming sale detail payload.
 * @returns {number} The quantity expressed in the product's base unit.
 */
export const computeBaseUnitQuantity = (detail) => {
  const quantity = Number(detail?.quantity) || 0;

  const explicitBase = Number(detail?.baseUnitQuantity);
  if (Number.isFinite(explicitBase) && explicitBase > 0) {
    return explicitBase;
  }

  const multiplier = Number(
    detail?.presentationQuantity ?? detail?.presentationUnits
  );
  if (Number.isFinite(multiplier) && multiplier > 1) {
    return quantity * multiplier;
  }

  // Simple product or historical sale without presentation data.
  return quantity;
};

export const getSales = async (req, res) => {
  const sales = await prisma.sale.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      details: {
        include: {
          product: {
            include: {
              category:true
            }
          }, // ✅ traer información del producto
        },
      },
    },
  });
  res.json(sales);
};

export const getSalesById = async (req, res) => {
  const { id } = req.params;
  const sale = await prisma.sale.findUnique({
    where: { id: parseInt(id) },
    include: {
      details: {
        include: {
          product: true, // ✅ traer información del producto
        },
      },
    },
  });
  res.json(sale);
};

export const createSales = async (req, res) => {
  try {
    const { folio, status, total, branch, cashRegister, paymentMethod, clientName, createdBy, amountReceived, paymentReference, details } =
      req.body;

    if (!details || details.length === 0) {
      return res
        .status(400)
        .json({ error: "Debe incluir al menos un detalle de venta" });
    }

    // Buscar turno activo para esta caja (si existe)
    let shiftId = null;
    if (branch && cashRegister) {
      const activeShift = await prisma.cashRegisterShift.findFirst({
        where: {
          branch,
          cashRegister,
          status: "OPEN",
        },
      });
      if (activeShift) {
        shiftId = activeShift.id;
      }
    }

    const sale = await prisma.sale.create({
      data: {
        folio,
        status,
        total,
        branch,
        cashRegister,
        paymentMethod,
        clientName,
        createdBy: createdBy?.trim() || null, // Cajero que registró la venta
        amountReceived: amountReceived != null ? Number(amountReceived) : null, // Monto recibido (efectivo)
        paymentReference: paymentReference?.trim() || null, // Folio/ref comprobante (tarjeta)
        shiftId, // Asociar venta al turno activo si existe
        details: {
          create: details.map((d) => ({
            productId: d.productId,
            quantity: d.quantity,
            price: d.price,
            productName: d.productName,
            subTotal: d.subTotal,
            unitAbbrev: d.unitAbbrev || null, // Unidad congelada al momento de la venta
            baseUnitQuantity: computeBaseUnitQuantity(d), // Cantidad en unidad base (para devoluciones/cancelaciones)
          })),
        },
      },
      include: {
        details: {
          include: { product: true }, // Para mostrar info del producto
        },
      },
    });

    res.status(201).json(sale);
  } catch (error) {
    console.error("Error al registrar la venta:", error);
    res.status(500).json({ error: "Error al registrar la venta" });
  }
};

// Métodos simples admitidos para la corrección de pago. Los textos coinciden
// con los que `cashRegisterController` reconoce al recalcular los totales del
// turno (efectivo / tarjeta / transferencia), de modo que el corte cuadre sin
// lógica adicional.
const SIMPLE_PAYMENT_METHODS = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  regalo: "Regalo",
};

/**
 * Corrige el método de pago de una venta (solo métodos simples).
 *
 * Caso de uso: la venta se cobró con tarjeta/transferencia pero quedó
 * registrada como efectivo (o viceversa). Como los totales del turno se
 * RECALCULAN dinámicamente desde `shift.sales` (ver getShiftSummary/closeShift),
 * basta con actualizar `Sale.paymentMethod`: el corte se reajusta solo.
 *
 * Reglas:
 * - La venta debe existir (404) y no estar "Cancelada" (409).
 * - El nuevo método debe ser efectivo | tarjeta | transferencia (400).
 * - El turno asociado a la venta debe estar OPEN; si está cerrado/cancelado o
 *   la venta no tiene turno, se rechaza (409) para no alterar un corte ya hecho.
 * - No se permite corregir ventas con pago mixto por esta vía (400), porque
 *   requiere editar montos por porción (fuera de alcance).
 */
export const updateSalePaymentMethod = async (req, res) => {
  try {
    const saleId = parseInt(req.params.id, 10);
    const { paymentMethod } = req.body ?? {};

    if (!Number.isInteger(saleId)) {
      return res.status(400).json({ error: "Id de venta inválido" });
    }

    const key = String(paymentMethod || "").trim().toLowerCase();
    const normalized = SIMPLE_PAYMENT_METHODS[key];
    if (!normalized) {
      return res.status(400).json({
        error:
          "Método de pago inválido. Usa efectivo, tarjeta, transferencia o regalo.",
      });
    }

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { shift: true },
    });

    if (!sale) {
      return res.status(404).json({ error: "Venta no encontrada" });
    }

    if (sale.status === "Cancelada") {
      return res
        .status(409)
        .json({ error: "No se puede modificar una venta cancelada" });
    }

    // No corregir pagos mixtos por esta vía (requiere editar montos).
    if ((sale.paymentMethod || "").toLowerCase().includes("mixto")) {
      return res.status(400).json({
        error:
          "No se puede corregir un pago mixto desde aquí. Edita los montos por porción.",
      });
    }

    // Solo turnos abiertos: cambiar el método reacomoda el corte del turno.
    if (!sale.shift || sale.shift.status !== "OPEN") {
      return res.status(409).json({
        error:
          "Solo se puede corregir el método de pago de ventas de un turno abierto.",
      });
    }

    const updated = await prisma.sale.update({
      where: { id: saleId },
      data: { paymentMethod: normalized },
      include: { details: { include: { product: true } } },
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Error al corregir el método de pago:", error);
    return res
      .status(500)
      .json({ error: "Error al corregir el método de pago" });
  }
};

export const getSalesByDateRange = async (req, res) => {
  try {
    const { startDate, endDate, cashRegister } = req.query;
    console.log('startDate, endDate, cashRegister',startDate, endDate, cashRegister);
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ message: "Debe proporcionar startDate y endDate" });
    }

    // Ajustar el rango completo del día
    const start = new Date(`${startDate}T00:00:00.000`);
    const end = new Date(`${endDate}T23:59:59.999`);
    console.log("start", start, "end", end);

    // Validar fechas
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: "Fechas inválidas" });
    } 

    const where = {
      createdAt: {
        gte: start, // mayor o igual que startDate
        lte: end, // menor o igual que endDate
      },
    };

    // Agregar filtro de caja si se especifica
    if (cashRegister) {
      where.cashRegister = cashRegister;
    }

    const sales = await prisma.sale.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        details: {
          include: { product: true }, // Para mostrar info del producto
        },
        shift: {
          select: {
            id: true,
            shiftNumber: true,
          },
        },
      },
    });

    res.json(sales);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error al obtener ventas por rango de fechas" });
  }
};

//Reportes
//Devuelve totales generales
export const getSalesSummary = async (req, res) => {
  const { range, start, end, cashRegister } = req.query;
  let where = {};
  const now = new Date();

  if (range === "day") {
    const startDay = new Date();
    startDay.setHours(0, 0, 0, 0);
    const endDay = new Date();
    endDay.setHours(23, 59, 59, 999);
    where = { createdAt: { gte: startDay, lte: endDay } };
  } else if (range === "week") {
    const startWeek = new Date();
    startWeek.setDate(now.getDate() - 7);
    where = { createdAt: { gte: startWeek } };
  } else if (range === "month") {
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    where = { createdAt: { gte: startMonth } };
  } else if (start && end) {
    // Ajustar el rango completo del día para fechas personalizadas
    // Formato esperado: YYYY-MM-DD
    const startDate = new Date(`${start}T00:00:00.000`);
    const endDate = new Date(`${end}T23:59:59.999`);
    where = { createdAt: { gte: startDate, lte: endDate } };
  }

  // Agregar filtro de caja si se especifica
  if (cashRegister) {
    where.cashRegister = cashRegister;
  }

  // Excluir ventas canceladas del resumen (Req 8.4)
  where.status = { not: "Cancelada" };

  try {
    // Conteo: solo ventas no canceladas
    const totalVentas = await prisma.sale.count({ where });

    // Ingreso neto: sumar netSubTotal por renglón sobre las ventas no
    // canceladas, en lugar de Sale.total (que no refleja devoluciones
    // parciales). netSubTotal = subTotal * ((quantity - returnedQuantity)/quantity)
    // (Req 8.5, 8.6)
    const sales = await prisma.sale.findMany({
      where,
      include: { details: true },
    });

    let totalDinero = 0;
    sales.forEach((sale) => {
      sale.details.forEach((detail) => {
        const quantity = detail.quantity || 0;
        if (quantity > 0) {
          const netQuantity = quantity - (detail.returnedQuantity || 0);
          totalDinero += detail.subTotal * (netQuantity / quantity);
        }
      });
    });

    res.json({
      totalVentas,
      totalDinero,
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener resumen de ventas" });
  }
};

//Mostrar ventas por día o semana
export const getDailySales = async (req, res) => {
  try {
    const { range, start, end, cashRegister } = req.query;

    const now = new Date();
    let where = {};

    if (range === "day") {
      const startDay = new Date();
      startDay.setHours(0, 0, 0, 0);
      const endDay = new Date();
      endDay.setHours(23, 59, 59, 999);
      where = { createdAt: { gte: startDay, lte: endDay } };
    } else if (range === "week") {
      const startWeek = new Date();
      startWeek.setDate(now.getDate() - 7);
      where = { createdAt: { gte: startWeek } };
    } else if (range === "month") {
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      where = { createdAt: { gte: startMonth } };
    } else if (start && end) {
      // Ajustar el rango completo del día para fechas personalizadas
      // Formato esperado: YYYY-MM-DD
      const startDate = new Date(`${start}T00:00:00.000`);
      const endDate = new Date(`${end}T23:59:59.999`);
      where = { createdAt: { gte: startDate, lte: endDate } };
    }
    
    // Agregar filtro de caja si se especifica
    if (cashRegister) {
      where.cashRegister = cashRegister;
    }

    // Excluir ventas canceladas del reporte diario (Req 8.4).
    // En Prisma, `status: { not: "Cancelada" }` conserva las ventas con
    // status null o "Pagado" (equivalente a `status IS NULL OR status <> 'Cancelada'`).
    where.status = { not: "Cancelada" };

    // Se reemplaza el $queryRaw (que sumaba Sale.total y no reflejaba
    // devoluciones parciales) por findMany + agrupación en JS, para calcular
    // el ingreso neto por renglón igual que getSalesSummary (Req 8.5, 8.6).
    // netSubTotal = subTotal * ((quantity - returnedQuantity)/quantity),
    // 0 cuando quantity es 0.
    const sales = await prisma.sale.findMany({
      where,
      include: { details: true },
    });

    const result = sales.reduce((acc, sale) => {
      const dateOnly = new Date(sale.createdAt).toLocaleDateString('en-CA'); // 'YYYY-MM-DD'

      let netTotal = 0;
      sale.details.forEach((detail) => {
        const quantity = detail.quantity || 0;
        if (quantity > 0) {
          const netQuantity = quantity - (detail.returnedQuantity || 0);
          netTotal += detail.subTotal * (netQuantity / quantity);
        }
      });

      const existing = acc.find(r => r.date === dateOnly);
      if (existing) {
        existing.total += netTotal;
      } else {
        acc.push({ date: dateOnly, total: netTotal });
      }
      return acc;
    }, []);

    // Mantener el orden descendente por fecha (como el ORDER BY date DESC original)
    result.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

   res.json(result);
   } catch (error) {
    console.error("Error al obtener ventas diarias:", error);
    res.status(500).json({ error: "Error al obtener ventas diarias" });
  }
};

export const getTopProducts = async (req, res) => {
  try {
    const { range, start, end, cashRegister } = req.query;
    let where = {};
    const now = new Date();
  
    if (range === "day") {
      const startDay = new Date();
      startDay.setHours(0, 0, 0, 0);
      const endDay = new Date();
      endDay.setHours(23, 59, 59, 999);
      where = { createdAt: { gte: startDay, lte: endDay } };
    } else if (range === "week") {
      const startWeek = new Date();
      startWeek.setDate(now.getDate() - 7);
      where = { createdAt: { gte: startWeek } };
    } else if (range === "month") {
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      where = { createdAt: { gte: startMonth } };
    } else if (start && end) {
      // Ajustar el rango completo del día para fechas personalizadas
      // Formato esperado: YYYY-MM-DD
      const startDate = new Date(`${start}T00:00:00.000`);
      const endDate = new Date(`${end}T23:59:59.999`);
      where = { createdAt: { gte: startDate, lte: endDate } };
    }
    
    // Construir el where para los detalles de venta
    const detailWhere = { ...where };

    // Filtrar por la venta asociada: excluir ventas canceladas (Req 8.3)
    // y aplicar el filtro de caja si se especifica.
    detailWhere.sale = {
      status: { not: "Cancelada" },
      ...(cashRegister ? { cashRegister } : {}),
    };

    // Obtener todos los detalles de venta
    const allDetails = await prisma.saleDetail.findMany({
      where: detailWhere,
      select: {
        productName: true,
        quantity: true,
        returnedQuantity: true,
      },
    });

    // Agrupar productos, normalizando productos no registrados
    const productMap = new Map();
    
    allDetails.forEach((detail) => {
      let normalizedName = detail.productName || 'Sin nombre';
      
      // Normalizar productos no registrados (que empiezan con "Producto no registrado")
      // Pueden tener variaciones como "Producto no registrado 1", "Producto no registrado 2", etc.
      if (normalizedName.toLowerCase().startsWith('producto no registrado')) {
        normalizedName = 'Producto no registrado';
      }
      
      // Cantidad neta: descontar lo ya devuelto por renglón (Req 8.5)
      const netQuantity = (detail.quantity || 0) - (detail.returnedQuantity || 0);

      if (productMap.has(normalizedName)) {
        productMap.set(normalizedName, productMap.get(normalizedName) + netQuantity);
      } else {
        productMap.set(normalizedName, netQuantity);
      }
    });

    // Convertir a array y ordenar por cantidad descendente
    const topProducts = Array.from(productMap.entries())
      .map(([productName, totalQuantity]) => ({
        productName,
        _sum: { quantity: totalQuantity },
      }))
      .sort((a, b) => b._sum.quantity - a._sum.quantity)
      .slice(0, 10);

    res.json(topProducts);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener productos más vendidos" });
  }
};


export const getSalesByPaymentMethod = async (req, res) => {
  try {
    const { range, start, end, cashRegister } = req.query;
    let where = {};
    const now = new Date();
  
    if (range === "day") {
      const startDay = new Date();
      startDay.setHours(0, 0, 0, 0);
      const endDay = new Date();
      endDay.setHours(23, 59, 59, 999);
      where = { createdAt: { gte: startDay, lte: endDay } };
    } else if (range === "week") {
      const startWeek = new Date();
      startWeek.setDate(now.getDate() - 7);
      where = { createdAt: { gte: startWeek } };
    } else if (range === "month") {
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      where = { createdAt: { gte: startMonth } };
    } else if (start && end) {
      // Ajustar el rango completo del día para fechas personalizadas
      // Formato esperado: YYYY-MM-DD
      const startDate = new Date(`${start}T00:00:00.000`);
      const endDate = new Date(`${end}T23:59:59.999`);
      where = { createdAt: { gte: startDate, lte: endDate } };
    }

    // Agregar filtro de caja si se especifica
    if (cashRegister) {
      where.cashRegister = cashRegister;
    }

    // Excluir ventas canceladas por consistencia del ingreso neto (Req 8.6)
    where.status = { not: "Cancelada" };

    // Obtener todas las ventas para poder agrupar los mixtos manualmente
    const sales = await prisma.sale.findMany({
      where,
      select: {
        paymentMethod: true,
        total: true
      }
    });

    // Agrupar manualmente para unificar los pagos mixtos
    const methodMap = new Map();
    
    sales.forEach(sale => {
      const method = sale.paymentMethod || 'Sin método';
      const methodLower = method.toLowerCase();
      
      // Detectar si es un pago mixto
      let normalizedMethod = method;
      if (methodLower.includes('mixto')) {
        normalizedMethod = 'Mixto';
      } else {
        // Normalizar otros métodos comunes
        if (methodLower.includes('efectivo') && !methodLower.includes('mixto')) {
          normalizedMethod = 'Efectivo';
        } else if (methodLower.includes('tarjeta') && !methodLower.includes('mixto')) {
          normalizedMethod = 'Tarjeta';
        } else if (methodLower.includes('regalo')) {
          normalizedMethod = 'Regalo';
        }
      }
      
      // Agregar o actualizar el total
      const current = methodMap.get(normalizedMethod) || { paymentMethod: normalizedMethod, _sum: { total: 0 } };
      current._sum.total += sale.total || 0;
      methodMap.set(normalizedMethod, current);
    });

    // Convertir a array y ordenar por total descendente
    const salesByMethod = Array.from(methodMap.values()).sort((a, b) => b._sum.total - a._sum.total);
    
    res.json(salesByMethod);
  } catch (error) {
    console.error("Error al obtener ventas por método de pago:", error);
    res.status(500).json({ error: 'Error al obtener ventas por método de pago' });
  }
};

// Ventas por categoría/departamento
export const getSalesByCategory = async (req, res) => {
  try {
    const { range, start, end, cashRegister } = req.query;
    let where = {};
    const now = new Date();
  
    if (range === "day") {
      const startDay = new Date();
      startDay.setHours(0, 0, 0, 0);
      const endDay = new Date();
      endDay.setHours(23, 59, 59, 999);
      where = { createdAt: { gte: startDay, lte: endDay } };
    } else if (range === "week") {
      const startWeek = new Date();
      startWeek.setDate(now.getDate() - 7);
      where = { createdAt: { gte: startWeek } };
    } else if (range === "month") {
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      where = { createdAt: { gte: startMonth } };
    } else if (start && end) {
      // Ajustar el rango completo del día para fechas personalizadas
      // Formato esperado: YYYY-MM-DD
      const startDate = new Date(`${start}T00:00:00.000`);
      const endDate = new Date(`${end}T23:59:59.999`);
      where = { createdAt: { gte: startDate, lte: endDate } };
    }

    // Agregar filtro de caja si se especifica
    if (cashRegister) {
      where.cashRegister = cashRegister;
    }

    // Excluir ventas canceladas (Req 8.1)
    where.status = { not: "Cancelada" };

    const sales = await prisma.sale.findMany({
      where,
      include: {
        details: {
          include: {
            product: {
              include: {
                category: true
              }
            }
          }
        }
      }
    });

    // Agrupar por categoría usando cantidad neta y subtotal neto por renglón.
    // netSubTotal = subTotal * ((quantity - returnedQuantity)/quantity) (Req 8.5)
    const categoryMap = new Map();
    sales.forEach(sale => {
      sale.details.forEach(detail => {
        const categoryName = detail.product?.category?.name || 'Sin categoría';
        const quantity = detail.quantity || 0;
        const netQuantity = quantity - (detail.returnedQuantity || 0);
        const netSubTotal = quantity > 0 ? detail.subTotal * (netQuantity / quantity) : 0;
        const current = categoryMap.get(categoryName) || { categoryName, total: 0, quantity: 0 };
        current.total += netSubTotal;
        current.quantity += netQuantity;
        categoryMap.set(categoryName, current);
      });
    });

    const result = Array.from(categoryMap.values()).sort((a, b) => b.total - a.total);
    res.json(result);
  } catch (error) {
    console.error("Error al obtener ventas por categoría:", error);
    res.status(500).json({ error: 'Error al obtener ventas por categoría' });
  }
};

// Ventas por departamento (agrupa las categorías de cada departamento)
export const getSalesByDepartment = async (req, res) => {
  try {
    const { range, start, end, cashRegister } = req.query;
    let where = {};
    const now = new Date();

    if (range === "day") {
      const startDay = new Date();
      startDay.setHours(0, 0, 0, 0);
      const endDay = new Date();
      endDay.setHours(23, 59, 59, 999);
      where = { createdAt: { gte: startDay, lte: endDay } };
    } else if (range === "week") {
      const startWeek = new Date();
      startWeek.setDate(now.getDate() - 7);
      where = { createdAt: { gte: startWeek } };
    } else if (range === "month") {
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      where = { createdAt: { gte: startMonth } };
    } else if (start && end) {
      // Formato esperado: YYYY-MM-DD
      const startDate = new Date(`${start}T00:00:00.000`);
      const endDate = new Date(`${end}T23:59:59.999`);
      where = { createdAt: { gte: startDate, lte: endDate } };
    }

    if (cashRegister) {
      where.cashRegister = cashRegister;
    }

    // Excluir ventas canceladas (Req 8.2)
    where.status = { not: "Cancelada" };

    const sales = await prisma.sale.findMany({
      where,
      include: {
        details: {
          include: {
            product: {
              include: {
                category: {
                  include: { department: true },
                },
              },
            },
          },
        },
      },
    });

    // Agrupar por departamento (usando la categoría del producto).
    // Los productos cuya categoría no tiene departamento caen en "Sin departamento".
    const deptMap = new Map();
    let granTotal = 0;

    sales.forEach((sale) => {
      sale.details.forEach((detail) => {
        const dept = detail.product?.category?.department;
        const key = dept?.id || "__none__";
        const name = dept?.name || "Sin departamento";
        const icon = dept?.icon || null;

        // Cantidad neta y subtotal neto por renglón (Req 8.5)
        const quantity = detail.quantity || 0;
        const netQuantity = quantity - (detail.returnedQuantity || 0);
        const netSubTotal = quantity > 0 ? detail.subTotal * (netQuantity / quantity) : 0;

        const current =
          deptMap.get(key) || {
            departmentId: dept?.id || null,
            departmentName: name,
            icon,
            total: 0,
            quantity: 0,
            items: 0,
          };
        current.total += netSubTotal;
        current.quantity += netQuantity;
        current.items += 1;
        deptMap.set(key, current);

        granTotal += netSubTotal;
      });
    });

    // Calcular porcentaje de participación de cada departamento sobre el total.
    const result = Array.from(deptMap.values())
      .map((d) => ({
        ...d,
        percentage: granTotal > 0 ? (d.total / granTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    res.json({ total: granTotal, departments: result });
  } catch (error) {
    console.error("Error al obtener ventas por departamento:", error);
    res.status(500).json({ error: "Error al obtener ventas por departamento" });
  }
};

// Ventas por cliente
export const getSalesByClient = async (req, res) => {
  try {
    const { range, start, end, cashRegister } = req.query;
    let where = {};
    const now = new Date();
  
    if (range === "day") {
      const startDay = new Date();
      startDay.setHours(0, 0, 0, 0);
      const endDay = new Date();
      endDay.setHours(23, 59, 59, 999);
      where = { createdAt: { gte: startDay, lte: endDay } };
    } else if (range === "week") {
      const startWeek = new Date();
      startWeek.setDate(now.getDate() - 7);
      where = { createdAt: { gte: startWeek } };
    } else if (range === "month") {
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      where = { createdAt: { gte: startMonth } };
    } else if (start && end) {
      // Ajustar el rango completo del día para fechas personalizadas
      // Formato esperado: YYYY-MM-DD
      const startDate = new Date(`${start}T00:00:00.000`);
      const endDate = new Date(`${end}T23:59:59.999`);
      where = { createdAt: { gte: startDate, lte: endDate } };
    }

    // Agregar filtro de caja si se especifica
    if (cashRegister) {
      where.cashRegister = cashRegister;
    }

    // Excluir ventas canceladas por coherencia del ingreso neto (Req 8.6)
    where.status = { not: "Cancelada" };

    const salesByClient = await prisma.sale.groupBy({
      by: ['clientName'],
      _sum: { total: true },
      _count: { id: true },
      where,
      orderBy: { _sum: { total: 'desc' } },
      take: 20
    });

    const result = salesByClient.map(item => ({
      clientName: item.clientName || 'Público en General',
      total: item._sum.total || 0,
      count: item._count.id || 0
    }));

    res.json(result);
  } catch (error) {
    console.error("Error al obtener ventas por cliente:", error);
    res.status(500).json({ error: 'Error al obtener ventas por cliente' });
  }
};