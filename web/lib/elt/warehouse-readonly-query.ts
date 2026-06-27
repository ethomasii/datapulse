/**
 * Read-only warehouse queries for catalog data preview and AI context.
 * SELECT-only, row-capped, timeout-bounded.
 */

import { resolveDestinationConnectionContext } from "@/lib/elt/warehouse-destination-secrets";
import {
  buildPostgresConnectionString,
  runClickhouseReadOnlyQuery,
  runDatabricksReadOnlyQuery,
  runDuckdbReadOnlyQuery,
  runMotherduckReadOnlyQuery,
  runMysqlReadOnlyQuery,
  runSnowflakeReadOnlyQuery,
  runSqliteReadOnlyQuery,
  runTrinoReadOnlyQuery,
  type WarehouseQueryRowset,
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

type RowsetRunner = (
  secrets: Record<string, string>,
  config: Record<string, unknown>,
  sql: string
) => Promise<WarehouseQueryRowset>;

const ROWSET_RUNNERS: Record<string, RowsetRunner> = {
  databricks: runDatabricksReadOnlyQuery,
  clickhouse: runClickhouseReadOnlyQuery,
  mysql: runMysqlReadOnlyQuery,
  trino: runTrinoReadOnlyQuery,
  duckdb: runDuckdbReadOnlyQuery,
  sqlite: runSqliteReadOnlyQuery,
  motherduck: runMotherduckReadOnlyQuery,
};

function asConfig(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function normalizeConnector(connector: string): string {
  const c = connector.toLowerCase().trim();
  if (c === "gcp") return "bigquery";
  if (c === "postgresql") return "postgres";
  return c;
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

function rowsetToResult(rowset: WarehouseQueryRowset, limit: number, label: string): ReadOnlyQueryResult {
  const columns =
    rowset.columns.length > 0
      ? rowset.columns
      : Array.from({ length: rowset.rows[0]?.length ?? 0 }, (_, i) => `col_${i}`);
  const sliced = rowset.rows.slice(0, limit);
  const rows = rowsToObjects(columns, sliced);
  return {
    ok: true,
    message: rows.length ? `Returned ${rows.length} row(s) from ${label}.` : "No rows returned.",
    columns,
    rows,
    rowCount: rowset.rows.length,
    truncated: rowset.rows.length > limit,
  };
}

export function quoteQualifiedTable(connector: string, schema: string, table: string): string {
  const c = normalizeConnector(connector);
  const dq = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const bt = (s: string) => `\`${s.replace(/`/g, "``")}\``;
  if (c === "bigquery") return `\`${schema}.${table}\``;
  if (c === "mysql" || c === "clickhouse") return `${bt(schema)}.${bt(table)}`;
  if (c === "snowflake" || c === "databricks") return `${schema}.${table}`;
  return `${dq(schema)}.${dq(table)}`;
}

export function sampleSelectSql(connector: string, schema: string, table: string, limit: number): string {
  const c = normalizeConnector(connector);
  if (c === "postgres" || c === "redshift") {
    return `SELECT * FROM ${schema}.${table} LIMIT ${limit}`;
  }
  return `SELECT * FROM ${quoteQualifiedTable(c, schema, table)} LIMIT ${limit}`;
}

async function queryPostgres(connStr: string, sql: string, limit: number): Promise<ReadOnlyQueryResult> {
  const { Client } = await import("pg");
  const client = new Client({ connectionString: connStr, connectionTimeoutMillis: 12_000, query_timeout: QUERY_TIMEOUT_MS });
  await client.connect();
  try {
    const res = await client.query(sql);
    const columns = res.fields.map((f) => f.name);
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

async function queryRowsetConnector(
  connector: string,
  secrets: Record<string, string>,
  config: Record<string, unknown>,
  sql: string,
  limit: number
): Promise<ReadOnlyQueryResult> {
  const runner = ROWSET_RUNNERS[connector];
  if (!runner) {
    return {
      ok: false,
      message: `Query not supported for ${connector}.`,
      columns: [],
      rows: [],
      rowCount: 0,
      truncated: false,
    };
  }
  const rowset = await runner(secrets, config, sql);
  return rowsetToResult(rowset, limit, connector);
}

async function executeReadOnlyQuery(
  connection: DestinationConnectionRow,
  sql: string,
  limit: number
): Promise<ReadOnlyQueryResult> {
  const connector = normalizeConnector(connection.connector);
  const { secrets, config } = resolveDestinationConnectionContext(connection);

  if (connector === "postgres" || connector === "redshift") {
    const connStr = buildPostgresConnectionString(secrets, config);
    if (!connStr) {
      return { ok: false, message: "Postgres connection incomplete.", columns: [], rows: [], rowCount: 0, truncated: false };
    }
    return await queryPostgres(connStr, sql, limit);
  }
  if (connector === "bigquery") {
    return await queryBigQuerySample(secrets, config, sql, limit);
  }
  if (connector === "snowflake") {
    const result = await runSnowflakeReadOnlyQuery(secrets, config, sql);
    return rowsetToResult(
      {
        columns: Array.from({ length: result.rows[0]?.length ?? 0 }, (_, i) => `col_${i}`),
        rows: result.rows,
      },
      limit,
      "snowflake"
    );
  }
  if (ROWSET_RUNNERS[connector]) {
    return await queryRowsetConnector(connector, secrets, config, sql, limit);
  }
  return {
    ok: false,
    message: `Query not supported for ${connector}.`,
    columns: [],
    rows: [],
    rowCount: 0,
    truncated: false,
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

  const connector = normalizeConnector(connection.connector);
  const capped = Math.min(MAX_ROWS, Math.max(1, limit));
  const sql = sampleSelectSql(connector, ref.schema, ref.table, capped);
  assertReadOnlySql(sql);

  try {
    return await executeReadOnlyQuery(connection, sql, capped);
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

  try {
    return await executeReadOnlyQuery(connection, limitedSql, capped);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, message: detail.slice(0, 300), columns: [], rows: [], rowCount: 0, truncated: false };
  }
}
