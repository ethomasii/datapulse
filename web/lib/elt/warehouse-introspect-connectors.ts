/**
 * Per-connector warehouse table introspection implementations.
 */

import { createHash, createHmac, createPrivateKey, createPublicKey, createSign, randomUUID } from "crypto";
import { fetchGcpAccessToken } from "@/lib/elt/gcp-access-token";
import { resolveDuckdbDatabaseLocation } from "@/lib/elt/duckdb-destination";
import { readFetchJsonBody } from "@/lib/elt/fetch-json-body";
import { STARTER_WAREHOUSE_DEFAULT_DB } from "@/lib/elt/starter-warehouse";
import type { WarehouseIntrospectionResult, WarehouseTableRef } from "@/lib/elt/warehouse-introspect";

const TABLE_LIMIT = 5000;
const FETCH_TIMEOUT_MS = 20_000;

export type WarehouseQueryRowset = {
  columns: string[];
  rows: unknown[][];
};

export type MotherduckQueryRowset = WarehouseQueryRowset;

function fail(connector: string, message: string): WarehouseIntrospectionResult {
  return { ok: false, connector, message, tables: [] };
}

function ok(connector: string, message: string, tables: WarehouseTableRef[]): WarehouseIntrospectionResult {
  return { ok: true, connector, message, tables };
}

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

// ─── Postgres family (Postgres, Redshift) ───────────────────────────────────

export function buildPostgresConnectionString(
  secrets: Record<string, string>,
  config: Record<string, unknown>
): string | null {
  const direct =
    secret(secrets, "DATABASE_URL", "POSTGRES_CONNECTION_STRING", "DESTINATION__POSTGRES__CREDENTIALS") ||
    configString(config, "connection_string");
  if (direct) return direct;

  const host =
    secret(secrets, "DEST_POSTGRES_HOST", "POSTGRES_HOST", "REDSHIFT_HOST") || configString(config, "host");
  const port =
    secret(secrets, "DEST_POSTGRES_PORT", "POSTGRES_PORT", "REDSHIFT_PORT") ||
    configString(config, "port") ||
    (secrets.REDSHIFT_HOST ? "5439" : "5432");
  const database =
    secret(secrets, "DEST_POSTGRES_DATABASE", "POSTGRES_DATABASE", "REDSHIFT_DATABASE") ||
    configString(config, "database");
  const user =
    secret(secrets, "DEST_POSTGRES_USER", "POSTGRES_USER", "REDSHIFT_USER") || configString(config, "username");
  const password = secret(secrets, "DEST_POSTGRES_PASSWORD", "POSTGRES_PASSWORD", "REDSHIFT_PASSWORD");

  if (!host || !database || !user || !password) return null;
  const encUser = encodeURIComponent(user);
  const encPass = encodeURIComponent(password);
  return `postgresql://${encUser}:${encPass}@${host}:${port}/${database}`;
}

export async function introspectPostgresFamily(
  connector: string,
  secrets: Record<string, string>,
  config: Record<string, unknown>
): Promise<WarehouseIntrospectionResult> {
  const conn = buildPostgresConnectionString(secrets, config);
  if (!conn) {
    return fail(connector, "Destination connection is missing host, database, user, or password.");
  }

  try {
    const { Client } = await import("pg");
    const client = new Client({ connectionString: conn, connectionTimeoutMillis: 12_000 });
    await client.connect();
    const res = await client.query<{ table_schema: string; table_name: string }>(
      `SELECT table_schema, table_name
       FROM information_schema.tables
       WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
         AND table_type = 'BASE TABLE'
       ORDER BY table_schema, table_name
       LIMIT ${TABLE_LIMIT}`
    );
    await client.end();
    const tables = res.rows.map((r) => ({
      schema: r.table_schema,
      table: r.table_name,
      qualified: `${r.table_schema}.${r.table_name}`,
    }));
    const label = connector === "redshift" ? "Redshift" : "Postgres";
    return ok(connector, `Found ${tables.length} table(s) in ${label}.`, tables);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return fail(connector, `Could not introspect ${connector}: ${detail.slice(0, 180)}`);
  }
}

// ─── BigQuery ────────────────────────────────────────────────────────────────

export async function introspectBigQuery(
  secrets: Record<string, string>,
  config: Record<string, unknown>
): Promise<WarehouseIntrospectionResult> {
  const credentials =
    secret(secrets, "GCP_CREDENTIALS", "GOOGLE_APPLICATION_CREDENTIALS", "DESTINATION__BIGQUERY__CREDENTIALS") ||
    configString(config, "credentials");
  const projectId = secret(secrets, "GCP_PROJECT_ID") || configString(config, "project", "project_id");

  if (!credentials) {
    return fail("bigquery", "Set GCP_CREDENTIALS (service account JSON) to verify BigQuery tables.");
  }
  if (!projectId) {
    return fail("bigquery", "Set GCP_PROJECT_ID to verify BigQuery tables.");
  }

  try {
    const token = await fetchGcpAccessToken(credentials, "https://www.googleapis.com/auth/bigquery.readonly");
    const tables: WarehouseTableRef[] = [];
    const datasetsUrl = `https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(projectId)}/datasets?maxResults=100`;
    const datasetsResp = await fetch(datasetsUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!datasetsResp.ok) {
      return fail("bigquery", `BigQuery datasets API returned ${datasetsResp.status}.`);
    }
    const datasetsBody = (await datasetsResp.json()) as {
      datasets?: { datasetReference: { datasetId: string } }[];
    };
    const datasets = datasetsBody.datasets ?? [];

    for (const ds of datasets) {
      const datasetId = ds.datasetReference.datasetId;
      let pageToken: string | undefined;
      do {
        const tablesUrl = new URL(
          `https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(projectId)}/datasets/${encodeURIComponent(datasetId)}/tables`
        );
        tablesUrl.searchParams.set("maxResults", "1000");
        if (pageToken) tablesUrl.searchParams.set("pageToken", pageToken);
        const tablesResp = await fetch(tablesUrl, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!tablesResp.ok) break;
        const tablesBody = (await tablesResp.json()) as {
          tables?: { tableReference: { tableId: string } }[];
          nextPageToken?: string;
        };
        for (const t of tablesBody.tables ?? []) {
          tables.push({
            schema: datasetId,
            table: t.tableReference.tableId,
            qualified: `${datasetId}.${t.tableReference.tableId}`,
          });
          if (tables.length >= TABLE_LIMIT) break;
        }
        pageToken = tablesBody.nextPageToken;
      } while (pageToken && tables.length < TABLE_LIMIT);
      if (tables.length >= TABLE_LIMIT) break;
    }

    return ok("bigquery", `Found ${tables.length} table(s) in BigQuery project ${projectId}.`, tables);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return fail("bigquery", `Could not introspect BigQuery: ${detail.slice(0, 180)}`);
  }
}

