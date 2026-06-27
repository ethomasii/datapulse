/**
 * Server-side column profile fetch for all warehouse destinations.
 */

import { resolveDestinationConnectionContext } from "@/lib/elt/warehouse-destination-secrets";
import { runMotherduckQueryWithDatabaseFallback } from "@/lib/elt/motherduck-warehouse";
import {
  computeColumnProfilesFromSample,
  parseSummarizeRowset,
  type ColumnProfile,
  type ColumnTypeHint,
} from "@/lib/elt/warehouse-column-profile";
import { fetchWarehouseColumnsForAsset } from "@/lib/elt/warehouse-column-introspect";
import type { DestinationConnectionRow } from "@/lib/elt/warehouse-introspect";
import {
  PROFILE_SAMPLE_ROW_CAP,
  runReadOnlyQuery,
  type ReadOnlyQueryOptions,
} from "@/lib/elt/warehouse-readonly-query";
import {
  runDuckdbReadOnlyQuery,
  runSqliteReadOnlyQuery,
  type WarehouseQueryRowset,
} from "@/lib/elt/warehouse-introspect-connectors";

function normalizeConnector(connector: string): string {
  const c = connector.toLowerCase().trim();
  if (c === "gcp") return "bigquery";
  if (c === "postgresql") return "postgres";
  return c;
}

function isDuckdbFamily(connector: string): boolean {
  const c = normalizeConnector(connector);
  return c === "motherduck" || c === "duckdb" || c === "sqlite";
}

function summarizeSql(quotedTable: string): string {
  return `SUMMARIZE SELECT * FROM ${quotedTable} LIMIT ${PROFILE_SAMPLE_ROW_CAP}`;
}

async function fetchDuckdbSummarizeProfiles(
  connector: string,
  secrets: Record<string, string>,
  config: Record<string, unknown>,
  quotedTable: string,
  queryOptions?: ReadOnlyQueryOptions
): Promise<Record<string, ColumnProfile>> {
  const sql = summarizeSql(quotedTable);
  const slug = normalizeConnector(connector);
  let rowset: WarehouseQueryRowset;

  if (slug === "motherduck") {
    const { rowset: mdRowset } = await runMotherduckQueryWithDatabaseFallback(
      secrets,
      config,
      sql,
      {
        catalogFromRef: queryOptions?.catalogFromRef,
        schema: queryOptions?.schema,
        table: queryOptions?.table,
      }
    );
    rowset = mdRowset;
  } else if (slug === "duckdb") {
    rowset = await runDuckdbReadOnlyQuery(secrets, config, sql);
  } else {
    rowset = await runSqliteReadOnlyQuery(secrets, config, sql);
  }
  return parseSummarizeRowset(rowset);
}

export type ColumnProfileQueryContext = {
  connection: DestinationConnectionRow;
  quotedTable: string;
  warehouseRef: string;
  queryOptions?: ReadOnlyQueryOptions;
  columnTypes?: ColumnTypeHint[];
};

/** Fetch column profiles for any supported warehouse destination. */
export async function fetchWarehouseColumnProfiles(
  ctx: ColumnProfileQueryContext
): Promise<Record<string, ColumnProfile>> {
  const connector = normalizeConnector(ctx.connection.connector);
  const { secrets, config } = resolveDestinationConnectionContext(ctx.connection);

  if (isDuckdbFamily(connector)) {
    try {
      const summarized = await fetchDuckdbSummarizeProfiles(
        connector,
        secrets,
        config,
        ctx.quotedTable,
        ctx.queryOptions
      );
      if (Object.keys(summarized).length > 0) return summarized;
    } catch {
      /* fall through to generic sample profiling */
    }
  }

  try {
    const sampleSql = `SELECT * FROM ${ctx.quotedTable}`;
    const sample = await runReadOnlyQuery(
      ctx.connection,
      sampleSql,
      PROFILE_SAMPLE_ROW_CAP,
      { ...ctx.queryOptions, rowCap: PROFILE_SAMPLE_ROW_CAP }
    );
    if (!sample.ok || sample.columns.length === 0) return {};

    let columnTypes = ctx.columnTypes;
    if (!columnTypes?.length) {
      const meta = await fetchWarehouseColumnsForAsset(ctx.connection, ctx.warehouseRef);
      columnTypes = meta.columns.map((c) => ({ name: c.name, type: c.type }));
    }
    if (!columnTypes.length) {
      columnTypes = sample.columns.map((name) => ({ name }));
    }

    return computeColumnProfilesFromSample(columnTypes, sample.rows);
  } catch {
    return {};
  }
}
