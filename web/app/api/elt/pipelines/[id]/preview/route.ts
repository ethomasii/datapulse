import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db/client";
import { previewTableFromConfig } from "@/lib/elt/pipeline-asset-keys";
import { resolvePreviewTableRefWithWarehouse } from "@/lib/elt/pipeline-assets";
import { stripDuckdbCatalogPrefix, parseDuckdbTableRef } from "@/lib/elt/duckdb-table-ref";
import { formatMotherduckColumnErrorForTableRef, isMotherduckMissingObjectError } from "@/lib/elt/warehouse-column-errors";
import { fetchWarehouseColumnsForAsset } from "@/lib/elt/warehouse-column-introspect";
import { introspectDestinationConnection } from "@/lib/elt/warehouse-introspect";
import { motherduckDatabaseName } from "@/lib/elt/warehouse-introspect-connectors";
import { resolveDestinationConnectionContext } from "@/lib/elt/warehouse-destination-secrets";
import { runReadOnlyQuery, type ReadOnlyQueryOptions } from "@/lib/elt/warehouse-readonly-query";
import { fetchWarehouseColumnProfiles } from "@/lib/elt/warehouse-column-profile-server";
import type { ColumnProfile } from "@/lib/elt/warehouse-column-profile";
import { resolveRouteParamId } from "@/lib/server/route-params";

const pipelineSelect = {
  id: true,
  name: true,
  tool: true,
  sourceType: true,
  sourceConfiguration: true,
  destinationConnectionId: true,
} as const;

function enrichMotherduckPreviewMessage(
  message: string,
  conn: { connector: string },
  table: string,
  configuredDatabase?: string
): string {
  if (conn.connector?.toLowerCase() !== "motherduck" || !configuredDatabase) return message;
  if (!isMotherduckMissingObjectError(message)) return message;
  const ref = parseDuckdbTableRef(table, configuredDatabase);
  if (!ref) return message;
  return formatMotherduckColumnErrorForTableRef(`${ref.schema}.${ref.table}`, configuredDatabase, message);
}

function motherduckConfiguredDatabase(conn: {
  connector: string;
  config: unknown;
  connectionSecretsEnc: string | null;
}): string | undefined {
  if (conn.connector?.toLowerCase() !== "motherduck") return undefined;
  const { secrets, config } = resolveDestinationConnectionContext(conn);
  return motherduckDatabaseName(secrets, config);
}

function motherduckPreviewQueryOptions(
  conn: { connector: string; config: unknown; connectionSecretsEnc: string | null },
  table: string
): ReadOnlyQueryOptions | undefined {
  if (conn.connector?.toLowerCase() !== "motherduck") return undefined;
  const { secrets, config } = resolveDestinationConnectionContext(conn);
  const ref = parseDuckdbTableRef(table, motherduckDatabaseName(secrets, config));
  if (!ref) return undefined;
  return { schema: ref.schema, table: ref.table, catalogFromRef: ref.database };
}

function quoteTableRef(table: string): string | null {
  const t = table.trim();
  if (!/^[a-zA-Z_][\w]*(\.[a-zA-Z_][\w]*)+$/.test(t)) return null;
  return t
    .split(".")
    .map((p) => `"${p.replace(/"/g, '""')}"`)
    .join(".");
}

const bodySchema = z.object({
  table: z.string().min(1).max(256).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  limit: z.number().int().min(1).max(25).optional(),
  /** Skip row sample — only resolve column names (for Select Columns sidebar). */
  columnsOnly: z.boolean().optional(),
  /** DuckDB-family SUMMARIZE stats under preview headers (default true). */
  includeProfiles: z.boolean().optional(),
});

