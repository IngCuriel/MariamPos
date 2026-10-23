import prisma from "../utils/prisma.js";

// Estados válidos de una venta pendiente (máquina de estados de dos estados).
export const PENDING_SALE_STATUSES = ["PENDING", "PAID"];

// Validación centralizada del estado de venta pendiente.
// Lanza un error con statusCode 400 cuando el valor no pertenece al conjunto válido.
export function assertValidStatus(status) {
  if (!PENDING_SALE_STATUSES.includes(status)) {
    const err = new Error(`Estado de venta pendiente inválido: ${status}`);
    err.statusCode = 400;
    throw err;
  }
}

// Generar código único para venta pendiente
const generatePendingSaleCode = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `PEND-${timestamp}-${random}`;
};

// Obtener todas las ventas pendientes
//
// Query params opcionales:
//   - cashRegister: filtra por Caja_Origen (Req 8.2).
//   - status: filtra por Estado_Venta_Pendiente "PENDING" | "PAID" (Req 8.3),
//     validado con assertValidStatus (400 si es inválido).
//
// Cada registro devuelto expone status, cashRegister, branch, createdBy, paidAt,
// paidSaleId, paidCashRegister y paidBy (Req 8.1). Estos campos provienen del
// modelo Prisma por defecto: no se usa `select`, por lo que todas las columnas
// del modelo quedan presentes en la respuesta.
//
// Reconciliación del filtro de Caja_Origen (Req 8.2 vs 8.4 y Property 11):
//   El filtro por cashRegister se aplica SOLO cuando llega un valor no vacío.
//   Cuando está ausente/vacío no se filtra por caja y se devuelven los folios de
//   todas las cajas. Esto satisface el Req 8.4: la vista de carga de la
//   Caja_Principal consulta getPendingSales({ status: "PENDING" }) sin
//   cashRegister y DEBE recibir todos los folios PENDING para poder cobrarlos.
//   La garantía de "no folios de otras cajas" de la Vista_Mis_Folios (Req 7.3,
//   Property 11) se cumple del lado cliente: esa vista nunca consulta sin una
//   caja (cuando no hay caja, no llama a la API — tarea 11.1).
export const getPendingSales = async (req, res) => {
  try {
    const { cashRegister, status, startDate, endDate } = req.query;

    const where = {};

    // Filtra por Caja_Origen solo cuando se recibe un valor no vacío (Req 8.2).
    if (cashRegister) {
      where.cashRegister = cashRegister;
    }

    // Filtra por estado solo cuando se recibe; valida el conjunto permitido (Req 8.3).
    if (status) {
      assertValidStatus(status);
      where.status = status;
    }

    // Filtro opcional por rango de fechas (formato YYYY-MM-DD). Para folios PAID
    // se filtra por la fecha de cobro (paidAt); en el resto, por la de creación
    // (createdAt). Mismo patrón de rango de día usado en el resto del backend.
    if (startDate || endDate) {
      const dateField = status === "PAID" ? "paidAt" : "createdAt";
      where[dateField] = {};
      if (startDate) {
        where[dateField].gte = new Date(`${startDate}T00:00:00.000`);
      }
      if (endDate) {
        where[dateField].lte = new Date(`${endDate}T23:59:59.999`);
      }
    }

    const pendingSales = await prisma.pendingSale.findMany({
      where,
      orderBy: status === "PAID" ? { paidAt: "desc" } : { createdAt: "desc" },
      include: {
        details: {
          include: {
            product: {
              include: {
                category: true,
                unit: true,
                presentations: true,
              },
            },
          },
        },
      },
    });
    res.json(pendingSales);
  } catch (error) {
    // assertValidStatus marca los estados inválidos con statusCode 400 (Req 8.3/1.4).
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
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
                unit: true,
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
    const { clientName, total, branch, cashRegister, createdBy, details } =
      req.body;

    if (!details || details.length === 0) {
      return res
        .status(400)
        .json({ error: "Debe incluir al menos un detalle de venta" });
    }

    // Código temporal único para no violar la restricción unique al crear.
    const tempCode = generatePendingSaleCode();

    const created = await prisma.pendingSale.create({
      data: {
        code: tempCode,
        clientName: clientName || null,
        total,
        branch: branch || "Sucursal Default",
        cashRegister: cashRegister || "Caja 1",
        // Estado inicial de la máquina de estados (Req 1.2).
        status: "PENDING",
        // Trazabilidad de creación (Req 5.1). createdBy es opcional: null cuando se omite.
        createdBy: createdBy || null,
        // paidAt, paidSaleId, paidCashRegister y paidBy se omiten a propósito:
        // deben quedar nulos mientras el folio esté PENDING (Req 5.3).
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
    });

    // Folio legible y correlativo para el cliente: PP-1000, PP-1001, …
    // (PP = Pago Pendiente). Basado en el id autoincremental → único, sin colisiones
    // aunque varios cajeros guarden a la vez.
    const friendlyCode = `PP-${1000 + created.id}`;

    const pendingSale = await prisma.pendingSale.update({
      where: { id: created.id },
      data: { code: friendlyCode },
      include: {
        details: {
          include: {
            product: {
              include: {
                category: true,
                unit: true,
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

// Marcar una venta pendiente como PAGADA de forma atómica.
//
// Función reutilizable (Req 1.3, 4.1, 4.2, 4.3). El flujo normal de cobro la
// invoca desde salesController.createSales dentro de una transacción, pasando el
// cliente transaccional `tx`; también puede llamarse de forma autónoma (p. ej.
// desde el endpoint PATCH /pending-sales/:id/pay) sin `tx`.
//
// Escribe en una única operación: status = "PAID", paidSaleId, paidAt,
// paidCashRegister y paidBy.
//
// Errores (expresados con la propiedad statusCode para que el route handler los
// mapee a códigos HTTP):
//   - 404 si el folio no existe ("Venta pendiente no encontrada").
//   - 409 si el folio ya está PAID ("El folio ya fue cobrado") — idempotencia
//     defensiva que evita el doble cobro.
export const markPendingSalePaid = async (
  id,
  { saleId, paidCashRegister, paidBy },
  tx
) => {
  // Usa el cliente transaccional cuando se recibe; si no, el cliente Prisma normal.
  const db = tx || prisma;
  const pendingSaleId = parseInt(id);

  const existing = await db.pendingSale.findUnique({
    where: { id: pendingSaleId },
  });

  if (!existing) {
    const err = new Error("Venta pendiente no encontrada");
    err.statusCode = 404;
    throw err;
  }

  if (existing.status === "PAID") {
    const err = new Error("El folio ya fue cobrado");
    err.statusCode = 409;
    throw err;
  }

  // Transición PENDING -> PAID con la trazabilidad de cobro escrita de forma
  // atómica en un solo update (Req 4.3).
  return db.pendingSale.update({
    where: { id: pendingSaleId },
    data: {
      status: "PAID",
      paidSaleId: saleId,
      paidAt: new Date(),
      paidCashRegister: paidCashRegister || null,
      paidBy: paidBy || null,
    },
  });
};

// Marcar una venta pendiente como PAGADA vía endpoint HTTP (PATCH /:id/pay).
//
// Caso de uso: marcado manual/corrección. El flujo normal de cobro usa la
// transacción dentro de salesController.createSales; este handler invoca
// markPendingSalePaid de forma autónoma (sin `tx`).
//
// Lee el id de req.params y { saleId, paidCashRegister, paidBy } de req.body.
// Mapea los errores por su statusCode:
//   - 400 estado/solicitud inválida (assertValidStatus u otros con statusCode 400)
//   - 404 folio inexistente
//   - 409 folio ya cobrado (idempotencia defensiva)
// Cualquier otro error devuelve 500.
export const markPendingSalePaidHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { saleId, paidCashRegister, paidBy } = req.body;

    const pendingSale = await markPendingSalePaid(id, {
      saleId,
      paidCashRegister,
      paidBy,
    });

    res.json(pendingSale);
  } catch (error) {
    // markPendingSalePaid marca los errores esperados con statusCode (404/409);
    // assertValidStatus usa 400. Se respeta el código provisto por la capa inferior.
    if ([400, 404, 409].includes(error.statusCode)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error al marcar venta pendiente como pagada:", error);
    res.status(500).json({ error: "Error al marcar venta pendiente como pagada" });
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
                unit: true,
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

