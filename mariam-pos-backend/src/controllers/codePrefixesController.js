import prisma from "../utils/prisma.js";

// Formatea el número consecutivo con el prefijo y el padding.
// Ej: buildCode("ABA-REF", 14, 3) => "ABA-REF-014"
export const buildCode = (prefix, number, padding = 3) => {
  const num = String(number).padStart(padding, "0");
  return `${prefix}-${num}`;
};

// Normaliza el prefijo: mayúsculas, sin espacios, solo letras/números/guiones.
const normalizePrefix = (raw) => {
  return (raw || "")
    .toString()
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-]/g, "");
};

// Listar todos los prefijos (con su categoría y departamento).
export const getCodePrefixes = async (req, res) => {
  try {
    const prefixes = await prisma.categoryCodePrefix.findMany({
      include: {
        category: {
          include: { department: true },
        },
      },
      orderBy: { prefix: "asc" },
    });
    res.json(prefixes);
  } catch (error) {
    console.error("Error al obtener prefijos de código:", error);
    res.status(500).json({ error: "Error al obtener prefijos de código" });
  }
};

// Obtener el prefijo de una categoría (o null si no tiene).
export const getPrefixByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const prefix = await prisma.categoryCodePrefix.findUnique({
      where: { categoryId },
      include: { category: { include: { department: true } } },
    });
    res.json(prefix || null);
  } catch (error) {
    console.error("Error al obtener prefijo de la categoría:", error);
    res.status(500).json({ error: "Error al obtener prefijo de la categoría" });
  }
};

// Preview del siguiente código SIN reservar el consecutivo.
// Devuelve { hasPrefix, prefix, nextNumber, code }.
export const previewNextCode = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const prefix = await prisma.categoryCodePrefix.findUnique({
      where: { categoryId },
    });

    if (!prefix) {
      return res.json({ hasPrefix: false, prefix: null, nextNumber: null, code: null });
    }

    const nextNumber = prefix.lastNumber + 1;
    res.json({
      hasPrefix: true,
      prefix: prefix.prefix,
      nextNumber,
      code: buildCode(prefix.prefix, nextNumber, prefix.padding),
    });
  } catch (error) {
    console.error("Error al generar preview del código:", error);
    res.status(500).json({ error: "Error al generar preview del código" });
  }
};

// Sugerir un prefijo a partir del departamento y la categoría.
// Ej: depto "Abarrotes" + categoría "Refrescos" => "ABA-REF".
export const suggestPrefix = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: { department: true },
    });

    if (!category) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }

    const takeN = (s, n) =>
      (s || "")
        .toString()
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, n);

    const deptPart = category.department ? takeN(category.department.name, 3) : "";

    // Traer todos los prefijos existentes para evitar sugerir uno duplicado.
    const all = await prisma.categoryCodePrefix.findMany({ select: { prefix: true } });
    const used = new Set(all.map((p) => p.prefix));

    const buildSuggestion = (catLen) => {
      const catPart = takeN(category.name, catLen);
      return [deptPart, catPart].filter(Boolean).join("-");
    };

    // 1) Intentar con 3 letras de la categoría. Ej: PAP-CUA
    let suggested = buildSuggestion(3);

    // 2) Si ya existe (ej: "Cuadernos" y "Cuartos" comparten CUA),
    //    intentar con 4 letras para diferenciar. Ej: PAP-CUAD / PAP-CUAR
    if (used.has(suggested)) {
      const four = buildSuggestion(4);
      if (!used.has(four)) {
        suggested = four;
      } else {
        // 3) Si aún choca, agregar sufijo numérico incremental. Ej: PAP-CUA2
        let i = 2;
        let candidate = `${buildSuggestion(3)}${i}`;
        while (used.has(candidate)) {
          i += 1;
          candidate = `${buildSuggestion(3)}${i}`;
        }
        suggested = candidate;
      }
    }

    res.json({ suggested });
  } catch (error) {
    console.error("Error al sugerir prefijo:", error);
    res.status(500).json({ error: "Error al sugerir prefijo" });
  }
};

