import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db/client";
import { resolveComponentCompiler } from "@/lib/elt/component-packages";
import { loadWorkspaceCatalogUrls } from "@/lib/elt/workspace-catalog-sources";
import { previewTableFromConfig } from "@/lib/elt/pipeline-asset-keys";
import { runReadOnlyQuery } from "@/lib/elt/warehouse-readonly-query";
import { runStepPython } from "@/lib/elt/run-step-python";
import { resolveRouteParamId } from "@/lib/server/route-params";

const bodySchema = z.object({
  component_id: z.string().min(1).max(128),
  config: z.record(z.string(), z.unknown()).default({}),
  node_id: z.string().max(128).optional(),
});

function quoteTableRef(table: string): string | null {
  const t = table.trim();
  if (!/^[a-zA-Z_][\w]*(\.[a-zA-Z_][\w]*)+$/.test(t)) return null;
  return t
    .split(".")
    .map((p) => `"${p.replace(/"/g, '""')}"`)
    .join(".");
}

/**
 * POST /api/elt/pipelines/[id]/run-step — compile + preview a single canvas component.
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
  const pipeline = await db.eltPipeline.findFirst({
    where: { id: pipelineId, userId: { in: ownerIds } },
    select: { id: true, destinationConnectionId: true, sourceConfiguration: true },
  });
  if (!pipeline) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const workspaceCatalogUrls = await loadWorkspaceCatalogUrls(user.id);
  const compiler = await resolveComponentCompiler(body.component_id, {
    sourceConfiguration: (pipeline.sourceConfiguration ?? {}) as Record<string, unknown>,
    workspaceCatalogUrls,
  });
  if (!compiler) {
    return NextResponse.json({ error: `No compiler for ${body.component_id}` }, { status: 400 });
  }

  const cfg = { ...body.config, template_id: body.config.template_id ?? body.component_id };
  let compiled: Awaited<ReturnType<typeof compiler.compile>>;
  try {
    compiled = await compiler.compile(cfg);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Compile failed: ${msg}` }, { status: 400 });
  }

  const previewTable = previewTableFromConfig(cfg);
  let preview: Record<string, unknown> | null = null;
  let sqlResults: Array<{ sql: string; ok: boolean; message?: string }> = [];
  let pythonResult: Awaited<ReturnType<typeof runStepPython>> | null = null;

  if (pipeline.destinationConnectionId) {
    const conn = await db.connection.findFirst({
      where: {
        id: pipeline.destinationConnectionId,
        userId: { in: ownerIds },
        connectionType: "destination",
      },
      select: { id: true, connector: true, config: true, connectionSecretsEnc: true },
    });

    if (conn && compiled.sql?.length) {
      for (const stmt of compiled.sql) {
        const upper = stmt.trim().toUpperCase();
        if (!upper.startsWith("SELECT")) {
          sqlResults.push({ sql: stmt, ok: false, message: "Only SELECT checks run in step preview" });
          continue;
        }
        try {
          await runReadOnlyQuery(conn, stmt, 5);
          sqlResults.push({ sql: stmt, ok: true });
        } catch (e) {
          sqlResults.push({
            sql: stmt,
            ok: false,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    if (conn && compiled.python?.length) {
      pythonResult = await runStepPython(conn, compiled.python);
    }

    if (conn && previewTable) {
      const quoted = quoteTableRef(previewTable);
      if (quoted) {
        try {
          const result = await runReadOnlyQuery(conn, `SELECT * FROM ${quoted} LIMIT 10`, 10);
          preview = { table: previewTable, ...result };
        } catch (e) {
          preview = {
            table: previewTable,
            ok: false,
            message: e instanceof Error ? e.message : String(e),
          };
        }
      }
    }
  }

  const hasPython = Boolean(compiled.python?.length);
  const pythonExecuted = pythonResult?.ok === true;
  const message = pythonExecuted
    ? "Python step executed — preview refreshed from output table."
    : hasPython && pythonResult
      ? pythonResult.message
      : hasPython
        ? "Step compiled. Python transforms materialize on full pipeline run."
        : preview
          ? "Step compiled and preview loaded."
          : "Step compiled. Link destination + set output table to preview.";

  return NextResponse.json({
    component_id: body.component_id,
    node_id: body.node_id,
    compiler: compiler.source,
    compiled: {
      python: compiled.python ?? [],
      sql: compiled.sql ?? [],
      tests: compiled.tests ?? [],
      warnings: compiled.warnings ?? [],
    },
    sql_results: sqlResults,
    python_result: pythonResult,
    preview,
    message,
    needs_full_run: hasPython && !pythonExecuted,
  });
}
