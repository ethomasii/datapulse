/**
 * MotherDuck database resolution — find schema.table across catalogs when
 * the connection Database field points at the wrong catalog (eltpulse vs my_db).
 */

import { parseDuckdbTableRef } from "@/lib/elt/duckdb-table-ref";
import { STARTER_WAREHOUSE_DEFAULT_DB } from "@/lib/elt/starter-warehouse";
import {
  isMotherduckDatabaseAttachError,
  isMotherduckMissingObjectError,
} from "@/lib/elt/warehouse-column-errors";
import {
  executeMotherduckSql,
  motherduckDatabaseName,
  motherduckToken,
  type WarehouseQueryRowset,
} from "@/lib/elt/warehouse-introspect-connectors";

export function motherduckDatabaseCandidates(
  secrets: Record<string, string>,
  config: Record<string, unknown>,
  catalogFromRef?: string
): string[] {
  const configured = motherduckDatabaseName(secrets, config);
  const out: string[] = [];
  for (const db of [catalogFromRef, "my_db", configured, STARTER_WAREHOUSE_DEFAULT_DB]) {
    const d = db?.trim();
    if (d && !out.includes(d)) out.push(d);
  }
  return out;
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function rowsetFirstColumnValues(rowset: WarehouseQueryRowset, columnName: string): string[] {
  const nameIdx = rowset.columns.findIndex((c) => c.toLowerCase() === columnName.toLowerCase());
  const idx = nameIdx >= 0 ? nameIdx : 0;
  return rowset.rows
    .map((row) => String(row[idx] ?? "").trim())
    .filter(Boolean);
}

function findTableCatalogSql(schema: string, table: string): string {
  const s = escapeSqlLiteral(schema);
  const t = escapeSqlLiteral(table);
  return `SELECT DISTINCT database_name FROM duckdb_tables()
    WHERE lower(schema_name) = lower('${s}')
      AND lower(table_name) = lower('${t}')
    ORDER BY 1
    LIMIT 20`;
}

function tableExistsSql(schema: string, table: string): string {
  const s = escapeSqlLiteral(schema);
  const t = escapeSqlLiteral(table);
  return `SELECT 1 AS ok FROM information_schema.tables
    WHERE lower(table_schema) = lower('${s}')
      AND lower(table_name) = lower('${t}')
    LIMIT 1`;
}

function duckdbTableExistsSqlAttached(schema: string, table: string): string {
  const s = escapeSqlLiteral(schema);
  const t = escapeSqlLiteral(table);
  return `SELECT 1 AS ok FROM duckdb_tables()
    WHERE lower(schema_name) = lower('${s}')
      AND lower(table_name) = lower('${t}')
    LIMIT 1`;
}

/**
 * Best attach target: named catalog when attach works, otherwise null (token-default / cross-catalog SQL).
 */
export async function resolveMotherduckAttachDatabase(
  secrets: Record<string, string>,
  config: Record<string, unknown>,
  catalogFromRef?: string
): Promise<string | null> {
  if (!motherduckToken(secrets)) {
    throw new Error("Set MOTHERDUCK_TOKEN to query MotherDuck.");
  }

  await executeMotherduckSql(secrets, "SELECT 1 AS ok");

  const listed = await listMotherduckDatabases(secrets, config);
  const candidates = motherduckDatabaseCandidates(secrets, config, catalogFromRef).filter(
    (d) => listed.length === 0 || listed.some((n) => n.toLowerCase() === d.toLowerCase())
  );
  const toTry = candidates.length ? candidates : listed;

  for (const database of toTry) {
    try {
      await executeMotherduckSql(secrets, "SELECT 1 AS ok", database);
      return database;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!isMotherduckDatabaseAttachError(msg)) throw e;
    }
  }

  return null;
}

async function motherduckTableExists(
  secrets: Record<string, string>,
  config: Record<string, unknown>,
  schema: string,
  table: string
): Promise<boolean> {
  for (const sql of [duckdbTableExistsSqlAttached(schema, table), tableExistsSql(schema, table)]) {
    try {
      const { rowset } = await executeMotherduckSql(
        secrets,
        sql,
        motherduckDatabaseName(secrets, config)
      );
      if (rowset.rows.length > 0) return true;
    } catch {
      /* try next metadata source */
    }
  }
  return false;
}

