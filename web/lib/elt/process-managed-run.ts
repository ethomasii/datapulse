import { db } from "@/lib/db/client";
import { getManagedExecutionStatus } from "@/lib/elt/managed-execution-status";
import {
  resolveControlPlaneBaseUrl,
  resolveManagedExecutorMode,
  runManagedWorkerBatchHttp,
} from "@/lib/elt/managed-worker-stub-http";
import { stubCompleteManagedRunInProcess } from "@/lib/elt/managed-stub-inprocess";

async function runStillPending(runId: string): Promise<boolean> {
  const row = await db.eltPipelineRun.findFirst({
    where: { id: runId },
    select: { status: true },
  });
  return row?.status === "pending";
}

/**
 * Process a single pending managed run immediately (don't wait for cron).
 * Stub mode uses in-process DB patches (works on Vercel without self-HTTP).
 * Real modes use local subprocess, GitHub Actions dispatch, or worker batch.
 */
export async function processManagedRunImmediately(runId: string): Promise<void> {
  const mode = resolveManagedExecutorMode();

  if (mode === "stub") {
    await stubCompleteManagedRunInProcess(runId);
    return;
  }

  const secret = process.env.ELTPULSE_INTERNAL_API_SECRET?.trim();
  const baseUrl = resolveControlPlaneBaseUrl();

  if (mode === "gha") {
    const { runManagedWorkerGithubDispatchHttp } = await import(
      "@/lib/elt/managed-worker-github-dispatch"
    );
    await runManagedWorkerGithubDispatchHttp({ runId, limit: 1 });
    return;
  }

  if (!secret || !baseUrl) {
    await stubCompleteManagedRunInProcess(runId);
    return;
  }

  if (mode === "local") {
    const { executeManagedRunLocalProcess } = await import("@/lib/elt/managed-executor-local");
    try {
      await executeManagedRunLocalProcess({ baseUrl, secret, runId });
    } catch {
      await stubCompleteManagedRunInProcess(runId);
    }
    return;
  }

  const { readyForRealRuns } = getManagedExecutionStatus();

  try {
    const result = await runManagedWorkerBatchHttp({
      baseUrl,
      secret,
      limit: 1,
      deadlineMs: 120_000,
      runId,
    });
    if (result.processed > 0) return;
    if (result.errors.length > 0) {
      console.error("[processManagedRunImmediately]", runId, result.errors.join("; "));
    }
  } catch (e) {
    console.error("[processManagedRunImmediately]", runId, e);
  }

  if (!readyForRealRuns && (await runStillPending(runId))) {
    await stubCompleteManagedRunInProcess(runId);
  }
}
