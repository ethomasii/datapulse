import {
  resolveControlPlaneBaseUrl,
  resolveManagedExecutorMode,
  runManagedWorkerBatchHttp,
  stubCompleteManagedRunHttp,
} from "@/lib/elt/managed-worker-stub-http";
import { stubCompleteManagedRunInProcess } from "@/lib/elt/managed-stub-inprocess";

/**
 * Process a single pending managed run immediately (don't wait for cron).
 * Stub mode uses in-process DB patches (works on Vercel without self-HTTP).
 * Other modes delegate via internal HTTP or worker batch.
 */
export async function processManagedRunImmediately(runId: string): Promise<void> {
  const mode = resolveManagedExecutorMode();

  if (mode === "stub") {
    await stubCompleteManagedRunInProcess(runId);
    return;
  }

  const secret = process.env.ELTPULSE_INTERNAL_API_SECRET?.trim();
  const baseUrl = resolveControlPlaneBaseUrl();
  if (!secret || !baseUrl) {
    // Fallback: still complete stub in-process so free-tier runs don't hang pending
    await stubCompleteManagedRunInProcess(runId);
    return;
  }

  if (mode === "local") {
    await stubCompleteManagedRunHttp(baseUrl, secret, runId);
    return;
  }

  await runManagedWorkerBatchHttp({
    baseUrl,
    secret,
    limit: 5,
    deadlineMs: 120_000,
  });
}
