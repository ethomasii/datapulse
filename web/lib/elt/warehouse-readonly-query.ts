/**
 * Read-only warehouse queries for catalog data preview and AI context.
 * SELECT-only, row-capped, timeout-bounded.
 */

import { parseStoredConnectionSecrets } from "@/lib/elt/connection-secrets-store";
import {
  buildPostgresConnectionString,
  runMotherduckReadOnlyQuery,
  runSnowflakeReadOnlyQuery,
} from "@/lib/elt/warehouse-introspect-connectors";
import type { DestinationConnectionRow } from "@/lib/elt/warehouse-introspect";
import { parseTableRef } from "@/lib/elt/warehouse-column-introspect";

export type ReadOnlyQueryResult = {
  ok: boolean;
  message: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
};

const MAX_ROWS = 25;
const QUERY_TIMEOUT_MS = 15_000;

function asConfig(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

/** Reject non-SELECT statements. */
export function assertReadOnlySql(sql: string): void {
  const stripped = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .trim()
    .toLowerCase();
  if (!stripped.startsWith("select") && !stripped.startsWith("with")) {
    throw new Error("Only SELECT queries are allowed.");
  }
  const forbidden = /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|merge|call)\b/i;
  if (forbidden.test(stripped)) {
    throw new Error("Query contains forbidden keywords.");
  }
}

function rowsToObjects(columns: string[], rawRows: unknown[][]): Record<string, unknown>[] {
  return rawRows.map((row) => {
    const o: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      o[col] = row[i] ?? null;
    });
    return o;
  });
}

async function queryPostgres(connStr: string, sql: string, limit: number): Promise<ReadOnlyQueryResult> {
  const { Client } = await import("pg");
  const client = new Client({ connectionString: connStr, connectionTimeoutMillis: 12_000, query_timeout: QUERY_TIMEOUT_MS });
  await client.connect();
  try {
    const res = await client.query(sql);
    const columns = res.fields.map((f) => f.name);
    const rawRows = res.rows.slice(0, limit).map((r) => columns.map((c) => r[c]));
    return {
      ok: true,
      message: `Returned ${Math.min(res.rows.length, limit)} row(s).`,
      columns,
      rows: res.rows.slice(0, limit) as Record<string, unknown>[],
      rowCount: res.rows.length,
      truncated: res.rows.length > limit,
    };
  } finally {
    await client.end();
  }
}

async function queryBigQuerySample(
  secrets: Record<string, string>,
  config: Record<string, unknown>,
  sql: string,
  limit: number
): Promise<ReadOnlyQueryResult> {
  const projectId =
    secrets.GCP_PROJECT_ID?.trim() ||
    (typeof config.project_id === "string" ? config.project_id.trim() : "");
  const credentials =
    secrets.GCP_CREDENTIALS?.trim() ||
    (typeof config.credentials === "string" ? config.credentials.trim() : "");
  if (!projectId || !credentials) {
    return { ok: false, message: "BigQuery credentials incomplete.", columns: [], rows: [], rowCount: 0, truncated: false };
  }

  const { fetchGcpAccessToken } = await import("@/lib/elt/gcp-access-token");
  const token = await fetchGcpAccessToken(credentials, "https://www.googleapis.com/auth/bigquery.readonly");
  const body = {
    query: sql,
    useLegacySql: false,
    maxResults: limit,
    timeoutMs: QUERY_TIMEOUT_MS,
  };
  const res = await fetch(
    `https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(projectId)}/queries`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(QUERY_TIMEOUT_MS + 5000),
    }
  );
  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    return { ok: false, message: err.error?.message ?? `BigQuery error ${res.status}`, columns: [], rows: [], rowCount: 0, truncated: false };
  }
  const data = (await res.json()) as {
    schema?: { fields?: { name?: string }[] };
    rows?: { f?: { v?: unknown }[] }[];
    totalRows?: string;
  };
  const columns = (data.schema?.fields ?? []).map((f) => String(f.name ?? ""));
  const rows = (data.rows ?? []).slice(0, limit).map((r) => {
    const o: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      o[col] = r.f?.[i]?.v ?? null;
    });
    return o;
  });
  const total = Number(data.totalRows ?? rows.length);
  return {
    ok: true,
    message: `Returned ${rows.length} row(s).`,
    columns,
    rows,
    rowCount: total,
    truncated: total > limit,
  };
}

async function queryMotherduck(
  secrets: Record<string, string>,
  config: Record<string, unknown>,
  sql: string,
  limit: number
): Promise<ReadOnlyQueryResult> {
  const result = await runMotherduckReadOnlyQuery(secrets, config, sql);
  const columns =
    result.columns.length > 0
      ? result.columns
      : Array.from({ length: result.rows[0]?.length ?? 0 }, (_, i) => `col_${i}`);
  const rows = rowsToObjects(columns, result.rows.slice(0, limit));
  return {
    ok: true,
    message: rows.length ? `Returned ${rows.length} row(s) from MotherDuck.` : "No rows returned.",
    columns: rows.length ? Object.keys(rows[0] ?? {}) : columns,
    rows,
    rowCount: result.rows.length,
    truncated: result.rows.length > limit,
  };
}

