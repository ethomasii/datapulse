import type { PatchRunBody } from "@/lib/elt/run-types";

/** Result of one managed-worker tick (stub, local, delegate, or GitHub dispatch). */
export type ManagedWorkerBatchResult = {
  processed: number;
  errors: string[];
  /** True when the Vercel cron only triggered a GitHub Actions run (work happens on GitHub). */
  githubDispatched?: boolean;
};

/** Normalize control-plane origin (no trailing slash). */
export function normalizeControlPlaneBase(url: string): string {
  return url.replace(/\/$/, "");
}

export async function managedInternalPatch(
  baseUrl: string,
  secret: string,
  runId: string,
  body: PatchRunBody
): Promise<Response> {
  return fetch(
    `${normalizeControlPlaneBase(baseUrl)}/api/internal/managed-runs/${encodeURIComponent(runId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
}

export async function managedInternalGet(
  baseUrl: string,
  secret: string,
  path: string
): Promise<Response> {
  const p = path.startsWith("/") ? path : `/${path}`;
  return fetch(`${normalizeControlPlaneBase(baseUrl)}${p}`, {
    headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
  });
}

async function internalPatch(baseUrl: string, secret: string, runId: string, body: PatchRunBody): Promise<void> {
  const res = await managedInternalPatch(baseUrl, secret, runId, body);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PATCH managed ${runId} ${res.status}: ${t.slice(0, 800)}`);
  }
}

/**
 * Claim + fake telemetry + terminal success over internal managed PATCH.
 * Replace with real dlt/Sling execution (container/job) that PATCHes real progress.
 */
export async function stubCompleteManagedRunHttp(baseUrl: string, secret: string, runId: string): Promise<void> {
  await internalPatch(baseUrl, secret, runId, { status: "running" });
  await internalPatch(baseUrl, secret, runId, {
    status: "running",
    appendLog: {
      level: "info",
      message:
        "eltpulse-managed-worker: stub progress — replace with real executor and PATCH live telemetry.",
    },
    telemetrySummary: { currentPhase: "stub", progress: 10, rowsLoaded: 0, bytesLoaded: 0 },
    appendTelemetrySample: { progress: 10, rows: 0, bytes: 0, phase: "stub" },
  });
  await internalPatch(baseUrl, secret, runId, {
    status: "running",
    telemetrySummary: { currentPhase: "stub", progress: 80, rowsLoaded: 100, bytesLoaded: 50_000 },
    appendTelemetrySample: { progress: 80, rows: 100, bytes: 50_000, phase: "stub" },
  });
  await internalPatch(baseUrl, secret, runId, {
    status: "succeeded",
    appendLog: {
      level: "info",
      message: "eltpulse-managed-worker: stub completed (cron or run-once process).",
    },
    telemetrySummary: { currentPhase: "done", progress: 100, rowsLoaded: 100, bytesLoaded: 50_000 },
    appendTelemetrySample: { progress: 100, rows: 100, bytes: 50_000, phase: "done" },
  });
}

