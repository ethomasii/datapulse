import {
  resolveControlPlaneBaseUrl,
  resolveManagedExecutorMode,
  runManagedWorkerBatchHttp,
} from "@/lib/elt/managed-worker-stub-http";
import { stubCompleteManagedRunInProcess } from "@/lib/elt/managed-stub-inprocess";

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
    if (secret && baseUrl) {
      const { runManagedWorkerGithubDispatchHttp } = await import(
        "@/lib/elt/managed-worker-github-dispatch"
      );
      await runManagedWorkerGithubDispatchHttp();
    } else {
      await stubCompleteManagedRunInProcess(runId);
    }
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

  await runManagedWorkerBatchHttp({
    baseUrl,
    secret,
    limit: 5,
    deadlineMs: 120_000,
  });
}
