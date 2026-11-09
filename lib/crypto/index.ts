import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const SECRET_KEY = process.env.APP_DATA_KEY || "1a000afbc3a90a5113471920cee674166ebc4d052c69a70d766fb58cef5adae7";

function getBufferKey(): Buffer {
  const hex = Buffer.from(SECRET_KEY, "hex");
  if (hex.length === 32) return hex;
  return Buffer.from(SECRET_KEY.padEnd(32, "0").slice(0, 32), "utf8");
}

export function maskAadhaar(raw?: string | null): string {
  if (!raw) return "";
  const cleaned = raw.replace(/\D/g, "");
  if (cleaned.length < 4) return cleaned;
  return `XXXX-XXXX-${cleaned.slice(-4)}`;
}

export function formatAadhaar(raw?: string | null): string {
  const cleaned = String(raw || "").replace(/\D/g, "");
  if (cleaned.length === 12) return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 8)} ${cleaned.slice(8)}`;
  if (cleaned.length === 4) return `XXXX XXXX ${cleaned}`;
  return String(raw || "").trim();
}

export function getAadhaarLast4(raw?: string | null): string {
  if (!raw) return "";
  const cleaned = raw.replace(/\D/g, "");
  return cleaned.slice(-4);
}

export function hashAadhaar(raw?: string | null): string {
  if (!raw) return "";
  const cleaned = raw.replace(/\D/g, "");
  return createHmac("sha256", getBufferKey()).update(cleaned).digest("hex");
}

export function encryptText(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getBufferKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptText(cipherText?: string | null): string {
  if (!cipherText) return "";
  const parts = cipherText.split(":");
  if (parts.length !== 3) return "";
  const [ivHex, tagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, getBufferKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
