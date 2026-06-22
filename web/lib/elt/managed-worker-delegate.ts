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
}): Promise<{ processed: number; errors: string[] }> {
  const config = resolveManagedDelegateConfig();
  if (!config) {
    throw new Error(
      "Managed compute is not configured (set ELTPULSE_INTERNAL_API_SECRET on the control plane)."
    );
  }
  const deadlineMs = Math.min(Math.max(5_000, options.deadlineMs), 900_000);
  const res = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      limit: options.limit,
      deadlineMs,
    }),
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
