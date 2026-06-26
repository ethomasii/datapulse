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
      message: "eltPulse managed sync: connecting to source and preparing load…",
    },
    telemetrySummary: { currentPhase: "extract", progress: 10, rowsLoaded: 0, bytesLoaded: 0 },
    appendTelemetrySample: { progress: 10, rows: 0, bytes: 0, phase: "extract" },
  });
  await internalPatch(baseUrl, secret, runId, {
    status: "running",
    telemetrySummary: { currentPhase: "load", progress: 80, rowsLoaded: 100, bytesLoaded: 50_000 },
    appendTelemetrySample: { progress: 80, rows: 100, bytes: 50_000, phase: "load" },
  });
  await internalPatch(baseUrl, secret, runId, {
    status: "succeeded",
    appendLog: {
      level: "info",
      message: "eltPulse managed sync completed successfully.",
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

/** Public path for co-located Python managed compute (see web/vercel.json rewrite). */
export const MANAGED_COMPUTE_BATCH_PATH = "/eltpulse-compute/batch";

export type ManagedDelegateConfig = {
  url: string;
  secret: string;
};

/**
 * Resolve worker batch URL + trigger secret. Zero per-customer config:
 * - Explicit `ELTPULSE_MANAGED_DELEGATE_URL`, or
 * - Same Vercel deployment: `{APP_URL}/eltpulse-compute/batch`, or
 * - `ELTPULSE_MANAGED_WORKER_URL` (optional separate worker project).
 */
export function resolveManagedDelegateConfig(): ManagedDelegateConfig | null {
  const secret =
    process.env.ELTPULSE_MANAGED_DELEGATE_SECRET?.trim() ||
    process.env.ELTPULSE_MANAGED_VERCEL_PYTHON_SECRET?.trim() ||
    process.env.ELTPULSE_INTERNAL_API_SECRET?.trim() ||
    "";
  if (!secret) return null;

  const explicit = process.env.ELTPULSE_MANAGED_DELEGATE_URL?.trim();
  if (explicit) {
    return { url: explicit, secret };
  }

  const workerProject = process.env.ELTPULSE_MANAGED_WORKER_URL?.trim();
  if (workerProject) {
    const base = normalizeControlPlaneBase(workerProject);
    const url = base.endsWith("/batch") ? base : `${base}/batch`;
    return { url, secret };
  }

  const controlPlane = resolveControlPlaneBaseUrl();
  if (!controlPlane) return null;

  // Co-located Python on the same Vercel deployment (default eltPulse Cloud path).
  if (process.env.VERCEL === "1" || process.env.VERCEL_URL?.trim()) {
    return { url: `${controlPlane}${MANAGED_COMPUTE_BATCH_PATH}`, secret };
  }

  return null;
}

export type ManagedExecutorMode = "stub" | "local" | "vercel-python" | "delegate" | "gha";

/**
 * How eltPulse-managed runs execute (platform — not per customer):
 *
 * - **`delegate`** — eltPulse-owned workers (co-located Python on Vercel, or optional separate URL).
 * - **`local`** — dev subprocess when secrets are set.
 * - **`stub`** — demo telemetry when platform secrets are missing.
 *
 * Auto-selection when `ELTPULSE_MANAGED_EXECUTOR` is unset:
 * 1. delegate config + `ELTPULSE_INTERNAL_API_SECRET` → **delegate**
 * 2. `NODE_ENV=development` + internal secret + encryption key → **local**
 * 3. otherwise → **stub**
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
  if (resolveManagedDelegateConfig() && process.env.ELTPULSE_INTERNAL_API_SECRET?.trim()) {
    return "delegate";
  }
  if (
    process.env.NODE_ENV === "development" &&
    process.env.ELTPULSE_INTERNAL_API_SECRET?.trim() &&
    process.env.ELTPULSE_TOKEN_ENCRYPTION_KEY?.trim()
  ) {
    return "local";
  }
  return "stub";
}

/** Customer-facing label for managed compute (never exposes operator backends like gha). */
export function managedExecutorCustomerLabel(mode: ManagedExecutorMode): string {
  if (mode === "stub") return "Demo";
  if (mode === "local") return "Local development";
  if (mode === "gha") return "Legacy operator";
  return "eltPulse compute";
}

export async function runManagedWorkerBatchHttp(options: {
  baseUrl: string;
  secret: string;
  limit: number;
  deadlineMs: number;
  /** When set, worker processes this run directly (used right after enqueue). */
  runId?: string;
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
    const { dispatchManagedWorkerCron } = await import("@/lib/elt/org-managed-compute");
    const result = await dispatchManagedWorkerCron({
      limit: options.limit,
      deadlineMs: options.deadlineMs,
      runId: options.runId,
    });
    return {
      processed: result.processed,
      errors: result.errors,
    };
  }
  if (mode === "gha") {
    const { runManagedWorkerGithubDispatchHttp } = await import("@/lib/elt/managed-worker-github-dispatch");
    return runManagedWorkerGithubDispatchHttp();
  }
  const { runManagedWorkerStubBatchInProcess } = await import("@/lib/elt/managed-stub-inprocess");
  return runManagedWorkerStubBatchInProcess({
    limit: options.limit,
    deadlineMs: options.deadlineMs,
  });
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
