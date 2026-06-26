import { getManagedExecutionStatus } from "@/lib/elt/managed-execution-status";
import { runManagedWorkerBatchDirect } from "@/lib/elt/managed-batch-direct";
import {
  resolveControlPlaneBaseUrl,
  resolveManagedExecutorMode,
  runManagedWorkerBatchHttp,
} from "@/lib/elt/managed-worker-stub-http";
import { stubCompleteManagedRunInProcess } from "@/lib/elt/managed-stub-inprocess";

export type ProcessManagedRunResult = {
  processed: number;
  errors: string[];
  githubDispatched?: boolean;
};

/**
 * Process a single pending managed run immediately (don't wait for cron).
 * Stub mode uses in-process DB patches (works on Vercel without self-HTTP).
 * Production uses in-process Node batch (avoids broken co-located Python HTTP on Vercel).
 */
export async function processManagedRunImmediately(
  runId: string
): Promise<ProcessManagedRunResult> {
  const mode = resolveManagedExecutorMode();

  if (mode === "stub") {
    await stubCompleteManagedRunInProcess(runId);
    return { processed: 1, errors: [] };
  }

  const secret = process.env.ELTPULSE_INTERNAL_API_SECRET?.trim();
  const baseUrl = resolveControlPlaneBaseUrl();

  if (mode === "gha") {
    const { runManagedWorkerGithubDispatchHttp } = await import(
      "@/lib/elt/managed-worker-github-dispatch"
    );
    await runManagedWorkerGithubDispatchHttp({ runId, limit: 1 });
    return { processed: 0, errors: [], githubDispatched: true };
  }

  if (!secret || !baseUrl) {
    await stubCompleteManagedRunInProcess(runId);
    return { processed: 1, errors: [] };
  }

  if (mode === "local") {
    const { executeManagedRunLocalProcess } = await import("@/lib/elt/managed-executor-local");
    try {
      const outcome = await executeManagedRunLocalProcess({ baseUrl, secret, runId });
      return { processed: outcome === "ran" ? 1 : 0, errors: [] };
    } catch (e) {
      await stubCompleteManagedRunInProcess(runId);
      return {
        processed: 1,
        errors: [e instanceof Error ? e.message : String(e)],
      };
    }
  }

  const { readyForRealRuns } = getManagedExecutionStatus();

  try {
    const result = await runManagedWorkerBatchDirect({
      limit: 1,
      deadlineMs: 120_000,
      runId,
    });
    if (result.processed > 0 || result.errors.length > 0 || result.githubDispatched) {
      return result;
    }
  } catch (e) {
    console.error("[processManagedRunImmediately]", runId, e);
    if (!readyForRealRuns) {
      await stubCompleteManagedRunInProcess(runId);
      return { processed: 1, errors: [e instanceof Error ? e.message : String(e)] };
    }
    throw e;
  }

  if (!readyForRealRuns) {
    await stubCompleteManagedRunInProcess(runId);
    return { processed: 1, errors: [] };
  }

  return { processed: 0, errors: ["Worker did not process the run"] };
}
