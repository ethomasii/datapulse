/**
 * CLI: process pending eltPulse-managed runs (stub or real) on this machine.
 *
 * Real execution: set `ELTPULSE_MANAGED_EXECUTOR=local` in `.env.local` and install
 * Python + dlt (and/or Sling) where this script runs. See `integrations/managed-worker/README.md`.
 */
import {
  resolveControlPlaneBaseUrl,
  resolveManagedExecutorMode,
  runManagedWorkerBatchHttp,
} from "../lib/elt/managed-worker-stub-http";

const baseUrl =
  process.env.ELTPULSE_CONTROL_PLANE_URL?.replace(/\/$/, "") ?? resolveControlPlaneBaseUrl();
const secret = process.env.ELTPULSE_INTERNAL_API_SECRET?.trim();

if (!baseUrl || !secret) {
  console.error(
    "Missing ELTPULSE_CONTROL_PLANE_URL (or NEXT_PUBLIC_APP_URL / VERCEL_URL) or ELTPULSE_INTERNAL_API_SECRET"
  );
  process.exit(1);
}

const limit = Math.min(20, Math.max(1, Number(process.env.ELTPULSE_MANAGED_LIMIT ?? 5) || 5));
const deadlineMs = Math.min(
  7_200_000,
  Math.max(30_000, Number(process.env.ELTPULSE_MANAGED_DEADLINE_MS ?? 3_600_000) || 3_600_000)
);

console.log(
  `[managed-worker] baseUrl=${baseUrl} executor=${resolveManagedExecutorMode()} limit=${limit} deadlineMs=${deadlineMs}`
);

runManagedWorkerBatchHttp({ baseUrl, secret, limit, deadlineMs })
  .then(({ processed, errors }) => {
    console.log(JSON.stringify({ processed, errors }, null, 2));
    if (errors.length) process.exit(1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
