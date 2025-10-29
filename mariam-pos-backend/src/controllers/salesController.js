import pkg from "@prisma/client";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

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

    const sale = await prisma.sale.create({
      data: {
        folio,
        status,
        total,
        branch,
        cashRegister,
        paymentMethod,
        clientName,
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
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ message: "Debe proporcionar startDate y endDate" });
    }

    // Ajustar el rango completo del día
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);
    console.log("start", start, "end", end);

    // Validar fechas
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: "Fechas inválidas" });
    }

    const sales = await prisma.sale.findMany({
      where: {
        createdAt: {
          gte: start, // mayor o igual que startDate
          lte: end, // menor o igual que endDate
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        details: {
          include: { product: true }, // Para mostrar info del producto
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
  const { range, start, end } = req.query;
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
    where = { createdAt: { gte: new Date(start), lte: new Date(end) } };
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
    const { range, start, end } = req.query;

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
      where = { createdAt: { gte: new Date(start), lte: new Date(end) } };
    } 
    const dailySales = await prisma.$queryRaw`
      SELECT 
        createdAt as date,
         SUM(total) AS total
      FROM Sale
       WHERE "createdAt" >= ${where.createdAt?.gte || new Date(0)}
        AND "createdAt" <= ${where.createdAt?.lte || new Date()}
      GROUP BY createdAt
      ORDER BY date DESC;
    `;
    console.log('dailySales', dailySales)
    const result = dailySales.reduce((acc, sale) => {
              const dateOnly = new Date(sale.date).toISOString().slice(0, 10); // 'YYYY-MM-DD'
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
    const { range, start, end } = req.query;
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
      where = { createdAt: { gte: new Date(start), lte: new Date(end) } };
    }
    const topProducts = await prisma.saleDetail.groupBy({
      by: ["productName"],
      _sum: { quantity: true },
      where,
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    });
    res.json(topProducts);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener productos más vendidos" });
  }
};


export const getSalesByPaymentMethod = async (req, res) => {
  try {
    const { range, start, end } = req.query;
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
      where = { createdAt: { gte: new Date(start), lte: new Date(end) } };
    }
    const salesByMethod = await prisma.sale.groupBy({
      by: ['paymentMethod'],
      _sum: { total: true },
      where
    });
    res.json(salesByMethod);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener ventas por método de pago' });
  }
};