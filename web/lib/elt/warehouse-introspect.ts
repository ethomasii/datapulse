/**
 * Lightweight warehouse table introspection for asset verification (v3).
 * Compares config-derived landing targets against destination catalogs.
 */

import { parseStoredConnectionSecrets } from "@/lib/elt/connection-secrets-store";
import { mergeConnectionRuntimeSecrets } from "@/lib/elt/duckdb-destination";
import {
  introspectAzureBlob,
  introspectBigQuery,
  introspectClickhouse,
  introspectDatabricks,
  introspectDuckdb,
  introspectGcs,
  introspectFilesystem,
  introspectS3,
  introspectMotherduck,
  introspectMysql,
  introspectPostgresFamily,
  introspectSnowflake,
  introspectSqlite,
  introspectTrino,
} from "@/lib/elt/warehouse-introspect-connectors";

export type WarehouseTableRef = {
  schema: string;
  table: string;
  qualified: string;
};

export type WarehouseIntrospectionResult = {
  ok: boolean;
  connector: string;
  message: string;
  tables: WarehouseTableRef[];
};

export type DestinationConnectionRow = {
  id: string;
  connector: string;
  config: unknown;
  connectionSecretsEnc: string | null;
};

/** Destinations with live catalog introspection in verify mode. */
export const WAREHOUSE_INTROSPECTION_CONNECTORS = [
  "postgres",
  "postgresql",
  "redshift",
  "snowflake",
  "bigquery",
  "duckdb",
  "motherduck",
  "databricks",
  "clickhouse",
  "mysql",
  "trino",
  "sqlite",
  "s3",
  "gcs",
  "azure_blob",
  "filesystem",
] as const;

export function normalizeQualifiedTable(schema: string, table: string): string {
  return `${schema}.${table}`.toLowerCase();
}

/** Parse config-derived `schema.table` or `table` into comparable keys. */
export function parseLandingQualified(qualified: string | undefined): { full: string | null; table: string | null } {
  if (!qualified?.trim()) return { full: null, table: null };
  const q = qualified.trim();
  const uri = q.match(/^(s3|gs|azure):\/\/.+/i);
  if (uri) {
    return { full: q.toLowerCase(), table: q.split("/").pop()?.toLowerCase() ?? null };
  }
  const parts = q.split(".").filter(Boolean);
  if (parts.length >= 2) {
    const table = parts[parts.length - 1]!;
    const schema = parts.slice(0, -1).join(".");
    return { full: normalizeQualifiedTable(schema, table), table: table.toLowerCase() };
  }
  return { full: null, table: q.toLowerCase() };
}

export function tableSetFromIntrospection(tables: WarehouseTableRef[]): Set<string> {
  const set = new Set<string>();
  for (const t of tables) {
    set.add(normalizeQualifiedTable(t.schema, t.table));
    set.add(t.table.toLowerCase());
    if (t.qualified) set.add(t.qualified.toLowerCase());
  }
  return set;
}

export function isTablePresentInWarehouse(
  landingQualified: string | undefined,
  warehouseTables: Set<string>
): boolean | null {
  if (!landingQualified?.trim()) return null;
  if (warehouseTables.size === 0) return null;
  const { full, table } = parseLandingQualified(landingQualified);
  if (full && warehouseTables.has(full)) return true;
  if (table && warehouseTables.has(table)) return true;
  const lower = landingQualified.trim().toLowerCase();
  if (warehouseTables.has(lower)) return true;
  return false;
}

export async function introspectDestinationConnection(
  row: DestinationConnectionRow
): Promise<WarehouseIntrospectionResult> {
  const connector = row.connector.toLowerCase().trim();
  const config =
    row.config && typeof row.config === "object" && !Array.isArray(row.config)
      ? (row.config as Record<string, unknown>)
      : {};
  const secrets = mergeConnectionRuntimeSecrets(
    "destination",
    connector,
    parseStoredConnectionSecrets(row.connectionSecretsEnc),
    config
  );

  switch (connector) {
    case "postgres":
    case "postgresql":
      return introspectPostgresFamily("postgres", secrets, config);
    case "redshift":
      return introspectPostgresFamily("redshift", secrets, config);
    case "snowflake":
      return introspectSnowflake(secrets, config);
    case "bigquery":
    case "gcp":
      return introspectBigQuery(secrets, config);
    case "duckdb":
      return introspectDuckdb(secrets, config);
    case "motherduck":
      return introspectMotherduck(secrets, config);
    case "databricks":
      return introspectDatabricks(secrets, config);
    case "clickhouse":
      return introspectClickhouse(secrets, config);
    case "mysql":
      return introspectMysql(secrets, config);
    case "trino":
      return introspectTrino(secrets, config);
    case "sqlite":
      return introspectSqlite(secrets, config);
    case "s3":
      return introspectS3(secrets, config);
    case "gcs":
      return introspectGcs(secrets, config);
    case "azure_blob":
      return introspectAzureBlob(secrets, config);
    case "filesystem":
      return introspectFilesystem(secrets, config);
    default:
      return {
        ok: false,
        connector,
        message: `Warehouse verification is not available for ${connector} yet. Supported: SQL warehouses, DuckDB, MotherDuck, S3, GCS, filesystem, and more.`,
        tables: [],
      };
  }
}
