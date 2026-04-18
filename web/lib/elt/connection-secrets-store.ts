import { decryptSecret, encryptSecret } from "@/lib/crypto/token-encryption";
import { credentialKeysForConnectionSide } from "@/lib/elt/credential-payload";

export function allowedSecretKeysForConnection(
  connectionType: "source" | "destination",
  connector: string
): Set<string> {
  return new Set(credentialKeysForConnectionSide(connectionType, connector));
}

/** Decrypt stored JSON object of env-style secrets; returns {} if missing or invalid. */
export function parseStoredConnectionSecrets(enc: string | null | undefined): Record<string, string> {
  if (!enc || !enc.trim()) return {};
  try {
    const raw = decryptSecret(enc);
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object" || Array.isArray(o)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (typeof v === "string" && v.length) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * @param existingEnc current DB ciphertext or null
 * @param patch `undefined` = leave unchanged; `null` = clear all; object = merge (empty string removes key)
 */
export function mergeConnectionSecretsEnc(
  existingEnc: string | null | undefined,
  patch: Record<string, string> | null | undefined,
  connectionType: "source" | "destination",
  connector: string
): string | null {
  if (patch === undefined) return existingEnc ?? null;

  const allowed = allowedSecretKeysForConnection(connectionType, connector);

  if (patch === null) {
    return null;
  }

  const current = parseStoredConnectionSecrets(existingEnc ?? null);
  const next = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    if (!allowed.has(k)) continue;
    if (!v.trim()) delete next[k];
    else next[k] = v.trim();
  }
  if (Object.keys(next).length === 0) return null;
  return encryptSecret(JSON.stringify(next));
}
