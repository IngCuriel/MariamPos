import prisma from "../utils/prisma.js";

// ============================================================
// 📌 OBTENER TODOS LOS PROVEEDORES
// ============================================================
export const getSuppliers = async (req, res) => {
  try {
    const { search = "", status } = req.query;

    const where = {};
    
    if (search && search.length > 0) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { contactName: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ];
    }

    if (status !== undefined) {
      where.status = parseInt(status, 10);
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            purchases: true,
            accountsPayable: true,
          },
        },
      },
    });

    res.json(suppliers);
  } catch (error) {
    console.error("Error getSuppliers:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ============================================================
// 📌 OBTENER PROVEEDOR POR ID
// ============================================================
export const getSupplierById = async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await prisma.supplier.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        purchases: {
          orderBy: { purchaseDate: "desc" },
          take: 10,
        },
        accountsPayable: {
          where: { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
          orderBy: { dueDate: "asc" },
        },
      },
    });

    if (!supplier) {
      return res.status(404).json({ error: "Proveedor no encontrado" });
    }

    res.json(supplier);
  } catch (error) {
    console.error("Error getSupplierById:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ============================================================
// 📌 CREAR PROVEEDOR
// ============================================================
export const createSupplier = async (req, res) => {
  try {
    const {
      name,
      code,
      contactName,
      phone,
      email,
      address,
      rfc,
      taxId,
      notes,
      status = 1,
    } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: "El nombre del proveedor es requerido" });
    }

    // Verificar si el código ya existe (si se proporciona)
    if (code) {
      const existingSupplier = await prisma.supplier.findUnique({
        where: { code },
      });
      if (existingSupplier) {
        return res.status(400).json({ error: "El código del proveedor ya existe" });
      }
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim(),
        code: code?.trim() || null,
        contactName: contactName?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        rfc: rfc?.trim() || null,
        taxId: taxId?.trim() || null,
        notes: notes?.trim() || null,
        status: status || 1,
      },
    });

    res.status(201).json(supplier);
  } catch (error) {
    console.error("Error createSupplier:", error);
    if (error.code === "P2002") {
      return res.status(400).json({ error: "El código del proveedor ya existe" });
    }
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ============================================================
// 📌 ACTUALIZAR PROVEEDOR
// ============================================================
export const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      code,
      contactName,
      phone,
      email,
      address,
      rfc,
      taxId,
      notes,
      status,
    } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: "El nombre del proveedor es requerido" });
    }

    // Verificar si el código ya existe en otro proveedor (si se proporciona)
    if (code) {
      const existingSupplier = await prisma.supplier.findUnique({
        where: { code },
      });
      if (existingSupplier && existingSupplier.id !== parseInt(id, 10)) {
        return res.status(400).json({ error: "El código del proveedor ya existe" });
      }
    }

    const supplier = await prisma.supplier.update({
      where: { id: parseInt(id, 10) },
      data: {
        name: name.trim(),
        code: code?.trim() || null,
        contactName: contactName?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        rfc: rfc?.trim() || null,
        taxId: taxId?.trim() || null,
        notes: notes?.trim() || null,
        status: status !== undefined ? status : undefined,
      },
    });

    res.json(supplier);
  } catch (error) {
    console.error("Error updateSupplier:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Proveedor no encontrado" });
    }
    if (error.code === "P2002") {
      return res.status(400).json({ error: "El código del proveedor ya existe" });
    }
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ============================================================
// 📌 ELIMINAR PROVEEDOR
// ============================================================
export const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si tiene compras o cuentas por pagar
    const supplier = await prisma.supplier.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        _count: {
          select: {
            purchases: true,
            accountsPayable: true,
          },
        },
      },
    });

    if (!supplier) {
      return res.status(404).json({ error: "Proveedor no encontrado" });
    }

    if (supplier._count.purchases > 0 || supplier._count.accountsPayable > 0) {
      return res.status(400).json({
        error: "No se puede eliminar el proveedor porque tiene compras o cuentas por pagar asociadas",
      });
    }

    await prisma.supplier.delete({
      where: { id: parseInt(id, 10) },
    });

    res.json({ message: "Proveedor eliminado correctamente" });
  } catch (error) {
    console.error("Error deleteSupplier:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Proveedor no encontrado" });
    }
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

