import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

function key() {
  const secret = process.env.APP_DATA_KEY || "";
  if (secret.length < 16) throw new Error("APP_DATA_KEY is missing.");
  return scryptSync(secret, "nk-manpower", 32);
}

export function last4(value) {
  const text = String(value ?? "").replace(/\s/g, "");
  if (text.length < 4) return "";
  return text.slice(-4);
}

export function encryptText(plain) {
  const text = String(plain ?? "").trim();
  if (!text) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, body]);
}

export function decryptText(packed) {
  if (!packed) return "";
  const buffer = Buffer.isBuffer(packed) ? packed : Buffer.from(packed);
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const body = buffer.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}
