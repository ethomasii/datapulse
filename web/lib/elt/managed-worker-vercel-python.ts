function normalizeControlPlaneBase(url: string): string {
  return url.replace(/\/$/, "");
}

/** Route prefix for the FastAPI service (Vercel Services `experimentalServices`). */
const PREFIX = (process.env.ELTPULSE_MANAGED_VERCEL_PYTHON_PATH || "/managed-elt").replace(/\/$/, "");

/**
 * Forwards managed execution to the Python Vercel service (`POST {prefix}/batch`).
 * Python uses `ELTPULSE_INTERNAL_API_SECRET` from **its** environment to PATCH the Next app.
 *
 * Wall clock per invocation is capped at **900s** (15 minutes) on the Python function; the
 * request body `deadlineMs` is clamped to the same cap.
 */
export async function runManagedWorkerVercelPythonBatchHttp(options: {
  baseUrl: string;
  limit: number;
  deadlineMs: number;
}): Promise<{ processed: number; errors: string[] }> {
  const triggerSecret = process.env.ELTPULSE_MANAGED_VERCEL_PYTHON_SECRET?.trim();
  if (!triggerSecret) {
    throw new Error(
      "Set ELTPULSE_MANAGED_VERCEL_PYTHON_SECRET when ELTPULSE_MANAGED_EXECUTOR=vercel-python (Bearer token for POST /managed-elt/batch)."
    );
  }
  const base = normalizeControlPlaneBase(options.baseUrl);
  const url = `${base}${PREFIX}/batch`;
  const deadlineMs = Math.min(Math.max(5_000, options.deadlineMs), 900_000);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${triggerSecret}`,
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
    throw new Error(`vercel-python worker: expected JSON, got ${res.status}: ${text.slice(0, 500)}`);
  }
  if (!res.ok) {
    throw new Error(`vercel-python worker ${res.status}: ${text.slice(0, 800)}`);
  }
  return {
    processed: Number(data.processed ?? 0),
    errors: Array.isArray(data.errors) ? data.errors : [],
  };
}
