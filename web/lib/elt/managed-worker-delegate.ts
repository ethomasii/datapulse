/**
 * Forwards managed execution to eltPulse-owned workers (`POST …/batch`).
 * Default on Vercel: co-located Python at `/eltpulse-compute/batch` (same deployment).
 */
import {
  resolveManagedDelegateConfig,
} from "@/lib/elt/managed-worker-stub-http";

export async function runManagedWorkerDelegateBatchHttp(options: {
  limit: number;
  deadlineMs: number;
  /** Explicit batch URL (dedicated org worker). Defaults to platform delegate config. */
  batchUrl?: string;
  secret?: string;
  /** When set, worker fetches only this org's dedicated queue. */
  organizationId?: string;
  /** When set to `shared`, worker fetches shared-pool runs (excludes dedicated orgs). */
  pool?: "shared";
}): Promise<{ processed: number; errors: string[] }> {
  const config = resolveManagedDelegateConfig();
  const batchUrl = options.batchUrl?.trim() || config?.url;
  const secret = options.secret?.trim() || config?.secret;
  if (!batchUrl || !secret) {
    throw new Error(
      "Managed compute is not configured (set ELTPULSE_INTERNAL_API_SECRET on the control plane)."
    );
  }
  const deadlineMs = Math.min(Math.max(5_000, options.deadlineMs), 900_000);
  const body: Record<string, unknown> = {
    limit: options.limit,
    deadlineMs,
  };
  if (options.organizationId?.trim()) {
    body.organizationId = options.organizationId.trim();
  } else if (options.pool === "shared") {
    body.pool = "shared";
  }

  const res = await fetch(batchUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: { processed?: number; errors?: string[] };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    throw new Error(`managed compute: expected JSON, got ${res.status}: ${text.slice(0, 500)}`);
  }
  if (!res.ok) {
    throw new Error(`managed compute ${res.status}: ${text.slice(0, 800)}`);
  }
  return {
    processed: Number(data.processed ?? 0),
    errors: Array.isArray(data.errors) ? data.errors : [],
  };
}
