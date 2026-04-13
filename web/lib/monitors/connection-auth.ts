import type { Connection } from "@prisma/client";

function asConfigRecord(config: unknown): Record<string, string> {
  if (!config || typeof config !== "object" || Array.isArray(config)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(config as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v;
    else if (typeof v === "number" || typeof v === "boolean") out[k] = String(v);
  }
  return out;
}

/**
 * Non-secret hints from Connection.config merged into the process environment
 * so boto / GCP / Azure default chains see region, project, account, etc.
 * Secrets remain in your deployment or in ~/.eltpulse/auth.json under auth_credentials.
 */
export function connectionConfigToProcessEnv(conn: Pick<Connection, "connector" | "config">): Record<string, string> {
  const cfg = asConfigRecord(conn.config);
  const out: Record<string, string> = {};
  const connector = conn.connector.toLowerCase();

  if (connector === "s3" || connector === "aws") {
    if (cfg.region) out.AWS_DEFAULT_REGION = cfg.region;
  }
  if (connector === "gcs") {
    if (cfg.project) out.GOOGLE_CLOUD_PROJECT = cfg.project;
  }
  if (connector === "azure_blob" || connector === "adls" || connector === "azure") {
    if (cfg.account_name) out.AZURE_STORAGE_ACCOUNT = cfg.account_name;
  }
  return out;
}

/** Optional profile name stored in connection JSON for Python auth_manager (~/.eltpulse/auth.json). */
export function credentialProfileFromConnection(conn: Pick<Connection, "name" | "config">): string {
  const cfg = asConfigRecord(conn.config);
  const explicit = cfg.credential_profile?.trim();
  if (explicit) return explicit;
  return conn.name.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_|_$/g, "") || "default";
}
