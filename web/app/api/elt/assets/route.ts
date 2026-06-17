import { NextResponse } from "next/server";
import {
  API_SCOPES,
  hasScope,
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { getAccessibleResourceOwnerIds, pipelineOwnerWhere } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db/client";
import { buildWorkspaceAssets, type PipelineRunAssetInput } from "@/lib/elt/pipeline-assets";

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
      sourceConfiguration: true,
      updatedAt: true,
    },
  });

  const pipelineIds = rows.map((r) => r.id);
  const latestRunsByPipelineId = new Map<string, PipelineRunAssetInput>();

  if (pipelineIds.length > 0) {
    const runs = await db.eltPipelineRun.findMany({
      where: { pipelineId: { in: pipelineIds } },
      orderBy: { startedAt: "desc" },
      take: Math.min(pipelineIds.length * 5, 500),
      select: {
        id: true,
        pipelineId: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        telemetry: true,
      },
    });
    for (const run of runs) {
      if (!latestRunsByPipelineId.has(run.pipelineId)) {
        latestRunsByPipelineId.set(run.pipelineId, run);
      }
    }
  }

  const payload = buildWorkspaceAssets(rows, latestRunsByPipelineId);

  return NextResponse.json(payload);
}