/** Sample rows from an asset's landing table. */
export async function sampleAssetData(
  connection: DestinationConnectionRow,
  landingQualified: string | undefined,
  limit = 5
): Promise<ReadOnlyQueryResult> {
  const ref = parseTableRef(landingQualified);
  if (!ref) {
    return { ok: false, message: "No schema.table landing target.", columns: [], rows: [], rowCount: 0, truncated: false };
  }

  const connector = connection.connector.toLowerCase().trim();
  const secrets = parseStoredConnectionSecrets(connection.connectionSecretsEnc);
  const config = asConfig(connection.config);
  const capped = Math.min(MAX_ROWS, Math.max(1, limit));

  const sql = `SELECT * FROM ${ref.schema}.${ref.table} LIMIT ${capped}`;
  assertReadOnlySql(sql);

  try {
    if (connector === "postgres" || connector === "postgresql" || connector === "redshift") {
      const connStr = buildPostgresConnectionString(secrets, config);
      if (!connStr) return { ok: false, message: "Postgres connection incomplete.", columns: [], rows: [], rowCount: 0, truncated: false };
      return await queryPostgres(connStr, sql, capped);
    }
    if (connector === "bigquery") {
      const bqSql = `SELECT * FROM \`${ref.schema}.${ref.table}\` LIMIT ${capped}`;
      return await queryBigQuerySample(secrets, config, bqSql, capped);
    }
    if (connector === "snowflake") {
      const sfSql = `SELECT * FROM ${ref.schema}.${ref.table} LIMIT ${capped}`;
      const result = await runSnowflakeReadOnlyQuery(secrets, config, sfSql, { schema: ref.schema });
      const columns = result.rows.length > 0 ? ["col_0", "col_1", "col_2", "col_3", "col_4"].slice(0, result.rows[0]?.length ?? 0) : [];
      // First row might be headers in some cases - for SELECT * rowset is data
      const rows = rowsToObjects(
        columns.length ? columns : result.rows[0]?.map((_, i) => `col_${i}`) ?? [],
        result.rows.slice(0, capped)
      );
      return {
        ok: rows.length > 0,
        message: rows.length ? `Sampled ${rows.length} row(s) from Snowflake.` : "No rows returned.",
        columns: Object.keys(rows[0] ?? {}),
        rows,
        rowCount: rows.length,
        truncated: false,
      };
    }
    if (connector === "motherduck") {
      const mdSql = `SELECT * FROM "${ref.schema.replace(/"/g, '""')}"."${ref.table.replace(/"/g, '""')}" LIMIT ${capped}`;
      return await queryMotherduck(secrets, config, mdSql, capped);
    }
    return { ok: false, message: `Data preview not supported for ${connector}.`, columns: [], rows: [], rowCount: 0, truncated: false };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, message: detail.slice(0, 300), columns: [], rows: [], rowCount: 0, truncated: false };
  }
}

/** Run a user-provided read-only SQL against a destination connection. */
export async function runReadOnlyQuery(
  connection: DestinationConnectionRow,
  sql: string,
  limit = 25
): Promise<ReadOnlyQueryResult> {
  assertReadOnlySql(sql);
  const capped = Math.min(MAX_ROWS, Math.max(1, limit));
  const limitedSql = /\blimit\s+\d+/i.test(sql) ? sql : `${sql.replace(/;\s*$/, "")} LIMIT ${capped}`;

  const connector = connection.connector.toLowerCase().trim();
  const secrets = parseStoredConnectionSecrets(connection.connectionSecretsEnc);
  const config = asConfig(connection.config);

  try {
    if (connector === "postgres" || connector === "postgresql" || connector === "redshift") {
      const connStr = buildPostgresConnectionString(secrets, config);
      if (!connStr) return { ok: false, message: "Postgres connection incomplete.", columns: [], rows: [], rowCount: 0, truncated: false };
      return await queryPostgres(connStr, limitedSql, capped);
    }
    if (connector === "bigquery") {
      return await queryBigQuerySample(secrets, config, limitedSql, capped);
    }
    if (connector === "snowflake") {
      const result = await runSnowflakeReadOnlyQuery(secrets, config, limitedSql);
      const colCount = result.rows[0]?.length ?? 0;
      const columns = Array.from({ length: colCount }, (_, i) => `col_${i}`);
      const rows = rowsToObjects(columns, result.rows.slice(0, capped));
      return {
        ok: true,
        message: `Returned ${rows.length} row(s).`,
        columns,
        rows,
        rowCount: rows.length,
        truncated: result.rows.length > capped,
      };
    }
    if (connector === "motherduck") {
      return await queryMotherduck(secrets, config, limitedSql, capped);
    }
    return { ok: false, message: `Query not supported for ${connector}.`, columns: [], rows: [], rowCount: 0, truncated: false };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, message: detail.slice(0, 300), columns: [], rows: [], rowCount: 0, truncated: false };
  }
}