// ─── Snowflake ───────────────────────────────────────────────────────────────

function snowflakeHost(account: string): string {
  const trimmed = account.trim();
  if (trimmed.includes("snowflakecomputing.com")) return trimmed.replace(/^https?:\/\//, "");
  return `${trimmed}.snowflakecomputing.com`;
}

function snowflakeAccountLocator(account: string): string {
  return account.split(".")[0] ?? account;
}

function snowflakeJwt(
  account: string,
  username: string,
  privateKeyPem: string,
  passphrase?: string
): string {
  const privateKey = createPrivateKey({
    key: privateKeyPem,
    passphrase: passphrase?.trim() || undefined,
    format: "pem",
  });
  const publicKeyDer = createPublicKey(privateKey).export({ type: "spki", format: "der" });
  const fingerprint = `SHA256:${createHash("sha256").update(publicKeyDer).digest("base64")}`;
  const accountUpper = account.toUpperCase();
  const userUpper = username.toUpperCase();
  const issuer = `${accountUpper}.${userUpper}.${fingerprint}`;
  const subject = `${accountUpper}.${userUpper}`;
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss: issuer, sub: subject, iat: now, exp: now + 3600 })
  ).toString("base64url");
  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  return `${header}.${payload}.${sign.sign(privateKey, "base64url")}`;
}

