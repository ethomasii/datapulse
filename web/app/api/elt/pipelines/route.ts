import { NextResponse } from "next/server";
import {
  API_SCOPES,
  hasScope,
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { pipelineSyncMode } from "@/lib/elt/pipeline-tool-labels";
import {
  pipelineHasDbtEnabled,
  readDbtScheduleInfo,
  readPipelineScheduleInfo,
  resolveRunPhasesForTrigger,
} from "@/lib/elt/dbt-run-phases";
import { getWorkspacePermissions } from "@/lib/auth/org-permissions";
import { getAccessibleResourceOwnerIds, pipelineOwnerWhere } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db/client";
import { prismaSchemaDriftResponse } from "@/lib/db/prisma-schema-drift-response";
import { createPipelineBodySchema } from "@/lib/elt/types";
import { linkDbtProjectToPipeline } from "@/lib/elt/dbt-projects";
import { createPipelineDefinition, upsertPipelineDefinition } from "@/lib/elt/persist-pipeline";

export async function GET(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.PIPELINES_READ)) return scopeForbiddenResponse();

  const ownerIds = await getAccessibleResourceOwnerIds(auth.user.id);
  const rows = await db.eltPipeline.findMany({
    where: pipelineOwnerWhere(ownerIds),
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      tool: true,
      enabled: true,
      sourceType: true,
      destinationType: true,
      description: true,
      updatedAt: true,
      defaultTargetAgentTokenId: true,
      executionHost: true,
      sourceConnectionId: true,
      destinationConnectionId: true,
      sourceConfiguration: true,
    },
  });

  const pipelines = rows.map((row) => {
    const cfg = (row.sourceConfiguration ?? {}) as Record<string, unknown>;
    const scheduleInfo = readPipelineScheduleInfo(cfg);
    const dbtScheduleInfo = readDbtScheduleInfo(cfg);
    const hasDbt = pipelineHasDbtEnabled(cfg);
    const schedulePhases = hasDbt
      ? resolveRunPhasesForTrigger(cfg, "schedule:sync")
      : resolveRunPhasesForTrigger(cfg, null);
    const dbtSchedulePhases = dbtScheduleInfo?.mode === "dbt_only" ? (["dbt"] as const) : schedulePhases;
    return {
      id: row.id,
      name: row.name,
      tool: row.tool,
      syncMode: pipelineSyncMode(row.tool),
      enabled: row.enabled,
      sourceType: row.sourceType,
      destinationType: row.destinationType,
      description: row.description,
      updatedAt: row.updatedAt,
      defaultTargetAgentTokenId: row.defaultTargetAgentTokenId,
      executionHost: row.executionHost,
      sourceConnectionId: row.sourceConnectionId,
      destinationConnectionId: row.destinationConnectionId,
      scheduleInfo,
      dbtScheduleInfo,
      hasDbt,
      schedulePhases,
      dbtSchedulePhases,
    };
  });

  return NextResponse.json({ pipelines });
}

export async function POST(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.PIPELINES_WRITE)) return scopeForbiddenResponse();

  const perms = await getWorkspacePermissions(auth.user.id);
  if (!perms.canWrite) {
    return NextResponse.json({ error: "View-only access" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createPipelineBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const { upsert, ...body } = parsed.data;
    const result = upsert
      ? await upsertPipelineDefinition(auth.user.id, body)
      : await createPipelineDefinition(auth.user.id, body);
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }
    if (body.dbtProjectId) {
      try {
        await linkDbtProjectToPipeline(auth.user.id, body.dbtProjectId, result.pipeline.id);
        const refreshed = await db.eltPipeline.findUnique({ where: { id: result.pipeline.id } });
        return NextResponse.json(
          { pipeline: refreshed ?? result.pipeline, created: result.created },
          { status: result.created ? 201 : 200 }
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Pipeline created but dbt link failed";
        return NextResponse.json(
          { pipeline: result.pipeline, created: result.created, warning: msg },
          { status: result.created ? 201 : 200 }
        );
      }
    }
    return NextResponse.json(
      { pipeline: result.pipeline, created: result.created },
      { status: result.created ? 201 : 200 }
    );
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}
