/**
 * Option #2: managed execution on a **separate** deployment (second Vercel project, Fly, etc.)
 * that exposes the same `POST …/batch` contract as `managed-worker-service/main.py`.
 *
 * Next cron uses `ELTPULSE_MANAGED_EXECUTOR=delegate` and POSTs to `ELTPULSE_MANAGED_DELEGATE_URL`
 * with `ELTPULSE_MANAGED_DELEGATE_SECRET`. The remote worker must call the **control plane** origin
 * with `ELTPULSE_INTERNAL_API_SECRET` (same DB + encryption key as production).
 */

function normalizeOrigin(url: string): string {
  return url.replace(/\/$/, "");
}

export async function runManagedWorkerDelegateBatchHttp(options: {
  limit: number;
  deadlineMs: number;
}): Promise<{ processed: number; errors: string[] }> {
  const url = process.env.ELTPULSE_MANAGED_DELEGATE_URL?.trim();
  const secret = process.env.ELTPULSE_MANAGED_DELEGATE_SECRET?.trim();
  if (!url || !secret) {
    throw new Error(
      "Set ELTPULSE_MANAGED_DELEGATE_URL (full URL to POST /batch) and ELTPULSE_MANAGED_DELEGATE_SECRET when ELTPULSE_MANAGED_EXECUTOR=delegate."
    );
  }
  const target = normalizeOrigin(url);
  const deadlineMs = Math.min(Math.max(5_000, options.deadlineMs), 900_000);
  const res = await fetch(target, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
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
    throw new Error(`delegate worker: expected JSON, got ${res.status}: ${text.slice(0, 500)}`);
  }
  if (!res.ok) {
    throw new Error(`delegate worker ${res.status}: ${text.slice(0, 800)}`);
  }
  return {
    processed: Number(data.processed ?? 0),
    errors: Array.isArray(data.errors) ? data.errors : [],
  };
}
