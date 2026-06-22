import { RunIngestionExecutor, type Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { applyPatchRunBody } from "@/lib/elt/apply-run-patch";
import {
  dbtUiActionFromTriggeredBy,
  isDbtOnlyTriggeredBy,
  pipelineHasDbtEnabled,
  resolveRunPhasesForTrigger,
} from "@/lib/elt/dbt-run-phases";
import { buildStubDbtRunManifest } from "@/lib/elt/dbt-run-manifest";
import {
  loadDbtProjectForPipeline,
  resolveEffectiveSourceConfiguration,
  sourceConfigurationFromDbtProject,
} from "@/lib/elt/dbt-projects";
import { maybeDispatchRunWebhook } from "@/lib/elt/maybe-dispatch-run-webhook";
import type { PatchRunBody } from "@/lib/elt/run-types";
import type { ManagedWorkerBatchResult } from "@/lib/elt/managed-worker-stub-http";

const MANAGED: RunIngestionExecutor[] = [
  RunIngestionExecutor.eltpulse_managed,
  RunIngestionExecutor.datapulse_managed,
];

async function patchManagedRunInProcess(runId: string, body: PatchRunBody): Promise<void> {
  const existing = await db.eltPipelineRun.findFirst({ where: { id: runId } });
  if (!existing) throw new Error(`Run ${runId} not found`);
  if (!MANAGED.includes(existing.ingestionExecutor)) {
    throw new Error(`Run ${runId} is not managed-ingestion`);
  }
  if (existing.status === "cancelled") return;

  if (body.status === "running" && existing.status === "pending") {
    const claimed = await db.eltPipelineRun.updateMany({
      where: { id: runId, status: "pending", ingestionExecutor: { in: MANAGED } },
      data: { status: "running" },
    });
    if (claimed.count === 0) return;
    return;
  }

  const patch = applyPatchRunBody(
    {
      status: existing.status,
      logEntries: existing.logEntries,
      telemetry: (existing as { telemetry?: unknown }).telemetry,
      finishedAt: existing.finishedAt,
    },
    body
  );

  const logTouched = body.logEntries !== undefined || body.appendLog !== undefined;
  const data: Prisma.EltPipelineRunUpdateInput = {
    status: patch.nextStatus as never,
    ...(logTouched ? { logEntries: patch.logEntries as unknown as Prisma.InputJsonValue } : {}),
    ...(patch.telemetryJson !== undefined ? { telemetry: patch.telemetryJson } : {}),
    ...(patch.errorSummary !== undefined ? { errorSummary: patch.errorSummary } : {}),
    finishedAt: patch.nextFinishedAt,
  };

  await db.eltPipelineRun.update({ where: { id: runId }, data });

  if (patch.willBeTerminal && !patch.wasTerminal) {
    await maybeDispatchRunWebhook(runId, existing.userId);
  }
}

/**
 * Complete a managed run in-process (no HTTP self-call). Works on Vercel without
 * ELTPULSE_INTERNAL_API_SECRET — used for stub/demo execution and fast free-tier runs.
 */
export async function stubCompleteManagedRunInProcess(runId: string): Promise<void> {
  const run = await db.eltPipelineRun.findFirst({
    where: { id: runId },
    select: {
      triggeredBy: true,
      dbtProjectId: true,
      pipeline: { select: { sourceType: true, sourceConfiguration: true, dbtProjectId: true } },
      dbtProject: true,
    },
  });

  let sourceConfiguration: unknown = run?.pipeline?.sourceConfiguration;
  if (run?.dbtProject) {
    sourceConfiguration = sourceConfigurationFromDbtProject(run.dbtProject);
  } else if (run?.pipeline) {
    const linked = await loadDbtProjectForPipeline(run.pipeline);
    sourceConfiguration = resolveEffectiveSourceConfiguration(run.pipeline, linked);
  }

  const hasDbt = pipelineHasDbtEnabled(sourceConfiguration);
  const sourceType = run?.pipeline?.sourceType ?? run?.dbtProject?.sourceSlug ?? "";
  const triggeredBy = run?.triggeredBy ?? null;
  const phases = resolveRunPhasesForTrigger(sourceConfiguration, triggeredBy);
  const dbtOnly = isDbtOnlyTriggeredBy(triggeredBy);
  const dbtAction = dbtUiActionFromTriggeredBy(triggeredBy);

  await patchManagedRunInProcess(runId, { status: "running" });

  if (phases.includes("extract")) {
    await patchManagedRunInProcess(runId, {
      status: "running",
      appendLog: {
        level: "info",
        message: "eltPulse managed sync: connecting to source and preparing load…",
      },
      telemetrySummary: { currentPhase: "extract", progress: 10, rowsLoaded: 0, bytesLoaded: 0 },
      appendTelemetrySample: { progress: 10, rows: 0, bytes: 0, phase: "extract" },
    });
  }
  if (phases.includes("load")) {
    await patchManagedRunInProcess(runId, {
      status: "running",
      telemetrySummary: { currentPhase: "load", progress: 80, rowsLoaded: 100, bytesLoaded: 50_000 },
      appendTelemetrySample: { progress: 80, rows: 100, bytes: 50_000, phase: "load" },
    });
  }
  if (phases.includes("transform")) {
    await patchManagedRunInProcess(runId, {
      status: "running",
      appendLog: {
        level: "info",
        message: "Running warehouse transform steps (no extract/load)…",
      },
      telemetrySummary: { currentPhase: "transform", progress: 85, rowsLoaded: 100, bytesLoaded: 50_000 },
      appendTelemetrySample: { progress: 85, rows: 100, bytes: 50_000, phase: "transform" },
    });
  }
  if (phases.includes("dbt") && hasDbt) {
    const dbtMessage =
      dbtAction === "compile"
        ? "dbt compile: resolving project manifest…"
        : dbtAction === "test"
          ? "dbt test: running project tests…"
          : dbtOnly
            ? "Scheduled dbt transform (sync skipped)…"
            : "Running dbt transform after load…";
    await patchManagedRunInProcess(runId, {
      status: "running",
      appendLog: { level: "info", message: dbtMessage },
      telemetrySummary: { currentPhase: "dbt", progress: 92, rowsLoaded: 100, bytesLoaded: 50_000 },
      appendTelemetrySample: { progress: 92, rows: 100, bytes: 50_000, phase: "dbt" },
    });
  }

  const successMessage =
    dbtAction === "compile"
      ? "dbt compile completed successfully."
      : dbtAction === "test"
        ? "dbt test completed successfully."
        : dbtOnly && hasDbt
          ? "Scheduled dbt transform completed successfully."
          : hasDbt
            ? "eltPulse managed sync and dbt transform completed successfully."
            : "eltPulse managed sync completed successfully.";

  await patchManagedRunInProcess(runId, {
    status: "succeeded",
    appendLog: { level: "info", message: successMessage },
    telemetrySummary: { currentPhase: "done", progress: 100, rowsLoaded: 100, bytesLoaded: 50_000 },
    appendTelemetrySample: { progress: 100, rows: 100, bytes: 50_000, phase: "done" },
    ...(hasDbt && (run?.pipeline || run?.dbtProject) && dbtAction !== "compile"
      ? { dbtManifest: buildStubDbtRunManifest(sourceType, sourceConfiguration) }
      : {}),
  });
}

export async function fetchPendingManagedRunIdsFromDb(limit: number): Promise<string[]> {
  const runs = await db.eltPipelineRun.findMany({
    where: {
      status: "pending",
      ingestionExecutor: { in: MANAGED },
    },
    orderBy: { startedAt: "asc" },
    take: limit,
    select: { id: true },
  });
  return runs.map((r) => r.id);
}

/** Process pending managed runs in-process (no HTTP self-call). */
export async function runManagedWorkerStubBatchInProcess(options: {
  limit: number;
  deadlineMs: number;
}): Promise<ManagedWorkerBatchResult> {
  const errors: string[] = [];
  const deadline = Date.now() + options.deadlineMs;
  const ids = await fetchPendingManagedRunIdsFromDb(options.limit);
  let processed = 0;
  for (const id of ids) {
    if (Date.now() > deadline) break;
    try {
      await stubCompleteManagedRunInProcess(id);
      processed += 1;
    } catch (e) {
      errors.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { processed, errors };
}
