/**
 * Server-only DuckDB SUMMARIZE profile fetch for MotherDuck / DuckDB / SQLite.
 */

import { runMotherduckQueryWithDatabaseFallback } from "@/lib/elt/motherduck-warehouse";
import {
  parseSummarizeRowset,
  type ColumnProfile,
} from "@/lib/elt/warehouse-column-profile";
import {
  runDuckdbReadOnlyQuery,
  runSqliteReadOnlyQuery,
  type WarehouseQueryRowset,
} from "@/lib/elt/warehouse-introspect-connectors";

const PROFILE_SAMPLE_ROWS = 10_000;

function normalizeConnector(connector: string): string {
  const c = connector.toLowerCase().trim();
  if (c === "postgresql") return "postgres";
  return c;
}

function supportsColumnProfiles(connector: string): boolean {
  const c = normalizeConnector(connector);
  return c === "motherduck" || c === "duckdb" || c === "sqlite";
}

function summarizeSql(quotedTable: string): string {
  return `SUMMARIZE SELECT * FROM ${quotedTable} LIMIT ${PROFILE_SAMPLE_ROWS}`;
}

export type ColumnProfileQueryContext = {
  connector: string;
  secrets: Record<string, string>;
  config: Record<string, unknown>;
  quotedTable: string;
  catalogFromRef?: string;
  schema?: string;
  table?: string;
};

/** Fetch SUMMARIZE profiles for DuckDB-family destinations. Returns {} when unsupported or on failure. */
export async function fetchWarehouseColumnProfiles(
  ctx: ColumnProfileQueryContext
): Promise<Record<string, ColumnProfile>> {
  if (!supportsColumnProfiles(ctx.connector)) return {};

  const sql = summarizeSql(ctx.quotedTable);
  const connector = normalizeConnector(ctx.connector);

  try {
    let rowset: WarehouseQueryRowset;
    if (connector === "motherduck") {
      const { rowset: mdRowset } = await runMotherduckQueryWithDatabaseFallback(
        ctx.secrets,
        ctx.config,
        sql,
        {
          catalogFromRef: ctx.catalogFromRef,
          schema: ctx.schema,
          table: ctx.table,
        }
      );
      rowset = mdRowset;
    } else if (connector === "duckdb") {
      rowset = await runDuckdbReadOnlyQuery(ctx.secrets, ctx.config, sql);
    } else {
      rowset = await runSqliteReadOnlyQuery(ctx.secrets, ctx.config, sql);
    }
    return parseSummarizeRowset(rowset);
  } catch {
    return {};
  }
}
