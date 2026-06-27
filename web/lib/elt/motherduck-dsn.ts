/**
 * MotherDuck connection strings for the DuckDB client (md: DSN).
 * @see https://motherduck.com/docs/key-tasks/authenticating-and-connecting-to-motherduck/
 */

import { STARTER_WAREHOUSE_DEFAULT_DB } from "@/lib/elt/starter-warehouse";

function secret(secrets: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = secrets[k]?.trim();
    if (v) return v;
  }
  return "";
}

function configString(config: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = config[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

export function motherduckToken(secrets: Record<string, string>): string {
  return secret(secrets, "MOTHERDUCK_TOKEN", "DESTINATION__MOTHERDUCK__CREDENTIALS__PASSWORD");
}

export function motherduckDatabaseName(
  secrets: Record<string, string>,
  config: Record<string, unknown>
): string {
  return (
    configString(config, "database") ||
    secret(secrets, "MOTHERDUCK_DATABASE", "DESTINATION__MOTHERDUCK__CREDENTIALS__DATABASE") ||
    STARTER_WAREHOUSE_DEFAULT_DB
  );
}

/** DuckDB `Database()` path for MotherDuck — same shape as the Python client. */
export function buildMotherduckDsn(
  secrets: Record<string, string>,
  config: Record<string, unknown>
): string {
  const token = motherduckToken(secrets);
  if (!token) throw new Error("Set MOTHERDUCK_TOKEN to query MotherDuck.");
  const database = motherduckDatabaseName(secrets, config);
  const params = new URLSearchParams({
    motherduck_token: token,
    saas_mode: "true",
  });
  return `md:${database}?${params.toString()}`;
}
