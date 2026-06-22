/**
 * Live source introspection — Fivetran-style "discover tables/resources" after connect.
 * Server-only (pg, mysql2, aws-sdk).
 */
import "server-only";

import { parseStoredConnectionSecrets } from "@/lib/elt/connection-secrets-store";
import {
  catalogResourcesForConnector,
  type DiscoverItem,
  type DiscoverResult,
} from "@/lib/elt/source-discover-catalog";

export type { DiscoverItem, DiscoverResult } from "@/lib/elt/source-discover-catalog";
export {
  applyDiscoveryToSourceConfiguration,
  hasDiscoverCatalog,
} from "@/lib/elt/source-discover-catalog";

export type DiscoverInput = {
  connectionType: "source" | "destination";
  connector: string;
  config: Record<string, unknown>;
  connectionSecretsEnc?: string | null;
  secrets?: Record<string, string>;
};

function mergedSecrets(input: DiscoverInput): Record<string, string> {
  const fromStore = parseStoredConnectionSecrets(input.connectionSecretsEnc);
  return { ...fromStore, ...(input.secrets ?? {}) };
}

async function discoverPostgresTables(
  secrets: Record<string, string>,
  config: Record<string, unknown>
): Promise<DiscoverResult> {
  const conn =
    secrets.DATABASE_URL ??
    secrets.POSTGRES_CONNECTION_STRING ??
    (typeof config.connection_string === "string" ? config.connection_string : "");
  if (!conn?.trim()) {
    return { ok: false, message: "Set DATABASE_URL or connection_string.", items: [] };
  }
  const schemaFilter =
    typeof config.schema === "string" && config.schema.trim() ? config.schema.trim() : null;

  try {
    const { Client } = await import("pg");
    const client = new Client({ connectionString: conn.trim() });
    await client.connect();
    const params: unknown[] = [];
    let where = "table_schema NOT IN ('pg_catalog', 'information_schema')";
    if (schemaFilter) {
      params.push(schemaFilter);
      where += ` AND table_schema = $${params.length}`;
    }
    const res = await client.query<{ table_schema: string; table_name: string; row_estimate: string | null }>(
      `SELECT table_schema, table_name,
              (xpath('/row/cnt/text()', xml_count))[1]::text::bigint AS row_estimate
       FROM (
         SELECT table_schema, table_name,
                query_to_xml(format('select count(*) as cnt from %I.%I', table_schema, table_name), false, true, '') AS xml_count
         FROM information_schema.tables
         WHERE table_type = 'BASE TABLE' AND ${where}
       ) t
       ORDER BY table_schema, table_name
       LIMIT 500`,
      params
    );
    await client.end();

    const items: DiscoverItem[] = res.rows.map((r) => ({
      id: `${r.table_schema}.${r.table_name}`,
      name: r.table_name,
      schema: r.table_schema,
      kind: "table" as const,
      rowEstimate: r.row_estimate ? Number(r.row_estimate) : null,
    }));

    return {
      ok: true,
      message: `Found ${items.length} table(s).`,
      items,
      defaultSelected: items.slice(0, 5).map((i) => i.id),
    };
  } catch {
    try {
      const { Client } = await import("pg");
      const client = new Client({ connectionString: conn.trim() });
      await client.connect();
      const params: unknown[] = [];
      let where = "table_schema NOT IN ('pg_catalog', 'information_schema')";
      if (schemaFilter) {
        params.push(schemaFilter);
        where += ` AND table_schema = $${params.length}`;
      }
      const res = await client.query<{ table_schema: string; table_name: string }>(
        `SELECT table_schema, table_name FROM information_schema.tables
         WHERE table_type = 'BASE TABLE' AND ${where}
         ORDER BY table_schema, table_name LIMIT 500`,
        params
      );
      await client.end();
      const items = res.rows.map((r) => ({
        id: `${r.table_schema}.${r.table_name}`,
        name: r.table_name,
        schema: r.table_schema,
        kind: "table" as const,
      }));
      return {
        ok: true,
        message: `Found ${items.length} table(s).`,
        items,
        defaultSelected: items.slice(0, 5).map((i) => i.id),
      };
    } catch {
      return {
        ok: false,
        message: "Could not list PostgreSQL tables.",
        items: [],
      };
    }
  }
}

