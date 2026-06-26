import { decryptSecret, encryptSecret } from "@/lib/crypto/token-encryption";

/** Decrypt stored MCP secret env values. */
export function parseStoredMcpSecrets(enc: string | null | undefined): Record<string, string> {
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

export function mergeMcpSecretsEnc(
  existingEnc: string | null | undefined,
  patch: Record<string, string> | null | undefined
): string | null {
  if (patch === undefined) return existingEnc ?? null;
  if (patch === null) return null;

  const current = parseStoredMcpSecrets(existingEnc ?? null);
  const next = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    if (!k.trim()) continue;
    if (!v.trim()) delete next[k];
    else next[k] = v.trim();
  }
  if (Object.keys(next).length === 0) return null;
  return encryptSecret(JSON.stringify(next));
}

/** Collect env var names referenced by headers_env and explicit env keys. */
export function mcpSecretEnvKeys(config: Record<string, unknown>): string[] {
  const keys = new Set<string>();
  const headersEnv = config.headers_env;
  if (headersEnv && typeof headersEnv === "object" && !Array.isArray(headersEnv)) {
    for (const envVar of Object.values(headersEnv as Record<string, unknown>)) {
      if (typeof envVar === "string" && envVar.trim()) keys.add(envVar.trim());
    }
  }
  const env = config.env;
  if (env && typeof env === "object" && !Array.isArray(env)) {
    for (const [k, v] of Object.entries(env as Record<string, unknown>)) {
      if (typeof v === "string" && v.startsWith("$")) keys.add(v.slice(1).trim());
      else if (typeof k === "string" && k.trim()) keys.add(k.trim());
    }
  }
  return Array.from(keys);
}
