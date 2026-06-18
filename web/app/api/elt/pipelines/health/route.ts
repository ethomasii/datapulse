import { NextResponse } from "next/server";
import {
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { getAccessibleResourceOwnerIds, pipelineOwnerWhere } from "@/lib/auth/workspace-access";
import { hasCatalogReadScope } from "@/lib/auth/workspace-auth-helpers";
import { db } from "@/lib/db/client";
import { computePipelineHealth } from "@/lib/elt/pipeline-health";

export async function GET(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasCatalogReadScope(auth)) return scopeForbiddenResponse();

  const pipelineId = new URL(req.url).searchParams.get("pipelineId")?.trim();
  const ownerIds = await getAccessibleResourceOwnerIds(auth.user.id);

  const pipelines = await db.eltPipeline.findMany({
    where: pipelineOwnerWhere(ownerIds),
    select: { id: true, name: true, enabled: true },
  });

  const ids = pipelineId ? pipelines.filter((p) => p.id === pipelineId).map((p) => p.id) : pipelines.map((p) => p.id);
  if (ids.length === 0) {
    return NextResponse.json({ health: [] });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const runs = await db.eltPipelineRun.findMany({
    where: { pipelineId: { in: ids }, startedAt: { gte: sevenDaysAgo } },
    orderBy: { startedAt: "desc" },
    take: 500,
    select: {
      id: true,
      pipelineId: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      telemetry: true,
      logEntries: true,
      errorSummary: true,
    },
  });

  const health = pipelines
    .filter((p) => ids.includes(p.id))
    .map((p) => computePipelineHealth(p.id, p.name, p.enabled, runs));

  return NextResponse.json({ health });
}
