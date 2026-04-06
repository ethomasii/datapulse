import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const AUTH_TAG_LEN = 16;

function key32(): Buffer {
  const b64 = process.env.DATAPULSE_TOKEN_ENCRYPTION_KEY;
  if (!b64) {
    throw new Error("DATAPULSE_TOKEN_ENCRYPTION_KEY is not set (32-byte key, base64-encoded)");
  }
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) {
    throw new Error("DATAPULSE_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return k;
}

/** Encrypt OAuth tokens and other secrets at rest (AES-256-GCM). */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key32(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(payloadB64: string): string {
  const buf = Buffer.from(payloadB64, "base64");
  if (buf.length < IV_LEN + AUTH_TAG_LEN + 1) {
    throw new Error("Invalid encrypted payload");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
  const enc = buf.subarray(IV_LEN + AUTH_TAG_LEN);
  const decipher = createDecipheriv(ALGO, key32(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