async function snowflakeSessionToken(
  host: string,
  account: string,
  username: string,
  password: string,
  warehouse: string,
  database: string,
  role?: string
): Promise<string> {
  const params = new URLSearchParams({
    warehouseName: warehouse,
    databaseName: database,
    schemaName: "PUBLIC",
  });
  if (role?.trim()) params.set("roleName", role.trim());

  const res = await fetch(`https://${host}/session/v1/login-request?${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      data: {
        CLIENT_APP_ID: "eltpulse",
        CLIENT_APP_VERSION: "1.0",
        ACCOUNT_NAME: snowflakeAccountLocator(account),
        LOGIN_NAME: username,
        PASSWORD: password,
      },
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const body = (await res.json()) as {
    success?: boolean;
    message?: string;
    data?: { token?: string; sessionToken?: string };
  };
  const token = body.data?.token ?? body.data?.sessionToken;
  if (!res.ok || !body.success || !token) {
    throw new Error(body.message ?? `Snowflake login failed (${res.status}).`);
  }
  return token;
}

async function snowflakeRunQuery(
  host: string,
  sql: string,
  auth: { type: "jwt"; token: string } | { type: "session"; token: string },
  context: { warehouse: string; database: string; role?: string; schema?: string }
): Promise<string[][]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Snowflake-Authorization-Token-Type": auth.type === "jwt" ? "KEYPAIR_JWT" : "SESSION_TOKEN",
    Authorization: `Snowflake Token="${auth.token}"`,
  };

  const res = await fetch(`https://${host}/queries/v1/query-request?requestId=${randomUUID()}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      sqlText: sql,
      asyncExec: false,
      warehouse: context.warehouse,
      database: context.database,
      schema: context.schema?.trim() || "PUBLIC",
      ...(context.role?.trim() ? { role: context.role.trim() } : {}),
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const body = (await res.json()) as {
    success?: boolean;
    message?: string;
    data?: { rowtype?: { name: string }[]; rowset?: string[][] };
  };
  if (!res.ok || body.success === false) {
    throw new Error(body.message ?? `Snowflake query failed (${res.status}).`);
  }
  return body.data?.rowset ?? [];
}

export async function introspectSnowflake(
  secrets: Record<string, string>,
  config: Record<string, unknown>
): Promise<WarehouseIntrospectionResult> {
  const account = secret(secrets, "SNOWFLAKE_ACCOUNT") || configString(config, "account");
  const username = secret(secrets, "SNOWFLAKE_USER") || configString(config, "username");
  const warehouse = secret(secrets, "SNOWFLAKE_WAREHOUSE") || configString(config, "warehouse");
  const database = secret(secrets, "SNOWFLAKE_DATABASE") || configString(config, "database");
  const role = secret(secrets, "SNOWFLAKE_ROLE") || configString(config, "role");
  const authMethod = secret(secrets, "SNOWFLAKE_AUTH_METHOD") || "password";

  if (!account || !username || !warehouse || !database) {
    return fail("snowflake", "Snowflake connection needs account, user, warehouse, and database.");
  }

  const host = snowflakeHost(account);
  const sql = `SELECT table_schema, table_name FROM ${database}.information_schema.tables WHERE table_type = 'BASE TABLE' LIMIT ${TABLE_LIMIT}`;

  try {
    let rowset: string[][] = [];
    if (authMethod === "keypair") {
      const privateKey = secret(secrets, "SNOWFLAKE_PRIVATE_KEY");
      if (!privateKey) return fail("snowflake", "Set SNOWFLAKE_PRIVATE_KEY for key-pair authentication.");
      const jwt = snowflakeJwt(account, username, privateKey, secret(secrets, "SNOWFLAKE_PRIVATE_KEY_PASSPHRASE"));
      rowset = await snowflakeRunQuery(
        host,
        sql,
        { type: "jwt", token: jwt },
        { warehouse, database, role }
      );
    } else {
      const password = secret(secrets, "SNOWFLAKE_PASSWORD");
      if (!password) return fail("snowflake", "Set SNOWFLAKE_PASSWORD for Snowflake authentication.");
      const session = await snowflakeSessionToken(host, account, username, password, warehouse, database, role);
      rowset = await snowflakeRunQuery(
        host,
        sql,
        { type: "session", token: session },
        { warehouse, database, role }
      );
    }

    const tables = rowset.map((row) => ({
      schema: String(row[0] ?? ""),
      table: String(row[1] ?? ""),
      qualified: `${row[0]}.${row[1]}`,
    }));
    return ok("snowflake", `Found ${tables.length} table(s) in Snowflake database ${database}.`, tables);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return fail("snowflake", `Could not introspect Snowflake: ${detail.slice(0, 180)}`);
  }
}

/** Run a read-only SQL statement against Snowflake (internal + catalog sample queries). */
export async function runSnowflakeReadOnlyQuery(
  secrets: Record<string, string>,
  config: Record<string, unknown>,
  sql: string,
  opts?: { schema?: string }
): Promise<{ columns: string[]; rows: string[][] }> {
  const account = secret(secrets, "SNOWFLAKE_ACCOUNT") || configString(config, "account");
  const username = secret(secrets, "SNOWFLAKE_USER") || configString(config, "username");
  const warehouse = secret(secrets, "SNOWFLAKE_WAREHOUSE") || configString(config, "warehouse");
  const database = secret(secrets, "SNOWFLAKE_DATABASE") || configString(config, "database");
  const role = secret(secrets, "SNOWFLAKE_ROLE") || configString(config, "role");
  const authMethod = secret(secrets, "SNOWFLAKE_AUTH_METHOD") || "password";
  const schema = opts?.schema?.trim() || secret(secrets, "SNOWFLAKE_SCHEMA") || configString(config, "schema") || "PUBLIC";

  if (!account || !username || !warehouse || !database) {
    throw new Error("Snowflake connection needs account, user, warehouse, and database.");
  }

  const host = snowflakeHost(account);
  const context = { warehouse, database, role, schema };

  let rowset: string[][] = [];
  if (authMethod === "keypair") {
    const privateKey = secret(secrets, "SNOWFLAKE_PRIVATE_KEY");
    if (!privateKey) throw new Error("Set SNOWFLAKE_PRIVATE_KEY for key-pair authentication.");
    const jwt = snowflakeJwt(account, username, privateKey, secret(secrets, "SNOWFLAKE_PRIVATE_KEY_PASSPHRASE"));
    rowset = await snowflakeRunQuery(host, sql, { type: "jwt", token: jwt }, context);
  } else {
    const password = secret(secrets, "SNOWFLAKE_PASSWORD");
    if (!password) throw new Error("Set SNOWFLAKE_PASSWORD for Snowflake authentication.");
    const session = await snowflakeSessionToken(host, account, username, password, warehouse, database, role);
    rowset = await snowflakeRunQuery(host, sql, { type: "session", token: session }, context);
  }

  const columns = rowset.length > 0 ? rowset[0].map((_, i) => `col_${i}`) : [];
  return { columns, rows: rowset };
}

// ─── Databricks ──────────────────────────────────────────────────────────────

function databricksWarehouseId(httpPath: string): string | null {
  const match = httpPath.match(/warehouses\/([^/?]+)/i);
  return match?.[1] ?? null;
}

async function pollDatabricksStatement(
  host: string,
  token: string,
  statementId: string
): Promise<WarehouseQueryRowset> {
  const deadline = Date.now() + FETCH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(`https://${host}/api/2.0/sql/statements/${statementId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const body = (await res.json()) as {
      status?: { state?: string; error?: { message?: string } };
      manifest?: { schema?: { columns?: { name?: string; position?: number }[] } };
      result?: { data_array?: string[][] };
    };
    const state = body.status?.state;
    if (state === "SUCCEEDED") {
      const columns = (body.manifest?.schema?.columns ?? [])
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((c) => String(c.name ?? ""))
        .filter(Boolean);
      const rows = (body.result?.data_array ?? []) as unknown[][];
      if (!columns.length && rows[0]?.length) {
        return {
          columns: Array.from({ length: rows[0].length }, (_, i) => `col_${i}`),
          rows,
        };
      }
      return { columns, rows };
    }
    if (state === "FAILED" || state === "CANCELED") {
      throw new Error(body.status?.error?.message ?? `Databricks statement ${state?.toLowerCase()}.`);
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error("Databricks statement timed out.");
}

export async function runDatabricksReadOnlyQuery(
  secrets: Record<string, string>,
  config: Record<string, unknown>,
  sql: string
): Promise<WarehouseQueryRowset> {
  const host = (secret(secrets, "DATABRICKS_HOST") || configString(config, "host")).replace(/^https?:\/\//, "");
  const token = secret(secrets, "DATABRICKS_TOKEN");
  const httpPath = secret(secrets, "DATABRICKS_HTTP_PATH") || configString(config, "http_path");
  if (!host || !token || !httpPath) {
    throw new Error("Databricks needs host, access token, and SQL warehouse HTTP path.");
  }
  const warehouseId = databricksWarehouseId(httpPath);
  if (!warehouseId) throw new Error("Could not parse warehouse id from DATABRICKS_HTTP_PATH.");

  const res = await fetch(`https://${host}/api/2.0/sql/statements`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      warehouse_id: warehouseId,
      statement: sql,
      wait_timeout: "30s",
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const body = (await res.json()) as { statement_id?: string; status?: { state?: string } };
  if (!res.ok || !body.statement_id) {
    throw new Error(`Databricks SQL API returned ${res.status}.`);
  }
  return pollDatabricksStatement(host, token, body.statement_id);
}

export async function introspectDatabricks(
  secrets: Record<string, string>,
  config: Record<string, unknown>
): Promise<WarehouseIntrospectionResult> {
  const host = (secret(secrets, "DATABRICKS_HOST") || configString(config, "host")).replace(/^https?:\/\//, "");
  const token = secret(secrets, "DATABRICKS_TOKEN");
  const httpPath = secret(secrets, "DATABRICKS_HTTP_PATH") || configString(config, "http_path");
  const catalog = secret(secrets, "DATABRICKS_CATALOG") || configString(config, "catalog") || "main";

  if (!host || !token || !httpPath) {
    return fail("databricks", "Databricks needs host, access token, and SQL warehouse HTTP path.");
  }
  const warehouseId = databricksWarehouseId(httpPath);
  if (!warehouseId) {
    return fail("databricks", "Could not parse warehouse id from DATABRICKS_HTTP_PATH.");
  }

  try {
    const res = await fetch(`https://${host}/api/2.0/sql/statements`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        warehouse_id: warehouseId,
        statement: `SELECT table_schema, table_name FROM ${catalog}.information_schema.tables WHERE table_type IN ('MANAGED', 'EXTERNAL', 'VIEW') LIMIT ${TABLE_LIMIT}`,
        wait_timeout: "30s",
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const body = (await res.json()) as { statement_id?: string; status?: { state?: string } };
    if (!res.ok || !body.statement_id) {
      return fail("databricks", `Databricks SQL API returned ${res.status}.`);
    }
    const rowset = await pollDatabricksStatement(host, token, body.statement_id);
    const tables = rowset.rows.map((row) => ({
      schema: String(row[0] ?? ""),
      table: String(row[1] ?? ""),
      qualified: `${row[0]}.${row[1]}`,
    }));
    return ok("databricks", `Found ${tables.length} table(s) in Databricks catalog ${catalog}.`, tables);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return fail("databricks", `Could not introspect Databricks: ${detail.slice(0, 180)}`);
  }
}

// ─── ClickHouse ──────────────────────────────────────────────────────────────

export async function introspectClickhouse(
  secrets: Record<string, string>,
  config: Record<string, unknown>
): Promise<WarehouseIntrospectionResult> {
  const host = secret(secrets, "CLICKHOUSE_HOST") || configString(config, "host");
  const port = secret(secrets, "CLICKHOUSE_PORT") || configString(config, "port") || "8123";
  const user = secret(secrets, "CLICKHOUSE_USER") || configString(config, "username") || "default";
  const password = secret(secrets, "CLICKHOUSE_PASSWORD");
  const database = secret(secrets, "CLICKHOUSE_DATABASE") || configString(config, "database");

  if (!host) return fail("clickhouse", "Set CLICKHOUSE_HOST to verify ClickHouse tables.");

  const sql = `SELECT database, name FROM system.tables WHERE database NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema') LIMIT ${TABLE_LIMIT} FORMAT JSON`;
  const url = new URL(`http://${host}:${port}/`);
  url.searchParams.set("query", sql);
  if (database) url.searchParams.set("database", database);

  const headers: Record<string, string> = {};
  if (user) {
    const auth = password ? `${user}:${password}` : user;
    headers.Authorization = `Basic ${Buffer.from(auth).toString("base64")}`;
  }

  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return fail("clickhouse", `ClickHouse HTTP API returned ${res.status}.`);
    const body = (await res.json()) as { data?: [string, string][] };
    const tables = (body.data ?? []).map(([schema, table]) => ({
      schema,
      table,
      qualified: `${schema}.${table}`,
    }));
    return ok("clickhouse", `Found ${tables.length} table(s) in ClickHouse.`, tables);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return fail("clickhouse", `Could not introspect ClickHouse: ${detail.slice(0, 180)}`);
  }
}

export async function runClickhouseReadOnlyQuery(
  secrets: Record<string, string>,
  config: Record<string, unknown>,
  sql: string
): Promise<WarehouseQueryRowset> {
  const host = secret(secrets, "CLICKHOUSE_HOST") || configString(config, "host");
  const port = secret(secrets, "CLICKHOUSE_PORT") || configString(config, "port") || "8123";
  const user = secret(secrets, "CLICKHOUSE_USER") || configString(config, "username") || "default";
  const password = secret(secrets, "CLICKHOUSE_PASSWORD");
  const database = secret(secrets, "CLICKHOUSE_DATABASE") || configString(config, "database");

  if (!host) throw new Error("Set CLICKHOUSE_HOST to query ClickHouse.");

  const query = /\bformat\s+json\b/i.test(sql) ? sql : `${sql.trim().replace(/;\s*$/, "")} FORMAT JSON`;
  const url = new URL(`http://${host}:${port}/`);
  url.searchParams.set("query", query);
  if (database) url.searchParams.set("database", database);

  const headers: Record<string, string> = {};
  if (user) {
    const auth = password ? `${user}:${password}` : user;
    headers.Authorization = `Basic ${Buffer.from(auth).toString("base64")}`;
  }

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`ClickHouse HTTP API returned ${res.status}.`);
  const body = (await res.json()) as { meta?: { name?: string }[]; data?: unknown[][] };
  const columns = (body.meta ?? []).map((m) => String(m.name ?? "")).filter(Boolean);
  const rows = body.data ?? [];
  if (!columns.length && rows[0]?.length) {
    return {
      columns: Array.from({ length: rows[0].length }, (_, i) => `col_${i}`),
      rows,
    };
  }
  return { columns, rows };
}

// ─── MySQL ───────────────────────────────────────────────────────────────────

export async function introspectMysql(
  secrets: Record<string, string>,
  config: Record<string, unknown>
): Promise<WarehouseIntrospectionResult> {
  const host = secret(secrets, "DEST_MYSQL_HOST", "MYSQL_HOST") || configString(config, "host");
  const port = Number(secret(secrets, "DEST_MYSQL_PORT", "MYSQL_PORT") || configString(config, "port") || "3306");
  const database = secret(secrets, "DEST_MYSQL_DATABASE", "MYSQL_DATABASE") || configString(config, "database");
  const user = secret(secrets, "DEST_MYSQL_USER", "MYSQL_USER") || configString(config, "username");
  const password = secret(secrets, "DEST_MYSQL_PASSWORD", "MYSQL_PASSWORD");

  if (!host || !database || !user || !password) {
    return fail("mysql", "MySQL destination needs host, database, user, and password.");
  }

  try {
    const mysql = await import(/* webpackIgnore: true */ "mysql2/promise");
    const conn = await mysql.createConnection({
      host,
      port,
      database,
      user,
      password,
      connectTimeout: 12_000,
    });
    const [rows] = await conn.query(
      `SELECT table_schema AS TABLE_SCHEMA, table_name AS TABLE_NAME
       FROM information_schema.tables
       WHERE table_schema NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
         AND table_type = 'BASE TABLE'
       ORDER BY table_schema, table_name
       LIMIT ${TABLE_LIMIT}`
    );
    await conn.end();
    const tableRows = rows as { TABLE_SCHEMA: string; TABLE_NAME: string }[];
    const tables = tableRows.map((r) => ({
      schema: r.TABLE_SCHEMA,
      table: r.TABLE_NAME,
      qualified: `${r.TABLE_SCHEMA}.${r.TABLE_NAME}`,
    }));
    return ok("mysql", `Found ${tables.length} table(s) in MySQL.`, tables);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return fail("mysql", `Could not introspect MySQL: ${detail.slice(0, 180)}`);
  }
}

export async function runMysqlReadOnlyQuery(
  secrets: Record<string, string>,
  config: Record<string, unknown>,
  sql: string
): Promise<WarehouseQueryRowset> {
  const host = secret(secrets, "DEST_MYSQL_HOST", "MYSQL_HOST") || configString(config, "host");
  const port = Number(secret(secrets, "DEST_MYSQL_PORT", "MYSQL_PORT") || configString(config, "port") || "3306");
  const database = secret(secrets, "DEST_MYSQL_DATABASE", "MYSQL_DATABASE") || configString(config, "database");
  const user = secret(secrets, "DEST_MYSQL_USER", "MYSQL_USER") || configString(config, "username");
  const password = secret(secrets, "DEST_MYSQL_PASSWORD", "MYSQL_PASSWORD");

  if (!host || !database || !user || !password) {
    throw new Error("MySQL destination needs host, database, user, and password.");
  }

  const mysql = await import(/* webpackIgnore: true */ "mysql2/promise");
  const conn = await mysql.createConnection({
    host,
    port,
    database,
    user,
    password,
    connectTimeout: 12_000,
  });
  try {
    const [rows, fields] = await conn.query(sql);
    const columns = Array.isArray(fields) ? fields.map((f) => String(f.name)) : [];
    const dataRows = Array.isArray(rows)
      ? (rows as Record<string, unknown>[]).map((r) => columns.map((c) => r[c] ?? null))
      : [];
    return { columns, rows: dataRows };
  } finally {
    await conn.end();
  }
}

// ─── Trino ───────────────────────────────────────────────────────────────────

async function trinoExecuteQuery(startUrl: string, user: string): Promise<WarehouseQueryRowset> {
  let columns: string[] = [];
  const rows: unknown[][] = [];
  let nextUri: string | null = startUrl;
  let capturedColumns = false;
  while (nextUri) {
    const res = await fetch(nextUri, {
      method: "GET",
      headers: { "X-Trino-User": user, Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const body = (await res.json()) as {
      error?: { message?: string };
      columns?: { name?: string }[];
      data?: unknown[][];
      nextUri?: string | null;
    };
    if (body.error?.message) throw new Error(body.error.message);
    if (!capturedColumns && body.columns?.length) {
      columns = body.columns.map((c) => String(c.name ?? "")).filter(Boolean);
      capturedColumns = true;
    }
    if (body.data?.length) rows.push(...body.data);
    nextUri = body.nextUri ?? null;
  }
  if (!columns.length && rows[0]?.length) {
    columns = Array.from({ length: rows[0].length }, (_, i) => `col_${i}`);
  }
  return { columns, rows };
}

async function trinoFetchAllRows(
  startUrl: string,
  user: string
): Promise<string[][]> {
  const rowset = await trinoExecuteQuery(startUrl, user);
  return rowset.rows.slice(0, TABLE_LIMIT).map((row) => row.map(String));
}

export async function runTrinoReadOnlyQuery(
  secrets: Record<string, string>,
  config: Record<string, unknown>,
  sql: string
): Promise<WarehouseQueryRowset> {
  const host = secret(secrets, "TRINO_HOST") || configString(config, "host");
  const port = secret(secrets, "TRINO_PORT") || configString(config, "port") || "8080";
  const user = secret(secrets, "TRINO_USER") || configString(config, "username") || "trino";
  const catalog = secret(secrets, "TRINO_CATALOG") || configString(config, "catalog");
  const schema = secret(secrets, "TRINO_SCHEMA") || configString(config, "schema") || "default";

  if (!host || !catalog) {
    throw new Error("Trino destination needs host and catalog.");
  }

  const statementUrl = `http://${host}:${port}/v1/statement`;
  const res = await fetch(statementUrl, {
    method: "POST",
    headers: {
      "X-Trino-User": user,
      "X-Trino-Catalog": catalog,
      "X-Trino-Schema": schema,
      "Content-Type": "text/plain",
    },
    body: sql,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const first = (await res.json()) as { id?: string; nextUri?: string; error?: { message?: string } };
  if (first.error?.message) throw new Error(first.error.message);
  const start =
    first.nextUri ??
    (first.id ? `${statementUrl.replace(/\/statement$/, "")}/statement/${first.id}` : null);
  if (!start) throw new Error("Trino returned no statement handle.");
  return trinoExecuteQuery(start, user);
}

export async function introspectTrino(
  secrets: Record<string, string>,
  config: Record<string, unknown>
): Promise<WarehouseIntrospectionResult> {
  const host = secret(secrets, "TRINO_HOST") || configString(config, "host");
  const port = secret(secrets, "TRINO_PORT") || configString(config, "port") || "8080";
  const user = secret(secrets, "TRINO_USER") || configString(config, "username") || "trino";
  const catalog = secret(secrets, "TRINO_CATALOG") || configString(config, "catalog");
  const schema = secret(secrets, "TRINO_SCHEMA") || configString(config, "schema") || "default";

  if (!host || !catalog) {
    return fail("trino", "Trino destination needs host and catalog.");
  }

  const statementUrl = `http://${host}:${port}/v1/statement`;
  const sql = `SELECT table_schema, table_name FROM ${catalog}.information_schema.tables WHERE table_schema = '${schema.replace(/'/g, "''")}' AND table_type = 'BASE TABLE' LIMIT ${TABLE_LIMIT}`;

  try {
    const res = await fetch(statementUrl, {
      method: "POST",
      headers: {
        "X-Trino-User": user,
        "X-Trino-Catalog": catalog,
        "X-Trino-Schema": schema,
        "Content-Type": "text/plain",
      },
      body: sql,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const first = (await res.json()) as { id?: string; nextUri?: string; error?: { message?: string } };
    if (first.error?.message) throw new Error(first.error.message);
    const start = first.nextUri ?? (first.id ? `${statementUrl.replace(/\/statement$/, "")}/statement/${first.id}` : null);
    if (!start) return fail("trino", "Trino returned no statement handle.");

    const rowset = await trinoFetchAllRows(start, user);
    const tables = rowset.map((row) => ({
      schema: String(row[0] ?? schema),
      table: String(row[1] ?? ""),
      qualified: `${row[0] ?? schema}.${row[1] ?? ""}`,
    }));
    return ok("trino", `Found ${tables.length} table(s) in Trino catalog ${catalog}.`, tables);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return fail("trino", `Could not introspect Trino: ${detail.slice(0, 180)}`);
  }
}

// ─── MotherDuck (HTTP SQL API) ───────────────────────────────────────────────

type MotherDuckSqlResponse = {
  rows?: unknown[];
  data?: unknown[];
  columns?: { name?: string }[] | string[];
  columnNames?: string[];
  fields?: ({ name?: string } | string)[];
  schema?: { columns?: ({ name?: string } | string)[] } | Array<{ name?: string; type?: unknown }>;
  success?: boolean;
  result?: MotherDuckSqlResponse;
  error?: string;
  message?: string;
  errMessage?: string;
  mdFriendlyStatusCode?: string;
};

export function motherduckScopedSql(database: string, sql: string): string {
  const db = database.trim();
  if (!db) return sql;
  if (/^\s*use\s+/i.test(sql)) return sql;
  return `USE "${db.replace(/"/g, '""')}";\n${sql}`;
}

/** Request body for MotherDuck SQL API — USE prefix matches notebook/catalog scoping. */
export function motherduckQueryPayload(database: string, sql: string): { sql: string; database?: string } {
  const db = database.trim();
  if (!db || /^\s*use\s+/i.test(sql)) return { sql };
  return { sql: motherduckScopedSql(db, sql) };
}

function motherduckColumnNames(rawCols: Array<string | { name?: string }>): string[] {
  return rawCols
    .map((c) => (typeof c === "string" ? c : String(c.name ?? "")))
    .filter(Boolean);
}

/** MotherDuck HTTP API may return rows as arrays or JSON objects — normalize to arrays. */
export function normalizeMotherduckRows(rawRows: unknown[], columnNames: string[]): unknown[][] {
  const out: unknown[][] = [];
  for (const row of rawRows) {
    if (Array.isArray(row)) {
      out.push(row);
      continue;
    }
    if (row && typeof row === "object") {
      const obj = row as Record<string, unknown>;
      if (columnNames.length) {
        const lower = new Map(columnNames.map((c) => [c.toLowerCase(), c]));
        out.push(
          columnNames.map((col) => {
            if (col in obj) return obj[col];
            const key = lower.get(col.toLowerCase());
            return key ? obj[key] : undefined;
          })
        );
        continue;
      }
      out.push(Object.values(obj));
    }
  }
  return out;
}

export function parseMotherduckSqlResponse(body: MotherDuckSqlResponse): MotherduckQueryRowset {
  const payload =
    body && typeof body === "object" && body.result && typeof body.result === "object"
      ? (body.result as MotherDuckSqlResponse)
      : body;

  const rawRows = payload.rows ?? payload.data ?? [];
  const rawRowsArr = Array.isArray(rawRows) ? rawRows : [];
  type ColumnRef = string | { name?: string };
  let rawCols: ColumnRef[] = payload.columns ?? (payload as { columnNames?: string[] }).columnNames ?? [];
  if (rawCols.length === 0 && payload.schema && typeof payload.schema === "object" && "columns" in payload.schema) {
    rawCols = payload.schema.columns ?? [];
  } else if (rawCols.length === 0 && Array.isArray(payload.schema)) {
    rawCols = payload.schema.map((c) => (typeof c === "object" && c ? c.name ?? "" : String(c)));
  }
  let columns = motherduckColumnNames(rawCols);

  if (columns.length === 0 && rawRowsArr.length > 0) {
    const first = rawRowsArr[0];
    if (first && typeof first === "object" && !Array.isArray(first)) {
      columns = Object.keys(first as Record<string, unknown>);
    }
  }

  let rows = normalizeMotherduckRows(rawRowsArr, columns);

  if (columns.length === 0 && rows.length > 0) {
    const width = rows[0]?.length ?? 0;
    columns = Array.from({ length: width }, (_, i) => `col_${i}`);
  }

  if (columns.length === 0 && rows.length === 0 && Array.isArray(payload.fields)) {
    columns = motherduckColumnNames(payload.fields);
  }

  return { columns, rows };
}

export function motherduckDatabaseName(
  secrets: Record<string, string>,
  config: Record<string, unknown>
): string {
  // Prefer connection config (and per-query overrides) over merged env secrets so
  // cross-catalog discovery can query my_db while the saved profile says eltpulse.
  return (
    configString(config, "database") ||
    secret(secrets, "MOTHERDUCK_DATABASE", "DESTINATION__MOTHERDUCK__CREDENTIALS__DATABASE") ||
    STARTER_WAREHOUSE_DEFAULT_DB
  );
}

/** Run a read-only SQL statement against MotherDuck via the HTTP API. */
export async function runMotherduckReadOnlyQuery(
  secrets: Record<string, string>,
  config: Record<string, unknown>,
  sql: string
): Promise<MotherduckQueryRowset> {
  const token = secret(secrets, "MOTHERDUCK_TOKEN");
  const database = motherduckDatabaseName(secrets, config);
  if (!token) throw new Error("Set MOTHERDUCK_TOKEN to query MotherDuck.");

  const res = await fetch("https://api.motherduck.com/v1/sql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(motherduckQueryPayload(database, sql)),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const body = await readFetchJsonBody<
    MotherDuckSqlResponse & { detail?: string; errMessage?: string; mdFriendlyStatusCode?: string }
  >(res);
  if (body.success === false) {
    throw new Error(body.error ?? body.message ?? "MotherDuck query failed.");
  }
  if (!res.ok || body.errMessage || body.error) {
    const detail = body.errMessage ?? body.error ?? body.message ?? body.detail;
    if (res.status === 404 || body.mdFriendlyStatusCode === "NOT_FOUND") {
      throw new Error(
        `MotherDuck database "${database}" was not found. Set Database on your destination connection to the database where dlt loaded data (often "${STARTER_WAREHOUSE_DEFAULT_DB}" or "my_db").`
      );
    }
    throw new Error(detail ?? `MotherDuck API returned ${res.status}.`);
  }
  return parseMotherduckSqlResponse(body);
}

export async function introspectMotherduck(
  secrets: Record<string, string>,
  config: Record<string, unknown>
): Promise<WarehouseIntrospectionResult> {
  const token = secret(secrets, "MOTHERDUCK_TOKEN");
  const database = motherduckDatabaseName(secrets, config);

  if (!token) return fail("motherduck", "Set MOTHERDUCK_TOKEN to verify MotherDuck tables.");

  const sql = `SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog') AND table_type = 'BASE TABLE' LIMIT ${TABLE_LIMIT}`;

  try {
    const rowset = await runMotherduckReadOnlyQuery(secrets, config, sql);
    const tables = rowset.rows.map((row) => ({
      schema: String(row[0] ?? "main"),
      table: String(row[1] ?? ""),
      qualified: `${row[0] ?? "main"}.${row[1] ?? ""}`,
    }));
    return ok("motherduck", `Found ${tables.length} table(s) in MotherDuck database ${database}.`, tables);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return fail("motherduck", `Could not introspect MotherDuck: ${detail.slice(0, 180)}`);
  }
}

// ─── DuckDB / SQLite (file or cloud URI — requires duckdb on this host) ──────

async function introspectDuckdbFile(
  connector: string,
  dbPath: string
): Promise<WarehouseIntrospectionResult> {
  if (!dbPath.trim()) {
    return fail(
      connector,
      connector === "sqlite"
        ? "Set a database path on the connection to verify SQLite tables."
        : "Set a database location on the connection (cloud URI or leave empty for managed internal storage), or use MotherDuck for hosted DuckDB."
    );
  }

  try {
    const duckdb = await import(/* webpackIgnore: true */ "duckdb");
    const { Database } = duckdb.default ?? duckdb;
    const db = new Database(dbPath, { access_mode: "READ_ONLY" });
    const conn = db.connect();
    const rows = await new Promise<string[][]>((resolve, reject) => {
      conn.all(
        `SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog') AND table_type = 'BASE TABLE' LIMIT ${TABLE_LIMIT}`,
        (err: Error | null, result: unknown) => {
          if (err) reject(err);
          else {
            const typed = (result ?? []) as { table_schema: string; table_name: string }[];
            resolve(typed.map((r) => [r.table_schema, r.table_name]));
          }
        }
      );
    });
    conn.close();
    db.close();
    const tables = rows.map(([schema, table]) => ({
      schema,
      table,
      qualified: `${schema}.${table}`,
    }));
    const label = connector === "sqlite" ? "SQLite" : "DuckDB";
    const scope = /^[a-z][a-z0-9+.-]*:\/\//i.test(dbPath) ? "remote" : "local";
    return ok(connector, `Found ${tables.length} table(s) in ${scope} ${label} database.`, tables);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    const hint =
      detail.includes("Cannot find module") || detail.includes("duckdb")
        ? " Local file introspection runs on your gateway or managed worker where the database file exists."
        : "";
    return fail(connector, `Could not introspect ${connector}: ${detail.slice(0, 160)}.${hint}`);
  }
}

export async function runDuckdbFileReadOnlyQuery(
  dbPath: string,
  sql: string
): Promise<WarehouseQueryRowset> {
  if (!dbPath.trim()) {
    throw new Error("Set a database path or location to query DuckDB/SQLite.");
  }

  const duckdb = await import(/* webpackIgnore: true */ "duckdb");
  const { Database } = duckdb.default ?? duckdb;
  const db = new Database(dbPath, { access_mode: "READ_ONLY" });
  const conn = db.connect();
  try {
    const result = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
      conn.all(sql, (err: Error | null, rows: unknown) => {
        if (err) reject(err);
        else resolve((rows ?? []) as Record<string, unknown>[]);
      });
    });
    if (!result.length) return { columns: [], rows: [] };
    const columns = Object.keys(result[0]!);
    return {
      columns,
      rows: result.map((row) => columns.map((col) => row[col] ?? null)),
    };
  } finally {
    conn.close();
    db.close();
  }
}

export async function runDuckdbReadOnlyQuery(
  secrets: Record<string, string>,
  config: Record<string, unknown>,
  sql: string
): Promise<WarehouseQueryRowset> {
  return runDuckdbFileReadOnlyQuery(resolveDuckdbDatabaseLocation(secrets, config), sql);
}

export async function runSqliteReadOnlyQuery(
  secrets: Record<string, string>,
  config: Record<string, unknown>,
  sql: string
): Promise<WarehouseQueryRowset> {
  const dbPath = secret(secrets, "DEST_SQLITE_PATH") || configString(config, "path");
  return runDuckdbFileReadOnlyQuery(dbPath, sql);
}

export async function introspectDuckdb(
  secrets: Record<string, string>,
  config: Record<string, unknown>
): Promise<WarehouseIntrospectionResult> {
  return introspectDuckdbFile("duckdb", resolveDuckdbDatabaseLocation(secrets, config));
}

export async function introspectSqlite(
  secrets: Record<string, string>,
  config: Record<string, unknown>
): Promise<WarehouseIntrospectionResult> {
  const dbPath = secret(secrets, "DEST_SQLITE_PATH") || configString(config, "path");
  return introspectDuckdbFile("sqlite", dbPath);
}

// ─── Object stores (S3, GCS) ─────────────────────────────────────────────────

export async function introspectS3(
  secrets: Record<string, string>,
  config: Record<string, unknown>
): Promise<WarehouseIntrospectionResult> {
  const accessKey = secret(secrets, "AWS_ACCESS_KEY_ID");
  const secretKey = secret(secrets, "AWS_SECRET_ACCESS_KEY");
  const region = secret(secrets, "AWS_REGION") || configString(config, "region") || "us-east-1";
  const bucket = configString(config, "bucket", "target_bucket");
  const prefix = configString(config, "prefix", "path");

  if (!accessKey || !secretKey || !bucket) {
    return fail("s3", "S3 destination needs AWS credentials and bucket in connection config.");
  }

  try {
    const { S3Client, ListObjectsV2Command } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });
    const tables: WarehouseTableRef[] = [];
    let token: string | undefined;
    do {
      const res = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix || undefined,
          MaxKeys: 1000,
          ContinuationToken: token,
        })
      );
      for (const obj of res.Contents ?? []) {
        const key = obj.Key ?? "";
        if (!key || key.endsWith("/")) continue;
        tables.push({
          schema: bucket,
          table: key,
          qualified: `s3://${bucket}/${key}`,
        });
        if (tables.length >= TABLE_LIMIT) break;
      }
      token = res.NextContinuationToken;
    } while (token && tables.length < TABLE_LIMIT);

    return ok("s3", `Found ${tables.length} object(s) in s3://${bucket}${prefix ? `/${prefix}` : ""}.`, tables);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return fail("s3", `Could not list S3 objects: ${detail.slice(0, 180)}`);
  }
}

export async function introspectGcs(
  secrets: Record<string, string>,
  config: Record<string, unknown>
): Promise<WarehouseIntrospectionResult> {
  const credentials =
    secret(secrets, "GCS_CREDENTIALS", "GOOGLE_APPLICATION_CREDENTIALS") || configString(config, "credentials");
  const bucket = configString(config, "bucket");
  const prefix = configString(config, "prefix", "path");

  if (!credentials || !bucket) {
    return fail("gcs", "GCS destination needs service account JSON and bucket.");
  }

  try {
    const token = await fetchGcpAccessToken(credentials, "https://www.googleapis.com/auth/devstorage.read_only");
    const tables: WarehouseTableRef[] = [];
    let pageToken: string | undefined;
    do {
      const url = new URL(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o`);
      if (prefix) url.searchParams.set("prefix", prefix);
      url.searchParams.set("maxResults", "1000");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) return fail("gcs", `GCS list API returned ${res.status}.`);
      const body = (await res.json()) as { items?: { name: string }[]; nextPageToken?: string };
      for (const item of body.items ?? []) {
        if (!item.name || item.name.endsWith("/")) continue;
        tables.push({
          schema: bucket,
          table: item.name,
          qualified: `gs://${bucket}/${item.name}`,
        });
        if (tables.length >= TABLE_LIMIT) break;
      }
      pageToken = body.nextPageToken;
    } while (pageToken && tables.length < TABLE_LIMIT);

    return ok("gcs", `Found ${tables.length} object(s) in gs://${bucket}${prefix ? `/${prefix}` : ""}.`, tables);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return fail("gcs", `Could not list GCS objects: ${detail.slice(0, 180)}`);
  }
}

export async function introspectFilesystem(
  secrets: Record<string, string>,
  config: Record<string, unknown>
): Promise<WarehouseIntrospectionResult> {
  const basePath =
    secret(secrets, "DEST_FILESYSTEM_PATH") || configString(config, "path", "output_directory");
  if (!basePath.trim()) {
    return fail("filesystem", "Set output directory path to verify filesystem objects.");
  }

  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const entries = await fs.readdir(basePath, { withFileTypes: true });
    const tables: WarehouseTableRef[] = [];
    for (const ent of entries) {
      if (!ent.isFile()) continue;
      const full = path.join(basePath, ent.name);
      tables.push({
        schema: basePath,
        table: ent.name,
        qualified: full,
      });
      if (tables.length >= TABLE_LIMIT) break;
    }
    return ok("filesystem", `Found ${tables.length} file(s) in ${basePath}.`, tables);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return fail(
      "filesystem",
      `Could not list filesystem path (must exist on the app host): ${detail.slice(0, 160)}`
    );
  }
}

