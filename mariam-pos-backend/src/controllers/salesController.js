import prisma from "../utils/prisma.js";

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
    const { folio, status, total, branch, cashRegister, paymentMethod, clientName, details } =
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
        shiftId, // Asociar venta al turno activo si existe
        details: {
          create: details.map((d) => ({
            productId: d.productId,
            quantity: d.quantity,
            price: d.price,
            productName: d.productName,
            subTotal: d.subTotal,
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

  try {
    const totalVentas = await prisma.sale.count({ where });
    const totalDinero = await prisma.sale.aggregate({
      _sum: { total: true },
      where,
    });
    res.json({
      totalVentas,
      totalDinero: totalDinero._sum.total || 0,
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
    
    // Construir la consulta SQL con filtros
    const startDate = where.createdAt?.gte || new Date(0);
    const endDate = where.createdAt?.lte || new Date();
    
    let query;
    if (cashRegister) {
      query = prisma.$queryRaw`
        SELECT 
          createdAt as date,
          SUM(total) AS total
        FROM Sale
        WHERE "createdAt" >= ${startDate}
          AND "createdAt" <= ${endDate}
          AND "cashRegister" = ${cashRegister}
        GROUP BY createdAt
        ORDER BY date DESC;
      `;
    } else {
      query = prisma.$queryRaw`
        SELECT 
          createdAt as date,
          SUM(total) AS total
        FROM Sale
        WHERE "createdAt" >= ${startDate}
          AND "createdAt" <= ${endDate}
        GROUP BY createdAt
        ORDER BY date DESC;
      `;
    }
    
    const dailySales = await query;
    console.log('dailySales', dailySales)
    const result = dailySales.reduce((acc, sale) => {
              const dateOnly = new Date(sale.date).toLocaleDateString('en-CA'); // 'YYYY-MM-DD'
              const existing = acc.find(r => r.date === dateOnly);
              if (existing) {
                existing.total += sale.total;
              } else {
                acc.push({ date: dateOnly, total: sale.total });
              }
              return acc;
            }, []);
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
    
    // Agregar filtro de caja si se especifica
    if (cashRegister) {
      detailWhere.sale = {
        cashRegister: cashRegister
      };
    }
    
    // Obtener todos los detalles de venta
    const allDetails = await prisma.saleDetail.findMany({
      where: detailWhere,
      select: {
        productName: true,
        quantity: true,
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
      
      if (productMap.has(normalizedName)) {
        productMap.set(normalizedName, productMap.get(normalizedName) + detail.quantity);
      } else {
        productMap.set(normalizedName, detail.quantity);
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

    // Agrupar por categoría
    const categoryMap = new Map();
    sales.forEach(sale => {
      sale.details.forEach(detail => {
        const categoryName = detail.product?.category?.name || 'Sin categoría';
        const current = categoryMap.get(categoryName) || { categoryName, total: 0, quantity: 0 };
        current.total += detail.subTotal;
        current.quantity += detail.quantity;
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