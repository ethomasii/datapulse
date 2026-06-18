import { NextResponse } from "next/server";
import {
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { getAccessibleResourceOwnerIds, pipelineOwnerWhere } from "@/lib/auth/workspace-access";
import { hasCatalogReadScope } from "@/lib/auth/workspace-auth-helpers";
import { db } from "@/lib/db/client";
import { computePipelineMetrics, type MetricsQuery } from "@/lib/elt/pipeline-metrics";

function parseQuery(url: URL): MetricsQuery {
  const daysRaw = url.searchParams.get("days");
  const days = daysRaw ? Number.parseInt(daysRaw, 10) : undefined;
  return {
    ...(Number.isFinite(days) ? { days } : {}),
    ...(url.searchParams.get("pipelineId")?.trim()
      ? { pipelineId: url.searchParams.get("pipelineId")!.trim() }
      : {}),
    ...(url.searchParams.get("environment")?.trim()
      ? { environment: url.searchParams.get("environment")!.trim() }
      : {}),
    ...(url.searchParams.get("status")?.trim() ? { status: url.searchParams.get("status")!.trim() } : {}),
    ...(url.searchParams.get("tool")?.trim() ? { tool: url.searchParams.get("tool")!.trim() } : {}),
    ...(url.searchParams.get("sourceType")?.trim()
      ? { sourceType: url.searchParams.get("sourceType")!.trim() }
      : {}),
    ...(url.searchParams.get("destinationType")?.trim()
      ? { destinationType: url.searchParams.get("destinationType")!.trim() }
      : {}),
  };
}

/** Aggregated EL pipeline metrics — slice by pipeline, env, tool, source, destination, time window. */
export async function GET(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasCatalogReadScope(auth)) return scopeForbiddenResponse();

  const query = parseQuery(new URL(req.url));
  const ownerIds = await getAccessibleResourceOwnerIds(auth.user.id);
  const windowDays = Math.min(90, Math.max(1, query.days ?? 30));
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const pipelines = await db.eltPipeline.findMany({
    where: pipelineOwnerWhere(ownerIds),
    select: {
      id: true,
      name: true,
      tool: true,
      sourceType: true,
      destinationType: true,
      enabled: true,
    },
  });

  const runs = await db.eltPipelineRun.findMany({
    where: {
      userId: { in: ownerIds },
      startedAt: { gte: since },
      pipelineId: { not: null },
    },
    orderBy: { startedAt: "desc" },
    take: 5000,
    select: {
      id: true,
      status: true,
      environment: true,
      startedAt: true,
      finishedAt: true,
      triggeredBy: true,
      telemetry: true,
      logEntries: true,
      pipeline: {
        select: {
          id: true,
          name: true,
          tool: true,
          sourceType: true,
          destinationType: true,
          enabled: true,
        },
      },
    },
  });

  const metrics = computePipelineMetrics(runs, pipelines, query);

  const environments = Array.from(new Set(runs.map((r) => r.environment))).sort();
  const tools = Array.from(new Set(pipelines.map((p) => p.tool))).sort();
  const sourceTypes = Array.from(new Set(pipelines.map((p) => p.sourceType))).sort();
  const destinationTypes = Array.from(new Set(pipelines.map((p) => p.destinationType))).sort();

  return NextResponse.json({
    metrics,
    filterOptions: {
      pipelines: pipelines.map((p) => ({ id: p.id, name: p.name })),
      environments,
      tools,
      sourceTypes,
      destinationTypes,
      statuses: ["succeeded", "failed", "running", "cancelled", "pending"],
    },
  });
}
