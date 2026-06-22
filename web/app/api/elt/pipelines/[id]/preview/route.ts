import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db/client";
import { previewTableFromConfig } from "@/lib/elt/pipeline-asset-keys";
import { runReadOnlyQuery } from "@/lib/elt/warehouse-readonly-query";
import { resolveRouteParamId } from "@/lib/server/route-params";

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

  const table =
    body.table?.trim() ||
    (body.config ? previewTableFromConfig(body.config) : null);
  if (!table) {
    return NextResponse.json({ error: "table or config with output_table/table required" }, { status: 400 });
  }

  const ownerIds = await getAccessibleResourceOwnerIds(user.id);
  const pipeline = await db.eltPipeline.findFirst({
    where: { id: pipelineId, userId: { in: ownerIds } },
    select: { id: true, destinationConnectionId: true },
  });
  if (!pipeline) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!pipeline.destinationConnectionId) {
    return NextResponse.json(
      { error: "Link a destination connection to preview warehouse data." },
      { status: 400 }
    );
  }

  const conn = await db.connection.findFirst({
    where: { id: pipeline.destinationConnectionId, userId: { in: ownerIds }, connectionType: "destination" },
    select: { id: true, connector: true, config: true, connectionSecretsEnc: true },
  });
  if (!conn) return NextResponse.json({ error: "Destination connection not found" }, { status: 404 });

  const limit = body.limit ?? 10;
  const quoted = quoteTableRef(table);
  if (!quoted) {
    return NextResponse.json({ error: "table must be schema.table format" }, { status: 400 });
  }
  const sql = `SELECT * FROM ${quoted} LIMIT ${limit}`;
  try {
    const result = await runReadOnlyQuery(conn, sql, limit);
    return NextResponse.json({ table, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