/**
 * POST /api/elt/pipelines/[id]/preview — Alteryx/Lakeflow-style row preview for a canvas step table.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pipelineId = await resolveRouteParamId(ctx.params);
  if (!pipelineId) return NextResponse.json({ error: "Invalid pipeline id" }, { status: 400 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const ownerIds = await getAccessibleResourceOwnerIds(user.id);

  const pipeline =
    (await db.eltPipeline.findFirst({
      where: { id: pipelineId, userId: { in: ownerIds } },
      select: pipelineSelect,
    })) ??
    (await db.eltPipeline.findFirst({
      where: { name: pipelineId, userId: { in: ownerIds } },
      select: pipelineSelect,
    }));
  if (!pipeline) {
    return NextResponse.json(
      { error: "Pipeline not found — open the pipeline from the builder and save, then retry." },
      { status: 404 }
    );
  }
  if (!pipeline.destinationConnectionId) {
    return NextResponse.json(
      { error: "Link a destination connection to preview warehouse data." },
      { status: 400 }
    );
  }

  const rawTable =
    body.table?.trim() ||
    (body.config ? previewTableFromConfig(body.config) : null);
  if (!rawTable) {
    return NextResponse.json({ error: "table or config with output_table/table required" }, { status: 400 });
  }

  const conn = await db.connection.findFirst({
    where: { id: pipeline.destinationConnectionId, connectionType: "destination" },
    select: { id: true, connector: true, config: true, connectionSecretsEnc: true },
  });
  if (!conn) return NextResponse.json({ error: "Destination connection not found" }, { status: 404 });

  let warehouseTables: Array<{ schema: string; table: string; qualified: string }> | undefined;
  try {
    const intro = await introspectDestinationConnection(conn);
    if (intro.ok) warehouseTables = intro.tables;
  } catch {
    /* introspection optional — fall back to config-derived refs */
  }

  const resolved = resolvePreviewTableRefWithWarehouse({
      name: pipeline.name,
      sourceType: pipeline.sourceType,
      tool: pipeline.tool,
      sourceConfiguration: pipeline.sourceConfiguration,
      requested: rawTable,
      warehouseTables,
    });

  const table = stripDuckdbCatalogPrefix(resolved);
  const warehouseRef = resolved.trim();

  const limit = body.limit ?? 10;
  const quoted = quoteTableRef(table);
  if (!quoted) {
    return NextResponse.json({ error: "table must be schema.table format" }, { status: 400 });
  }

  const configuredDatabase = motherduckConfiguredDatabase(conn);
  const destContext = resolveDestinationConnectionContext(conn);

  if (body.columnsOnly) {
    try {
      const columnMeta = await fetchWarehouseColumnsForAsset(conn, warehouseRef);
      return NextResponse.json({
        table,
        ok: columnMeta.columns.length > 0,
        message: columnMeta.message,
        columns: columnMeta.columns.map((c) => c.name),
        rows: [],
        rowCount: 0,
        truncated: false,
        configuredDatabase,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        {
          error: msg,
          ok: false,
          message: msg,
          columns: [],
          rows: [],
          rowCount: 0,
          truncated: false,
          configuredDatabase,
        },
        { status: 400 }
      );
    }
  }

  const sql = `SELECT * FROM ${quoted} LIMIT ${limit}`;
  const queryOptions = motherduckPreviewQueryOptions(conn, warehouseRef);
  try {
    let result = await runReadOnlyQuery(conn, sql, limit, queryOptions);
    if (result.columns.length === 0) {
      const columnMeta = await fetchWarehouseColumnsForAsset(conn, warehouseRef);
      if (columnMeta.columns.length > 0) {
        result = {
          ...result,
          ok: true,
          columns: columnMeta.columns.map((c) => c.name),
          message:
            result.rows.length > 0
              ? result.message
              : `Found ${columnMeta.columns.length} column(s)${result.rows.length === 0 ? " (table is empty — run sync to load rows)" : ""}.`,
        };
      } else if (result.ok && result.rows.length === 0) {
        result = {
          ...result,
          ok: false,
          message: enrichMotherduckPreviewMessage(
            columnMeta.message ||
              `No table or columns found for ${table}. Confirm the MotherDuck database on your connection matches where dlt wrote data, then run a sync.`,
            conn,
            warehouseRef,
            configuredDatabase
          ),
        };
      }
    }
    if (!result.ok && result.message) {
      result = {
        ...result,
        message: enrichMotherduckPreviewMessage(result.message, conn, warehouseRef, configuredDatabase),
      };
    }

    const includeProfiles = body.includeProfiles !== false;
    let columnProfiles: Record<string, ColumnProfile> | undefined;
    if (includeProfiles && result.ok && result.columns.length > 0) {
      const duckRef = parseDuckdbTableRef(warehouseRef, configuredDatabase ?? "");
      columnProfiles = await fetchWarehouseColumnProfiles({
        connector: conn.connector,
        secrets: destContext.secrets,
        config: destContext.config,
        quotedTable: quoted,
        catalogFromRef: duckRef?.database ?? queryOptions?.catalogFromRef,
        schema: duckRef?.schema ?? queryOptions?.schema,
        table: duckRef?.table ?? queryOptions?.table,
      });
    }

    return NextResponse.json({ table, configuredDatabase, columnProfiles, ...result });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const msg = enrichMotherduckPreviewMessage(raw, conn, warehouseRef, configuredDatabase);
    return NextResponse.json({ error: msg, configuredDatabase }, { status: 400 });
  }
}
