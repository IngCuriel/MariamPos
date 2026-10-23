// src/controllers/onlineStoreConfigController.js (ESM)
// API_Config_Tienda: configuración de tienda online por sucursal.
import prisma from "../utils/prisma.js";
import { encrypt, decrypt } from "../services/cryptoService.js";

// Campos no sensibles que SÍ se devuelven al frontend (Req 3.1).
// La contraseña NUNCA se incluye: se expone solo su presencia vía hasPassword.
export const PUBLIC_FIELDS = [
  "branch",
  "enabled",
  "apiUrl",
  "storeName",
  "username",
  "productsEndpoint",
  "salesEndpoint",
  "createdAt",
  "updatedAt",
];

/**
 * Proyecta un registro de OnlineStoreConfig a su forma pública:
 * copia solo PUBLIC_FIELDS y agrega hasPassword. Nunca incluye la
 * contraseña en claro (Req 2.5, 3.2).
 */
export function toPublicConfig(record) {
  const out = {};
  for (const f of PUBLIC_FIELDS) out[f] = record[f];
  out.hasPassword = Boolean(record.password);
  return out;
}

/**
 * GET /online-store-config/:branch  (o ?branch=)
 * Devuelve la configuración de la sucursal con la contraseña enmascarada.
 * Req 2.5, 3.1, 3.2, 3.3, 3.4.
 */
export async function getOnlineStoreConfig(req, res) {
  const branch = req.params.branch ?? req.query.branch;
  if (!branch) {
    return res.status(400).json({ error: "El parámetro 'branch' es obligatorio." });
  }

  const record = await prisma.onlineStoreConfig.findUnique({ where: { branch } });
  if (!record) {
    // Ausencia de configuración, estructura clara (Req 3.3).
    return res.status(404).json({
      exists: false,
      branch,
      message: "Sin configuración para la sucursal.",
    });
  }

  // Req 3.1 (campos no sensibles), 3.4 (solo la sucursal solicitada).
  return res.json({ exists: true, ...toPublicConfig(record) });
}

/**
 * PUT/POST /online-store-config  (upsert por branch)
 * Crea la configuración si la sucursal no existía, o la actualiza si ya existía.
 * La contraseña es write-only: se cifra cuando viene y se conserva la previa
 * cuando no se envía. La contraseña nunca se devuelve en claro.
 * Req 1.2, 1.3, 4.1, 4.2, 4.3, 4.4, 4.5.
 */
export async function upsertOnlineStoreConfig(req, res) {
  const {
    branch,
    enabled,
    apiUrl,
    storeName,
    username,
    password,
    productsEndpoint,
    salesEndpoint,
  } = req.body ?? {};

  if (!branch) {
    // Req 4.5.
    return res.status(400).json({ error: "El campo 'branch' es obligatorio." });
  }

  const data = {
    enabled: typeof enabled === "boolean" ? enabled : undefined,
    apiUrl,
    storeName,
    username,
    productsEndpoint,
    salesEndpoint,
  };

  // Password write-only: cifrar si viene no vacía (Req 4.3); si no viene,
  // data.password queda undefined y Prisma NO modifica la columna en update,
  // conservando la Password_Cifrada previa (Req 4.4).
  if (password !== undefined && password !== null && String(password) !== "") {
    data.password = encrypt(password);
  }

  const record = await prisma.onlineStoreConfig.upsert({
    where: { branch }, // Req 1.2 (clave única)
    update: data, // Req 4.2
    create: { branch, ...data }, // Req 4.1 (enabled -> default false por el esquema, Req 1.3)
  });

  // Nunca la contraseña en claro (Req 2.5).
  return res.json({ exists: true, ...toPublicConfig(record) });
}

/**
 * Helper INTERNO (no expuesto en rutas): entrega la Config_Tienda_Online de una
 * sucursal con la contraseña descifrada en claro. Es el único punto donde la
 * Password_Cifrada vuelve a claro, y ocurre dentro del proceso backend para uso
 * interno del Sistema; nunca se enruta ni se devuelve al frontend.
 *
 * - Si no existe configuración para la sucursal, devuelve `null`.
 * - Si existe, devuelve el registro con `password` descifrada (o `null` si no hay).
 *
 * Req 2.2.
 */
export async function getDecryptedConfig(branch) {
  const record = await prisma.onlineStoreConfig.findUnique({ where: { branch } });
  if (!record) return null;
  return {
    ...record,
    password: record.password ? decrypt(record.password) : null,
  };
}