async function discoverMysqlTables(
  secrets: Record<string, string>,
  config: Record<string, unknown>
): Promise<DiscoverResult> {
  const host = secrets.MYSQL_HOST ?? secrets.DEST_MYSQL_HOST ?? "";
  const user = secrets.MYSQL_USER ?? secrets.DEST_MYSQL_USER ?? "";
  const password = secrets.MYSQL_PASSWORD ?? secrets.DEST_MYSQL_PASSWORD ?? "";
  const database = secrets.MYSQL_DATABASE ?? secrets.DEST_MYSQL_DATABASE ?? "";
  if (!host || !user || !database) {
    return { ok: false, message: "Set MYSQL_HOST, MYSQL_USER, and MYSQL_DATABASE.", items: [] };
  }
  try {
    const mysql = await import("mysql2/promise");
    const conn = await mysql.createConnection({
      host,
      user,
      password,
      database,
      port: Number(secrets.MYSQL_PORT ?? secrets.DEST_MYSQL_PORT ?? 3306),
    });
    const [rows] = await conn.query(
      `SELECT TABLE_SCHEMA, TABLE_NAME FROM information_schema.tables
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME LIMIT 500`,
      [database]
    );
    await conn.end();
    const tableRows = rows as { TABLE_SCHEMA: string; TABLE_NAME: string }[];
    const items = tableRows.map((r) => ({
      id: `${r.TABLE_SCHEMA}.${r.TABLE_NAME}`,
      name: r.TABLE_NAME,
      schema: r.TABLE_SCHEMA,
      kind: "table" as const,
    }));
    return {
      ok: true,
      message: `Found ${items.length} table(s).`,
      items,
      defaultSelected: items.slice(0, 5).map((i) => i.id),
    };
  } catch {
    return { ok: false, message: "Could not list MySQL tables.", items: [] };
  }
}

async function discoverS3Prefixes(
  secrets: Record<string, string>,
  config: Record<string, unknown>
): Promise<DiscoverResult> {
  const bucket =
    secrets.S3_BUCKET ??
    (typeof config.bucket === "string" ? config.bucket : "") ??
    (typeof config.bucket_url === "string" ? config.bucket_url.replace(/^s3:\/\//, "").split("/")[0] : "");
  if (!bucket?.trim()) {
    return { ok: false, message: "Set S3_BUCKET or bucket in config.", items: [] };
  }
  try {
    const { S3Client, ListObjectsV2Command } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: secrets.AWS_REGION ?? secrets.AWS_DEFAULT_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: secrets.AWS_ACCESS_KEY_ID ?? "",
        secretAccessKey: secrets.AWS_SECRET_ACCESS_KEY ?? "",
      },
    });
    const prefix =
      typeof config.prefix === "string" && config.prefix.trim() ? config.prefix.trim() : "";
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket.trim(),
        Prefix: prefix,
        Delimiter: "/",
        MaxKeys: 200,
      })
    );
    const prefixes = (res.CommonPrefixes ?? []).map((p) => p.Prefix).filter(Boolean) as string[];
    const objects = (res.Contents ?? [])
      .map((o) => o.Key)
      .filter((k): k is string => typeof k === "string" && k.length > 0 && !k.endsWith("/"))
      .slice(0, 100);

    const items: DiscoverItem[] = [
      ...prefixes.map((p) => ({
        id: p,
        name: p.replace(/\/$/, "").split("/").pop() ?? p,
        kind: "prefix" as const,
        description: p,
      })),
      ...objects.map((k) => ({
        id: k,
        name: k.split("/").pop() ?? k,
        kind: "prefix" as const,
        description: k,
      })),
    ];

    return {
      ok: true,
      message: items.length ? `Found ${items.length} prefix/object(s).` : "Bucket reachable; no prefixes listed.",
      items,
      defaultSelected: items.slice(0, 3).map((i) => i.id),
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not list S3 objects.",
      items: [],
    };
  }
}

export async function discoverSource(input: DiscoverInput): Promise<DiscoverResult> {
  if (input.connectionType !== "source") {
    return { ok: false, message: "Discovery is only supported for source connections.", items: [] };
  }

  const connector = input.connector.toLowerCase();
  const secrets = mergedSecrets(input);

  if (connector === "postgres" || connector === "postgresql") {
    return discoverPostgresTables(secrets, input.config);
  }
  if (connector === "mysql") {
    return discoverMysqlTables(secrets, input.config);
  }
  if (connector === "s3") {
    return discoverS3Prefixes(secrets, input.config);
  }

  const catalog = catalogResourcesForConnector(connector);
  if (catalog) return catalog;

  return {
    ok: true,
    message: `No live discovery for ${connector} yet — using recommended defaults.`,
    items: [],
    defaultSelected: [],
  };
}
