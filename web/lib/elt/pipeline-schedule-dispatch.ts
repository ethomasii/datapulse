import type { PipelineExecutionHost, RunIngestionExecutor } from "@prisma/client";
import { resolveNewRunExecution } from "@/lib/agent/run-execution";
import { db } from "@/lib/db/client";
import { cronMatchesAt } from "@/lib/elt/cron-match";
import { createPendingEltRun } from "@/lib/elt/create-pending-elt-run";
import {
  pipelineHasDbtEnabled,
  readDbtScheduleInfo,
  readPipelineScheduleInfo,
} from "@/lib/elt/dbt-run-phases";
import { processManagedRunImmediately } from "@/lib/elt/process-managed-run";

export type PipelineScheduleDispatchResult = {
  checked: number;
  triggered: { pipelineId: string; pipelineName: string; triggeredBy: string; runId: string }[];
  skipped: { pipelineId: string; reason: string }[];
  errors: string[];
};

type PipelineRow = {
  id: string;
  name: string;
  userId: string;
  enabled: boolean;
  executionHost: PipelineExecutionHost;
  defaultTargetAgentTokenId: string | null;
  sourceConfiguration: unknown;
};

async function resolveExecutionForPipeline(
  pipeline: PipelineRow
): Promise<{ targetAgentTokenId: string | null; ingestionExecutor: RunIngestionExecutor }> {
  const actor = await db.user.findUnique({
    where: { id: pipeline.userId },
    select: { executionPlane: true, organizationId: true },
  });
  return resolveNewRunExecution({
    userId: pipeline.userId,
    organizationId: actor?.organizationId ?? null,
    executionHost: pipeline.executionHost,
    pipelineDefaultTargetAgentTokenId: pipeline.defaultTargetAgentTokenId,
    bodyOverride: undefined,
    userExecutionPlane: actor?.executionPlane ?? "eltpulse_managed",
  });
}

async function recentRunExists(
  pipelineId: string,
  triggeredBy: string,
  since: Date
): Promise<boolean> {
  const existing = await db.eltPipelineRun.findFirst({
    where: {
      pipelineId,
      triggeredBy,
      startedAt: { gte: since },
    },
    select: { id: true },
  });
  return Boolean(existing);
}

async function dispatchScheduledRun(
  pipeline: PipelineRow,
  triggeredBy: string,
  at: Date
): Promise<{ ok: true; runId: string } | { ok: false; reason: string }> {
  const since = new Date(at.getTime() - 90_000);
  if (await recentRunExists(pipeline.id, triggeredBy, since)) {
    return { ok: false, reason: "Run already dispatched this minute" };
  }

  const { targetAgentTokenId, ingestionExecutor } = await resolveExecutionForPipeline(pipeline);
  const minuteKey = at.toISOString().slice(0, 16);
  try {
    const run = await createPendingEltRun({
      userId: pipeline.userId,
      pipelineId: pipeline.id,
      environment: "schedule",
      triggeredBy,
      partitionColumn: null,
      partitionValue: null,
      targetAgentTokenId,
      ingestionExecutor,
      correlationId: `schedule:${pipeline.id}:${triggeredBy}:${minuteKey}`,
    });

    if (ingestionExecutor === "eltpulse_managed" || ingestionExecutor === "datapulse_managed") {
      try {
        await processManagedRunImmediately(run.id);
      } catch (e) {
        console.error("[pipeline-schedule-dispatch]", pipeline.id, e);
      }
    }

    return { ok: true, runId: run.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint") || msg.includes("correlationId")) {
      return { ok: false, reason: "Run already dispatched this minute" };
    }
    throw e;
  }
}

/** Evaluate enabled pipeline + dbt cron schedules and enqueue due runs. */
export async function dispatchDuePipelineSchedules(at: Date = new Date()): Promise<PipelineScheduleDispatchResult> {
  const pipelines = await db.eltPipeline.findMany({
    where: { enabled: true },
    select: {
      id: true,
      name: true,
      userId: true,
      enabled: true,
      executionHost: true,
      defaultTargetAgentTokenId: true,
      sourceConfiguration: true,
    },
  });

  const triggered: PipelineScheduleDispatchResult["triggered"] = [];
  const skipped: PipelineScheduleDispatchResult["skipped"] = [];
  const errors: string[] = [];

  for (const pipeline of pipelines) {
    try {
      const sync = readPipelineScheduleInfo(pipeline.sourceConfiguration);
      if (sync.enabled && sync.cron && cronMatchesAt(sync.cron, sync.timezone, at)) {
        const result = await dispatchScheduledRun(pipeline, "schedule:sync", at);
        if (result.ok) {
          triggered.push({
            pipelineId: pipeline.id,
            pipelineName: pipeline.name,
            triggeredBy: "schedule:sync",
            runId: result.runId,
          });
        } else {
          skipped.push({ pipelineId: pipeline.id, reason: `sync: ${result.reason}` });
        }
      }

      if (pipelineHasDbtEnabled(pipeline.sourceConfiguration)) {
        const dbtSched = readDbtScheduleInfo(pipeline.sourceConfiguration);
        if (
          dbtSched?.enabled &&
          dbtSched.cron &&
          dbtSched.mode === "dbt_only" &&
          cronMatchesAt(dbtSched.cron, dbtSched.timezone, at)
        ) {
          const result = await dispatchScheduledRun(pipeline, "schedule:dbt", at);
          if (result.ok) {
            triggered.push({
              pipelineId: pipeline.id,
              pipelineName: pipeline.name,
              triggeredBy: "schedule:dbt",
              runId: result.runId,
            });
          } else {
            skipped.push({ pipelineId: pipeline.id, reason: `dbt: ${result.reason}` });
          }
        }
      }
    } catch (e) {
      errors.push(`${pipeline.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { checked: pipelines.length, triggered, skipped, errors };
}