/** List MotherDuck catalogs visible to the token (best-effort). */
export async function listMotherduckDatabases(
  secrets: Record<string, string>,
  config: Record<string, unknown>
): Promise<string[]> {
  try {
    const { rowset } = await executeMotherduckSql(
      secrets,
      "SELECT database_name FROM duckdb_databases() ORDER BY 1"
    );
    return rowsetFirstColumnValues(rowset, "database_name");
  } catch {
    return [];
  }
}

/** Find which MotherDuck database contains schema.table. */
export async function resolveMotherduckDatabaseForTable(
  secrets: Record<string, string>,
  config: Record<string, unknown>,
  schema: string,
  table: string,
  catalogFromRef?: string
): Promise<string | null> {
  try {
    const { rowset } = await executeMotherduckSql(secrets, findTableCatalogSql(schema, table));
    const found = rowsetFirstColumnValues(rowset, "database_name");
    if (found.length) {
      if (catalogFromRef && found.some((d) => d.toLowerCase() === catalogFromRef.toLowerCase())) {
        return catalogFromRef;
      }
      const configured = motherduckDatabaseName(secrets, config);
      const configuredMatch = found.find((d) => d.toLowerCase() === configured.toLowerCase());
      if (configuredMatch) return configuredMatch;
      const myDb = found.find((d) => d.toLowerCase() === "my_db");
      if (myDb) return myDb;
      return found[0]!;
    }
  } catch {
    /* fall through */
  }

  const tried = new Set<string>();

  async function tryDatabase(database: string): Promise<boolean> {
    if (!database || tried.has(database)) return false;
    tried.add(database);
    return motherduckTableExists(secrets, { ...config, database }, schema, table);
  }

  for (const database of motherduckDatabaseCandidates(secrets, config, catalogFromRef)) {
    if (await tryDatabase(database)) return database;
  }

  const listed = await listMotherduckDatabases(secrets, config);
  for (const database of listed) {
    if (await tryDatabase(database)) return database;
  }

  return null;
}

export type MotherduckQueryAttempt = {
  rowset: WarehouseQueryRowset;
  database: string;
};

/** Run SQL against the first MotherDuck catalog where it succeeds. */
export async function runMotherduckQueryWithDatabaseFallback(
  secrets: Record<string, string>,
  config: Record<string, unknown>,
  sql: string,
  options?: {
    catalogFromRef?: string;
    schema?: string;
    table?: string;
  }
): Promise<MotherduckQueryAttempt> {
  const configured = motherduckDatabaseName(secrets, config);
  let lastError: string | undefined;

  let candidates = motherduckDatabaseCandidates(secrets, config, options?.catalogFromRef);

  if (options?.schema && options?.table) {
    const resolved = await resolveMotherduckDatabaseForTable(
      secrets,
      config,
      options.schema,
      options.table,
      options.catalogFromRef
    );
    if (resolved) {
      candidates = [resolved, ...candidates.filter((d) => d !== resolved)];
    }
  }

  for (const database of candidates) {
    try {
      const { rowset } = await executeMotherduckSql(secrets, sql, database);
      return { rowset, database };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastError = msg;
      if (!isMotherduckDatabaseAttachError(msg) && !isMotherduckMissingObjectError(msg)) {
        throw e;
      }
    }
  }

  try {
    const { rowset } = await executeMotherduckSql(secrets, sql);
    return { rowset, database: configured };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    lastError = msg;
    throw new Error(lastError ?? `MotherDuck query failed for database "${configured}".`);
  }
}

export function motherduckDatabaseMismatchHint(
  configuredDatabase: string,
  resolvedDatabase: string
): string | undefined {
  if (!resolvedDatabase || resolvedDatabase === configuredDatabase) return undefined;
  return (
    `Data was found in MotherDuck database "${resolvedDatabase}" but your connection uses "${configuredDatabase}". ` +
    `Update Database on your destination connection to "${resolvedDatabase}" to avoid lookup delays.`
  );
}

export function catalogFromTableRef(
  landingQualified: string | undefined,
  secrets: Record<string, string>,
  config: Record<string, unknown>
): string | undefined {
  return parseDuckdbTableRef(
    landingQualified ?? "",
    motherduckDatabaseName(secrets, config)
  )?.database;
}
