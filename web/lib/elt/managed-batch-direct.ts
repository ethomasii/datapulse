import { db } from "@/lib/db/client";
import { getManagedExecutionStatus } from "@/lib/elt/managed-execution-status";
import { executeManagedRunLocalProcess } from "@/lib/elt/managed-executor-local";
import {
  MANAGED_COMPUTE_BATCH_PATH,
  resolveControlPlaneBaseUrl,
  resolveManagedDelegateConfig,
} from "@/lib/elt/managed-worker-stub-http";
import {
  claimManagedRunInProcess,
  failManagedRunInProcess,
  fetchPendingManagedRunIdsFromDb,
  stubCompleteManagedRunInProcess,
} from "@/lib/elt/managed-stub-inprocess";

export type ManagedBatchDirectResult = {
  processed: number;
  errors: string[];
  githubDispatched?: boolean;
};

async function runStillPending(runId: string): Promise<boolean> {
  const row = await db.eltPipelineRun.findFirst({
    where: { id: runId },
    select: { status: true },
  });
  return row?.status === "pending";
}

/** True when batch URL targets co-located /eltpulse-compute on this deployment (Python HTTP is unreliable vs App Router). */
export function isCoLocatedManagedComputeUrl(): boolean {
  const config = resolveManagedDelegateConfig();
  const base = resolveControlPlaneBaseUrl();
  if (!config || !base) return false;
  const normalized = config.url.replace(/\/$/, "");
  return (
    normalized === `${base}${MANAGED_COMPUTE_BATCH_PATH}` ||
    normalized.endsWith("/eltpulse-compute/batch")
  );
}

async function tryGithubActionsWorker(runId: string): Promise<boolean> {
  const token = process.env.ELTPULSE_GITHUB_DISPATCH_TOKEN?.trim();
  const repo = process.env.ELTPULSE_GITHUB_REPOSITORY?.trim();
  if (!token || !repo) return false;

  const { runManagedWorkerGithubDispatchHttp } = await import(
    "@/lib/elt/managed-worker-github-dispatch"
  );

  await runManagedWorkerGithubDispatchHttp({ runId, limit: 1 });

  const claimed = await claimManagedRunInProcess(runId, {
    message: `eltPulse managed worker: queued on GitHub Actions (${repo})…`,
  });
  if (!claimed && (await runStillPending(runId))) {
    const { appendManagedRunLogInProcess } = await import("@/lib/elt/managed-stub-inprocess");
    await appendManagedRunLogInProcess(
      runId,
      `eltPulse managed worker: GitHub Actions dispatch sent for ${repo} (run already claimed).`
    );
  }
  return true;
}

/**
 * Process managed runs in-process (Node) — no HTTP hop to co-located Python.
 * Used on Vercel where root `api/` Python conflicts with App Router, and for immediate kicks.
 */
export async function runManagedWorkerBatchDirect(options: {
  limit: number;
  deadlineMs: number;
  runId?: string;
}): Promise<ManagedBatchDirectResult> {
  const baseUrl = resolveControlPlaneBaseUrl();
  const secret = process.env.ELTPULSE_INTERNAL_API_SECRET?.trim();
  if (!baseUrl || !secret) {
    throw new Error(
      "Managed compute requires ELTPULSE_INTERNAL_API_SECRET and a resolvable app URL."
    );
  }

  const ids = options.runId?.trim()
    ? [options.runId.trim()]
    : await fetchPendingManagedRunIdsFromDb(options.limit);

  const { readyForRealRuns } = getManagedExecutionStatus();
  const preferGithubOnVercel =
    process.env.VERCEL === "1" && isCoLocatedManagedComputeUrl();

  const errors: string[] = [];
  let processed = 0;
  let githubDispatched = false;
  const deadline = Date.now() + options.deadlineMs;

  for (const id of ids) {
    if (Date.now() > deadline) break;

    if (preferGithubOnVercel && (await tryGithubActionsWorker(id))) {
      processed += 1;
      githubDispatched = true;
      continue;
    }

    try {
      const outcome = await executeManagedRunLocalProcess({ baseUrl, secret, runId: id });
      if (outcome === "ran") {
        processed += 1;
        continue;
      }
      if (!(await runStillPending(id))) continue;
      errors.push(`${id}: skipped (already claimed)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${id}: ${msg}`);
    }

    if (!(await runStillPending(id))) continue;

    if (await tryGithubActionsWorker(id)) {
      processed += 1;
      githubDispatched = true;
      continue;
    }

    if (!readyForRealRuns) {
      try {
        await stubCompleteManagedRunInProcess(id);
        processed += 1;
      } catch (e) {
        errors.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
      continue;
    }

    await failManagedRunInProcess(
      id,
      "Managed compute could not start this run on the control plane. Configure ELTPULSE_MANAGED_DELEGATE_URL (Python worker fleet) or ELTPULSE_GITHUB_DISPATCH_TOKEN + ELTPULSE_GITHUB_REPOSITORY for GitHub Actions workers."
    );
    processed += 1;
  }

  return { processed, errors, githubDispatched: githubDispatched || undefined };
}

/** Use HTTP delegate only for external worker URLs; co-located Python batch is bypassed. */
export function shouldUseDelegateHttp(batchUrl: string): boolean {
  const base = resolveControlPlaneBaseUrl();
  if (!base) return true;
  const normalized = batchUrl.replace(/\/$/, "");
  return !(
    normalized === `${base}${MANAGED_COMPUTE_BATCH_PATH}` ||
    normalized.endsWith("/eltpulse-compute/batch")
  );
}
