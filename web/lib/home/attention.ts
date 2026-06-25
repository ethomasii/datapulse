import { db } from "@/lib/db/client";
import { pipelineOwnerWhere } from "@/lib/auth/workspace-access";

const STALE_DAYS = 7;

export type HomeAttentionFailure = {
  id: string;
  startedAt: Date;
  pipelineId: string | null;
  pipelineName: string;
};

export type HomeAttentionStalePipeline = {
  id: string;
  name: string;
  lastSuccessAt: Date | null;
};

export type HomeAttention = {
  failures24h: HomeAttentionFailure[];
  failureCount24h: number;
  stalePipelines: HomeAttentionStalePipeline[];
};

export async function loadHomeAttention(ownerIds: string[]): Promise<HomeAttention> {
  const failureCutoff = new Date();
  failureCutoff.setHours(failureCutoff.getHours() - 24);

  const staleCutoff = new Date();
  staleCutoff.setDate(staleCutoff.getDate() - STALE_DAYS);

  const ownerWhere = pipelineOwnerWhere(ownerIds);

  const [failures24h, failureCount24h, enabledPipelines, runCounts, lastSuccesses] = await Promise.all([
    db.eltPipelineRun.findMany({
      where: {
        userId: { in: ownerIds },
        status: "failed",
        startedAt: { gte: failureCutoff },
      },
      orderBy: { startedAt: "desc" },
      take: 5,
      select: {
        id: true,
        startedAt: true,
        pipelineId: true,
        pipeline: { select: { name: true } },
        dbtProject: { select: { name: true } },
      },
    }),
    db.eltPipelineRun.count({
      where: {
        userId: { in: ownerIds },
        status: "failed",
        startedAt: { gte: failureCutoff },
      },
    }),
    db.eltPipeline.findMany({
      where: { ...ownerWhere, enabled: true },
      select: { id: true, name: true },
    }),
    db.eltPipelineRun.groupBy({
      by: ["pipelineId"],
      where: { userId: { in: ownerIds }, pipelineId: { not: null } },
      _count: { _all: true },
    }),
    db.eltPipelineRun.groupBy({
      by: ["pipelineId"],
      where: {
        userId: { in: ownerIds },
        status: "succeeded",
        pipelineId: { not: null },
      },
      _max: { finishedAt: true },
    }),
  ]);

  const pipelinesWithRuns = new Set(
    runCounts.map((r) => r.pipelineId).filter((id): id is string => typeof id === "string")
  );
  const lastSuccessMap = new Map(
    lastSuccesses
      .filter((r) => r.pipelineId)
      .map((r) => [r.pipelineId!, r._max.finishedAt] as const)
  );

  const stalePipelines = enabledPipelines
    .filter((p) => {
      if (!pipelinesWithRuns.has(p.id)) return false;
      const last = lastSuccessMap.get(p.id);
      return !last || last < staleCutoff;
    })
    .map((p) => ({
      id: p.id,
      name: p.name,
      lastSuccessAt: lastSuccessMap.get(p.id) ?? null,
    }))
    .slice(0, 5);

  return {
    failures24h: failures24h.map((r) => ({
      id: r.id,
      startedAt: r.startedAt,
      pipelineId: r.pipelineId,
      pipelineName: r.pipeline?.name ?? r.dbtProject?.name ?? "Run",
    })),
    failureCount24h,
    stalePipelines,
  };
}
