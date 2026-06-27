/**
 * MotherDuck Postgres wire endpoint — recommended for Vercel/serverless (no native duckdb).
 * @see https://motherduck.com/docs/key-tasks/authenticating-and-connecting-to-motherduck/postgres-endpoint/nodejs/
 * @see https://motherduck.com/docs/integrations/web-development/vercel/
 */

import type { ClientConfig, QueryResult } from "pg";
import type { WarehouseQueryRowset } from "@/lib/elt/warehouse-introspect-connectors";

export const MOTHERDUCK_POSTGRES_DEFAULT_HOST = "pg.us-east-1-aws.motherduck.com";

const CONNECT_TIMEOUT_MS = 12_000;
const QUERY_TIMEOUT_MS = 20_000;

function secret(secrets: Record<string, string> | undefined, ...keys: string[]): string {
  if (!secrets) return "";
  for (const k of keys) {
    const v = secrets[k]?.trim();
    if (v) return v;
  }
  return "";
}

/** Postgres endpoint host (region-specific on Vercel integration). */
export function motherduckPostgresHost(secrets?: Record<string, string>): string {
  return (
    process.env.MOTHERDUCK_HOST?.trim() ||
    secret(secrets, "MOTHERDUCK_HOST", "MOTHERDUCK_POSTGRES_HOST") ||
    MOTHERDUCK_POSTGRES_DEFAULT_HOST
  );
}

/** pg.Client config — use object form so SSL is verify-full without sslrootcert file paths. */
export function buildMotherduckPostgresClientConfig(
  token: string,
  database: string,
  secrets?: Record<string, string>
): ClientConfig {
  const db = database.trim() || "md:";
  if (!token.trim()) {
    throw new Error("Set MOTHERDUCK_TOKEN to query MotherDuck.");
  }
  return {
    host: motherduckPostgresHost(secrets),
    port: 5432,
    user: "postgres",
    password: token.trim(),
    database: db,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
  };
}

export function pgResultToRowset(result: QueryResult): WarehouseQueryRowset {
  const columns = result.fields.map((field) => field.name);
  if (!columns.length) {
    return { columns: [], rows: [] };
  }
  const rows = result.rows.map((row) =>
    columns.map((col) => {
      const value = (row as Record<string, unknown>)[col];
      return value === undefined ? null : value;
    })
  );
  return { columns, rows };
}

/** Run read-only DuckDB SQL against a MotherDuck database via the Postgres endpoint. */
export async function runMotherduckPostgresQuery(
  token: string,
  database: string,
  sql: string,
  secrets?: Record<string, string>
): Promise<WarehouseQueryRowset> {
  const { Client } = await import("pg");
  const client = new Client(buildMotherduckPostgresClientConfig(token, database, secrets));
  try {
    await client.connect();
    const result = await client.query(sql);
    return pgResultToRowset(result);
  } finally {
    await client.end().catch(() => undefined);
  }
}
