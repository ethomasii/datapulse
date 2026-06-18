/**
 * Fetch column metadata for a single warehouse table (asset detail / catalog enrichment).
 */

import { parseStoredConnectionSecrets } from "@/lib/elt/connection-secrets-store";
import type { AssetColumnDef } from "@/lib/elt/catalog-metadata";
import { parseLandingQualified } from "@/lib/elt/warehouse-introspect";
import {
  buildPostgresConnectionString,
  runSnowflakeReadOnlyQuery,
} from "@/lib/elt/warehouse-introspect-connectors";
import type { DestinationConnectionRow } from "@/lib/elt/warehouse-introspect";

export type WarehouseColumnResult = {
  ok: boolean;
  message: string;
  columns: AssetColumnDef[];
};

const COL_LIMIT = 500;

function asConfig(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
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
  const ref = parseTableRef(landingQualified);
  if (!ref) {
    return { ok: false, message: "No schema.table landing target on this asset.", columns: [] };
  }

  const connector = connection.connector.toLowerCase().trim();
  const secrets = parseStoredConnectionSecrets(connection.connectionSecretsEnc);
  const config = asConfig(connection.config);

  try {
    if (connector === "postgres" || connector === "postgresql" || connector === "redshift") {
      const connStr = buildPostgresConnectionString(secrets, config);
      if (!connStr) return { ok: false, message: "Postgres connection incomplete.", columns: [] };
      const columns = await fetchPostgresColumns(connStr, ref.schema, ref.table);
      return {
        ok: columns.length > 0,
        message: columns.length ? `Found ${columns.length} column(s) in warehouse.` : "Table not found or empty.",
        columns,
      };
    }

    if (connector === "bigquery") {
      const columns = await fetchBigQueryColumns(secrets, config, ref.schema, ref.table);
      return {
        ok: columns.length > 0,
        message: columns.length ? `Found ${columns.length} column(s) in BigQuery.` : "Table not found or empty.",
        columns,
      };
    }

    if (connector === "snowflake") {
      const sql = `SELECT column_name, data_type, comment
        FROM information_schema.columns
        WHERE table_schema = '${ref.schema.replace(/'/g, "''")}'
          AND table_name = '${ref.table.replace(/'/g, "''")}'
        ORDER BY ordinal_position
        LIMIT ${COL_LIMIT}`;
      const result = await runSnowflakeReadOnlyQuery(secrets, config, sql, { schema: ref.schema });
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

    return {
      ok: false,
      message: `Column introspection is not supported for ${connector} yet. Use Postgres, BigQuery, or Snowflake destinations.`,
      columns: [],
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, message: detail.slice(0, 200), columns: [] };
  }
}