function azureSharedKeySignature(
  accountName: string,
  accountKey: string,
  method: string,
  canonicalizedResource: string,
  headers: Record<string, string>
): string {
  const headerLines = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort()
    .map((k) => {
      const orig = Object.keys(headers).find((h) => h.toLowerCase() === k)!;
      return `${k}:${headers[orig]!.trim()}`;
    })
    .join("\n");
  const stringToSign = [
    method,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    headerLines ? `${headerLines}\n` : "",
    canonicalizedResource,
  ].join("\n");
  const key = Buffer.from(accountKey, "base64");
  return createHmac("sha256", key).update(stringToSign, "utf8").digest("base64");
}

async function listAzureBlobPage(
  accountName: string,
  accountKey: string,
  container: string,
  prefix: string,
  marker?: string
): Promise<{ names: string[]; nextMarker?: string }> {
  const date = new Date().toUTCString();
  const version = "2020-10-02";
  const params = new URLSearchParams({
    restype: "container",
    comp: "list",
    maxresults: "1000",
  });
  if (prefix) params.set("prefix", prefix);
  if (marker) params.set("marker", marker);
  const sorted = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
  const query = sorted.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  const url = `https://${accountName}.blob.core.windows.net/${container}?${query}`;

  const headers: Record<string, string> = {
    "x-ms-date": date,
    "x-ms-version": version,
  };
  const resourceLines = [`/${accountName}/${container}`, ...sorted.map(([k, v]) => `${k}:${v}`)].join("\n");
  const signature = azureSharedKeySignature(accountName, accountKey, "GET", resourceLines, headers);
  const res = await fetch(url, {
    headers: {
      ...headers,
      Authorization: `SharedKey ${accountName}:${signature}`,
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Azure Blob list returned ${res.status}`);
  }
  const xml = await res.text();
  const names: string[] = [];
  const nameRe = /<Name>([^<]+)<\/Name>/g;
  let match: RegExpExecArray | null;
  while ((match = nameRe.exec(xml)) !== null) {
    const name = match[1] ?? "";
    if (name && !name.endsWith("/")) names.push(name);
  }
  const nextMatch = xml.match(/<NextMarker>([^<]*)<\/NextMarker>/);
  const nextMarker = nextMatch?.[1]?.trim() || undefined;
  return { names, nextMarker: nextMarker || undefined };
}

export async function introspectAzureBlob(
  secrets: Record<string, string>,
  config: Record<string, unknown>
): Promise<WarehouseIntrospectionResult> {
  const accountName =
    secret(secrets, "AZURE_STORAGE_ACCOUNT_NAME") || configString(config, "account_name", "account");
  const accountKey = secret(secrets, "AZURE_STORAGE_ACCOUNT_KEY") || configString(config, "account_key");
  const container = configString(config, "container", "bucket");
  const prefix = configString(config, "prefix", "path");

  if (!accountName || !accountKey || !container) {
    return fail("azure_blob", "Azure Blob destination needs account name, key, and container.");
  }

  try {
    const tables: WarehouseTableRef[] = [];
    let marker: string | undefined;
    do {
      const page = await listAzureBlobPage(accountName, accountKey, container, prefix, marker);
      for (const name of page.names) {
        tables.push({
          schema: container,
          table: name,
          qualified: `azure://${container}/${name}`,
        });
        if (tables.length >= TABLE_LIMIT) break;
      }
      marker = page.nextMarker;
    } while (marker && tables.length < TABLE_LIMIT);

    return ok(
      "azure_blob",
      `Found ${tables.length} object(s) in az://${container}${prefix ? `/${prefix}` : ""}.`,
      tables
    );
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return fail("azure_blob", `Could not list Azure Blob objects: ${detail.slice(0, 180)}`);
  }
}
