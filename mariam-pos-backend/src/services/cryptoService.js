// src/services/cryptoService.js (ESM)
import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function getKey() {
  const raw = process.env.ONLINE_STORE_CRYPTO_KEY;
  if (!raw || raw.trim() === "") {
    const err = new Error(
      "ONLINE_STORE_CRYPTO_KEY no está definida: no es posible cifrar ni descifrar credenciales de tienda online."
    );
    err.statusCode = 500;
    throw err;
  }
  // Deriva 32 bytes para AES-256 de forma determinista.
  return crypto.createHash("sha256").update(raw).digest();
}

// encrypt(plain) -> "iv:authTag:data" (Req 2.1)
export function encrypt(plain) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const data = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), data.toString("base64")].join(":");
}

// decrypt(cipherText) -> plain (Req 2.2); lanza si el formato o la clave son inválidos (Req 2.4)
export function decrypt(cipherText) {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = String(cipherText).split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    const err = new Error("Formato de credencial cifrada inválido.");
    err.statusCode = 500;
    throw err;
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const out = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return out.toString("utf8");
}