// Crear un prefijo para una categoría (1:1).
export const createCodePrefix = async (req, res) => {
  try {
    const { categoryId, prefix, padding, lastNumber, branch } = req.body;

    if (!categoryId) {
      return res.status(400).json({ error: "La categoría es obligatoria" });
    }
    const cleanPrefix = normalizePrefix(prefix);
    if (!cleanPrefix) {
      return res.status(400).json({ error: "El prefijo es obligatorio" });
    }

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }

    const existing = await prisma.categoryCodePrefix.findUnique({ where: { categoryId } });
    if (existing) {
      return res.status(400).json({ error: "Esta categoría ya tiene un prefijo asignado" });
    }

    // El texto del prefijo debe ser único: dos prefijos iguales generarían códigos duplicados.
    const duplicated = await prisma.categoryCodePrefix.findFirst({
      where: { prefix: cleanPrefix },
      include: { category: true },
    });
    if (duplicated) {
      return res.status(400).json({
        error: `El prefijo "${cleanPrefix}" ya está en uso por la categoría "${duplicated.category?.name || "otra"}". Elige uno diferente (ej: ${cleanPrefix}2).`,
      });
    }

    const created = await prisma.categoryCodePrefix.create({
      data: {
        categoryId,
        prefix: cleanPrefix,
        padding: padding && padding > 0 ? Number(padding) : 3,
        lastNumber: lastNumber && lastNumber > 0 ? Number(lastNumber) : 0,
        branch: branch || "Sucursal Default",
        syncStatus: "pendiente",
      },
      include: { category: { include: { department: true } } },
    });

    res.status(201).json(created);
  } catch (error) {
    console.error("Error al crear prefijo de código:", error);
    res.status(500).json({ error: "Error al crear prefijo de código" });
  }
};

// Actualizar un prefijo (prefijo, padding, lastNumber).
export const updateCodePrefix = async (req, res) => {
  try {
    const { id } = req.params;
    const { prefix, padding, lastNumber, branch } = req.body;

    const existing = await prisma.categoryCodePrefix.findUnique({
      where: { id: Number(id) },
    });
    if (!existing) {
      return res.status(404).json({ error: "Prefijo no encontrado" });
    }

    const cleanPrefix = prefix !== undefined ? normalizePrefix(prefix) : existing.prefix;
    if (!cleanPrefix) {
      return res.status(400).json({ error: "El prefijo es obligatorio" });
    }

    // El texto del prefijo debe ser único (excluyendo el propio registro).
    const duplicated = await prisma.categoryCodePrefix.findFirst({
      where: { prefix: cleanPrefix, id: { not: Number(id) } },
      include: { category: true },
    });
    if (duplicated) {
      return res.status(400).json({
        error: `El prefijo "${cleanPrefix}" ya está en uso por la categoría "${duplicated.category?.name || "otra"}". Elige uno diferente.`,
      });
    }

    const updated = await prisma.categoryCodePrefix.update({
      where: { id: Number(id) },
      data: {
        prefix: cleanPrefix,
        padding: padding !== undefined && padding > 0 ? Number(padding) : existing.padding,
        lastNumber: lastNumber !== undefined && lastNumber >= 0 ? Number(lastNumber) : existing.lastNumber,
        branch: branch || existing.branch || "Sucursal Default",
        syncStatus: "pendiente",
      },
      include: { category: { include: { department: true } } },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error al actualizar prefijo de código:", error);
    res.status(500).json({ error: "Error al actualizar prefijo de código" });
  }
};

// Eliminar un prefijo.
export const deleteCodePrefix = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.categoryCodePrefix.findUnique({
      where: { id: Number(id) },
    });
    if (!existing) {
      return res.status(404).json({ error: "Prefijo no encontrado" });
    }

    await prisma.categoryCodePrefix.delete({ where: { id: Number(id) } });
    res.json({ message: "Prefijo eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar prefijo de código:", error);
    res.status(500).json({ error: "Error al eliminar prefijo de código" });
  }
};
