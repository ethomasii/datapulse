/**
 * Fetch column metadata for a single warehouse table (asset detail / catalog enrichment).
 */

import { parseDuckdbTableRef } from "@/lib/elt/duckdb-table-ref";
import { STARTER_WAREHOUSE_DEFAULT_DB } from "@/lib/elt/starter-warehouse";
import {
  formatMotherduckColumnError,
  isMotherduckMissingObjectError,
} from "@/lib/elt/warehouse-column-errors";
import { resolveDestinationConnectionContext } from "@/lib/elt/warehouse-destination-secrets";
import type { AssetColumnDef } from "@/lib/elt/catalog-metadata";
import { parseLandingQualified } from "@/lib/elt/warehouse-introspect";
import {
  buildPostgresConnectionString,
  motherduckDatabaseName,
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

export type WarehouseColumnResult = {
  ok: boolean;
  message: string;
  columns: AssetColumnDef[];
};

const COL_LIMIT = 500;

type RowsetRunner = (
  secrets: Record<string, string>,
  config: Record<string, unknown>,
  sql: string
) => Promise<WarehouseQueryRowset>;

const COLUMN_RUNNERS: Record<string, RowsetRunner> = {
  databricks: runDatabricksReadOnlyQuery,
  clickhouse: runClickhouseReadOnlyQuery,
  mysql: runMysqlReadOnlyQuery,
  trino: runTrinoReadOnlyQuery,
  duckdb: runDuckdbReadOnlyQuery,
  sqlite: runSqliteReadOnlyQuery,
  motherduck: runMotherduckReadOnlyQuery,
};

function normalizeConnector(connector: string): string {
  const c = connector.toLowerCase().trim();
  if (c === "gcp") return "bigquery";
  if (c === "postgresql") return "postgres";
  return c;
}

function informationSchemaColumnsSql(schema: string, table: string, connector: string): string {
  const s = schema.replace(/'/g, "''");
  const t = table.replace(/'/g, "''");
  const c = normalizeConnector(connector);
  const caseInsensitive = c === "motherduck" || c === "duckdb" || c === "sqlite";
  const schemaMatch = caseInsensitive ? `lower(table_schema) = lower('${s}')` : `table_schema = '${s}'`;
  const tableMatch = caseInsensitive ? `lower(table_name) = lower('${t}')` : `table_name = '${t}'`;
  return `SELECT column_name, data_type
    FROM information_schema.columns
    WHERE ${schemaMatch}
      AND ${tableMatch}
    ORDER BY ordinal_position
    LIMIT ${COL_LIMIT}`;
}

function quoteDuckdbTable(schema: string, table: string): string {
  const dq = (part: string) => `"${part.replace(/"/g, '""')}"`;
  return `${dq(schema)}.${dq(table)}`;
}

async function fetchDuckdbFamilyColumns(
  runner: RowsetRunner,
  secrets: Record<string, string>,
  config: Record<string, unknown>,
  schema: string,
  table: string,
  connector: string,
  queryConfig?: Record<string, unknown>
): Promise<AssetColumnDef[]> {
  const cfg = queryConfig ?? config;
  const fromInfo = await fetchColumnsFromInformationSchema(runner, secrets, cfg, schema, table, connector);
  if (fromInfo.length) return fromInfo;

  const qualified = quoteDuckdbTable(schema, table);
  try {
    const rowset = await runner(secrets, cfg, `DESCRIBE ${qualified}`);
    const nameIdx = rowset.columns.findIndex((c) => c.toLowerCase() === "column_name");
    const typeIdx = rowset.columns.findIndex((c) => c.toLowerCase() === "column_type");
    if (nameIdx >= 0) {
      return rowset.rows
        .map((row) => ({
          name: String(row[nameIdx] ?? ""),
          type: typeIdx >= 0 && row[typeIdx] != null ? String(row[typeIdx]) : undefined,
          source: "warehouse" as const,
        }))
        .filter((c) => c.name);
    }
    const fromDescribe = rowsetToColumnDefs(rowset);
    if (fromDescribe.length) return fromDescribe;
  } catch {
    /* fall through to zero-row SELECT */
  }

  const sample = await runner(secrets, cfg, `SELECT * FROM ${qualified} LIMIT 0`);
  if (sample.columns.length) {
    return sample.columns.map((name) => ({ name, source: "warehouse" as const }));
  }

  return [];
}

function motherduckDatabaseCandidates(
  secrets: Record<string, string>,
  config: Record<string, unknown>,
  catalogFromRef?: string
): string[] {
  const configured = motherduckDatabaseName(secrets, config);
  const out: string[] = [];
  for (const db of [catalogFromRef, configured, "my_db", STARTER_WAREHOUSE_DEFAULT_DB]) {
    const d = db?.trim();
    if (d && !out.includes(d)) out.push(d);
  }
  return out;
}

async function fetchMotherduckColumns(
  secrets: Record<string, string>,
  config: Record<string, unknown>,
  schema: string,
  table: string,
  catalogFromRef?: string
): Promise<{ columns: AssetColumnDef[]; database?: string; lastError?: string }> {
  const runner = runMotherduckReadOnlyQuery;
  let lastError: string | undefined;

  for (const database of motherduckDatabaseCandidates(secrets, config, catalogFromRef)) {
    const queryConfig = { ...config, database };
    try {
      const columns = await fetchDuckdbFamilyColumns(
        runner,
        secrets,
        config,
        schema,
        table,
        "motherduck",
        queryConfig
      );
      if (columns.length) {
        return { columns, database };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastError = msg;
      if (!isMotherduckMissingObjectError(msg)) {
        throw e;
      }
    }
  }

  return { columns: [], lastError };
}

function rowsetToColumnDefs(rowset: WarehouseQueryRowset): AssetColumnDef[] {
  return rowset.rows
    .map((row) => ({
      name: String(row[0] ?? ""),
      type: row[1] ? String(row[1]) : undefined,
      source: "warehouse" as const,
    }))
    .filter((c) => c.name);
}

async function fetchPostgresColumns(
  connStr: string,
  schema: string,
  table: string
): Promise<AssetColumnDef[]> {
  const { Client } = await import("pg");
  const client = new Client({ connectionString: connStr, connectionTimeoutMillis: 12_000 });
  await client.connect();
  try {
    const res = await client.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position
       LIMIT ${COL_LIMIT}`,
      [schema, table]
    );
    return res.rows.map((r) => ({
      name: r.column_name,
      type: r.data_type,
      source: "warehouse" as const,
    }));
  } finally {
    await client.end();
  }
}

async function fetchBigQueryColumns(
  secrets: Record<string, string>,
  config: Record<string, unknown>,
  dataset: string,
  table: string
): Promise<AssetColumnDef[]> {
  const credentials =
    secrets.GCP_CREDENTIALS?.trim() ||
    secrets.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
    secrets.DESTINATION__BIGQUERY__CREDENTIALS?.trim() ||
    (typeof config.credentials === "string" ? config.credentials.trim() : "");
  const projectId =
    secrets.GCP_PROJECT_ID?.trim() ||
    secrets.BIGQUERY_PROJECT?.trim() ||
    (typeof config.project_id === "string" ? config.project_id.trim() : "") ||
    (typeof config.project === "string" ? config.project.trim() : "");
  if (!credentials || !projectId) return [];

  const { fetchGcpAccessToken } = await import("@/lib/elt/gcp-access-token");
  const token = await fetchGcpAccessToken(credentials, "https://www.googleapis.com/auth/bigquery.readonly");

  const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(projectId)}/datasets/${encodeURIComponent(dataset)}/tables/${encodeURIComponent(table)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return [];
  const body = (await res.json()) as {
    schema?: { fields?: { name?: string; type?: string; description?: string }[] };
  };
  return (body.schema?.fields ?? [])
    .slice(0, COL_LIMIT)
    .map((f) => ({
      name: String(f.name ?? ""),
      type: f.type,
      description: f.description,
      source: "warehouse" as const,
    }))
    .filter((c) => c.name);
}

async function fetchColumnsFromInformationSchema(
  runQuery: RowsetRunner,
  secrets: Record<string, string>,
  config: Record<string, unknown>,
  schema: string,
  table: string,
  connector: string
): Promise<AssetColumnDef[]> {
  const rowset = await runQuery(secrets, config, informationSchemaColumnsSql(schema, table, connector));
  return rowsetToColumnDefs(rowset);
}

/** Resolve schema + table from asset landing target. */
export function parseTableRef(landingQualified: string | undefined): { schema: string; table: string } | null {
  const parsed = parseLandingQualified(landingQualified);
  if (!parsed.full) return null;
  const parts = parsed.full.split(".");
  if (parts.length < 2) return null;
  const table = parts[parts.length - 1]!;
  const schema = parts.slice(0, -1).join(".");
  return { schema, table };
}

export async function fetchWarehouseColumnsForAsset(
  connection: DestinationConnectionRow,
  landingQualified: string | undefined
): Promise<WarehouseColumnResult> {
  const connector = normalizeConnector(connection.connector);
  const { secrets, config } = resolveDestinationConnectionContext(connection);

  let schema: string;
  let table: string;
  let queryConfig = config;

  if (connector === "motherduck" || connector === "duckdb" || connector === "sqlite") {
    const defaultDb =
      connector === "motherduck" ? motherduckDatabaseName(secrets, config) : undefined;
    const duckRef = parseDuckdbTableRef(landingQualified ?? "", defaultDb);
    if (!duckRef) {
      return { ok: false, message: "No schema.table landing target on this asset.", columns: [] };
    }
    schema = duckRef.schema;
    table = duckRef.table;
    if (duckRef.database && duckRef.database !== defaultDb) {
      queryConfig = { ...config, database: duckRef.database };
    }
  } else {
    const ref = parseTableRef(landingQualified);
    if (!ref) {
      return { ok: false, message: "No schema.table landing target on this asset.", columns: [] };
    }
    schema = ref.schema;
    table = ref.table;
  }

  try {
    if (connector === "postgres" || connector === "redshift") {
      const connStr = buildPostgresConnectionString(secrets, config);
      if (!connStr) return { ok: false, message: "Postgres connection incomplete.", columns: [] };
      const columns = await fetchPostgresColumns(connStr, schema, table);
      return {
        ok: columns.length > 0,
        message: columns.length ? `Found ${columns.length} column(s) in warehouse.` : "Table not found or empty.",
        columns,
      };
    }

    if (connector === "bigquery") {
      const columns = await fetchBigQueryColumns(secrets, config, schema, table);
      return {
        ok: columns.length > 0,
        message: columns.length ? `Found ${columns.length} column(s) in BigQuery.` : "Table not found or empty.",
        columns,
      };
    }

    if (connector === "snowflake") {
      const sql = `SELECT column_name, data_type, comment
        FROM information_schema.columns
        WHERE table_schema = '${schema.replace(/'/g, "''")}'
          AND table_name = '${table.replace(/'/g, "''")}'
        ORDER BY ordinal_position
        LIMIT ${COL_LIMIT}`;
      const result = await runSnowflakeReadOnlyQuery(secrets, config, sql, { schema });
      const columns = result.rows
        .map((row) => ({
          name: String(row[0] ?? ""),
          type: row[1] ? String(row[1]) : undefined,
          description: row[2] ? String(row[2]) : undefined,
          source: "warehouse" as const,
        }))
        .filter((c) => c.name);
      return {
        ok: columns.length > 0,
        message: columns.length ? `Found ${columns.length} column(s) in Snowflake.` : "Table not found or empty.",
        columns,
      };
    }

    const runner = COLUMN_RUNNERS[connector];
    if (runner) {
      if (connector === "motherduck") {
        const catalogFromRef =
          parseDuckdbTableRef(landingQualified ?? "", motherduckDatabaseName(secrets, config))?.database;
        const { columns, database, lastError } = await fetchMotherduckColumns(
          secrets,
          config,
          schema,
          table,
          catalogFromRef
        );
        const configuredDb = motherduckDatabaseName(secrets, config);
        const resolvedDb = database ?? configuredDb;
        return {
          ok: columns.length > 0,
          message: columns.length
            ? `Found ${columns.length} column(s) in MotherDuck (${resolvedDb}).`
            : formatMotherduckColumnError(schema, table, configuredDb, lastError),
          columns,
        };
      }

      const columns =
        connector === "duckdb" || connector === "sqlite"
          ? await fetchDuckdbFamilyColumns(runner, secrets, config, schema, table, connector, queryConfig)
          : await fetchColumnsFromInformationSchema(runner, secrets, config, schema, table, connector);
      const label = connector.charAt(0).toUpperCase() + connector.slice(1);
      return {
        ok: columns.length > 0,
        message: columns.length
          ? `Found ${columns.length} column(s) in ${label}.`
          : `No columns found for ${schema}.${table}. The table may not exist yet — run a pipeline sync first.`,
        columns,
      };
    }

    return {
      ok: false,
      message: `Column introspection is not supported for ${connector} yet.`,
      columns: [],
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, message: detail.slice(0, 200), columns: [] };
  }
}
