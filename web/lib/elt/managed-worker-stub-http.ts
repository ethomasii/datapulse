import type { PatchRunBody } from "@/lib/elt/run-types";

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
}): Promise<{ processed: number; errors: string[] }> {
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

/**
 * `stub` — demo telemetry only (default, backwards compatible).
 * `local` — run real `python pipeline.py` / `sling run -r replication.yaml` on the **same host**
 * as this process (dev machine, long-running Node VM, or container with Python/Sling + dlt deps).
 * Not suitable for stock Vercel serverless unless that image includes Python + your pipeline deps.
 */
export function resolveManagedExecutorMode(): "stub" | "local" {
  const v = (process.env.ELTPULSE_MANAGED_EXECUTOR ?? "stub").toLowerCase().trim();
  if (v === "local") return "local";
  return "stub";
}

export async function runManagedWorkerBatchHttp(options: {
  baseUrl: string;
  secret: string;
  limit: number;
  deadlineMs: number;
}): Promise<{ processed: number; errors: string[] }> {
  if (resolveManagedExecutorMode() === "local") {
    const { runManagedWorkerLocalBatchHttp } = await import("@/lib/elt/managed-executor-local");
    return runManagedWorkerLocalBatchHttp(options);
  }
  return runManagedWorkerStubBatchHttp(options);
}

/** Resolve public HTTPS base for server-to-server calls (Vercel cron → same deployment). */
export function resolveControlPlaneBaseUrl(): string | null {
  const explicit = process.env.ELTPULSE_CRON_APP_URL?.trim();
  if (explicit) return normalizeControlPlaneBase(explicit);
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return normalizeControlPlaneBase(`https://${vercel}`);
  const nextPublic = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (nextPublic) return normalizeControlPlaneBase(nextPublic);
  return null;
}