export async function fetchPendingManagedRunIds(
  baseUrl: string,
  secret: string,
  limit: number
): Promise<string[]> {
  const res = await fetch(`${normalizeControlPlaneBase(baseUrl)}/api/internal/managed-runs?limit=${limit}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!res.ok) {
    throw new Error(`GET managed-runs ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  const data = (await res.json()) as { runs?: { id: string }[] };
  const runs = Array.isArray(data.runs) ? data.runs : [];
  return runs.map((r) => r.id);
}

export async function runManagedWorkerStubBatchHttp(options: {
  baseUrl: string;
  secret: string;
  limit: number;
  deadlineMs: number;
}): Promise<ManagedWorkerBatchResult> {
  const errors: string[] = [];
  const deadline = Date.now() + options.deadlineMs;
  const ids = await fetchPendingManagedRunIds(options.baseUrl, options.secret, options.limit);
  let processed = 0;
  for (const id of ids) {
    if (Date.now() > deadline) break;
    try {
      await stubCompleteManagedRunHttp(options.baseUrl, options.secret, id);
      processed += 1;
    } catch (e) {
      errors.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { processed, errors };
}

export type ManagedExecutorMode = "stub" | "local" | "vercel-python" | "delegate" | "gha";

/**
 * `stub` — demo telemetry only.
 * `gha` — Vercel cron triggers **GitHub Actions** (`workflow_dispatch`); real Python runs on GitHub runners.
 * `local` — real dlt/Sling on the **same host** as the Node process.
 * `vercel-python` — same-domain Python service (**requires** Vercel Services if your account has access).
 * `delegate` — POST batch to `ELTPULSE_MANAGED_DELEGATE_URL` (second deployment / long-runner).
 *
 * If `ELTPULSE_MANAGED_EXECUTOR` is **unset** and both `ELTPULSE_GITHUB_DISPATCH_TOKEN` and
 * `ELTPULSE_GITHUB_REPOSITORY` are set, defaults to **`gha`** so managed pipelines run without extra config.
 * Set `ELTPULSE_MANAGED_EXECUTOR=stub` to force stub when those GitHub vars exist for other reasons.
 */
export function resolveManagedExecutorMode(): ManagedExecutorMode {
  const raw = process.env.ELTPULSE_MANAGED_EXECUTOR;
  if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
    const v = String(raw).toLowerCase().trim();
    if (v === "local") return "local";
    if (v === "vercel-python") return "vercel-python";
    if (v === "delegate") return "delegate";
    if (v === "gha") return "gha";
    if (v === "stub") return "stub";
  }
  if (
    process.env.ELTPULSE_GITHUB_DISPATCH_TOKEN?.trim() &&
    process.env.ELTPULSE_GITHUB_REPOSITORY?.trim()
  ) {
    return "gha";
  }
  return "stub";
}

export async function runManagedWorkerBatchHttp(options: {
  baseUrl: string;
  secret: string;
  limit: number;
  deadlineMs: number;
}): Promise<ManagedWorkerBatchResult> {
  const mode = resolveManagedExecutorMode();
  if (mode === "local") {
    const { runManagedWorkerLocalBatchHttp } = await import("@/lib/elt/managed-executor-local");
    return runManagedWorkerLocalBatchHttp(options);
  }
  if (mode === "vercel-python") {
    const { runManagedWorkerVercelPythonBatchHttp } = await import("@/lib/elt/managed-worker-vercel-python");
    return runManagedWorkerVercelPythonBatchHttp({
      baseUrl: options.baseUrl,
      limit: options.limit,
      deadlineMs: options.deadlineMs,
    });
  }
  if (mode === "delegate") {
    const { runManagedWorkerDelegateBatchHttp } = await import("@/lib/elt/managed-worker-delegate");
    return runManagedWorkerDelegateBatchHttp({
      limit: options.limit,
      deadlineMs: options.deadlineMs,
    });
  }
  if (mode === "gha") {
    const { runManagedWorkerGithubDispatchHttp } = await import("@/lib/elt/managed-worker-github-dispatch");
    return runManagedWorkerGithubDispatchHttp();
  }
  return runManagedWorkerStubBatchHttp(options);
}

/** Resolve public HTTPS base for server-to-server calls (Vercel cron → same deployment). */
export function resolveControlPlaneBaseUrl(): string | null {
  const controlPlane = process.env.ELTPULSE_CONTROL_PLANE_URL?.trim();
  if (controlPlane) return normalizeControlPlaneBase(controlPlane);
  const explicit = process.env.ELTPULSE_CRON_APP_URL?.trim();
  if (explicit) return normalizeControlPlaneBase(explicit);
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return normalizeControlPlaneBase(`https://${vercel}`);
  const nextPublic = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (nextPublic) return normalizeControlPlaneBase(nextPublic);
  return null;
}
