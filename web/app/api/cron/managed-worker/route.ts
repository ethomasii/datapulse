import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import {
  resolveControlPlaneBaseUrl,
  resolveManagedExecutorMode,
  runManagedWorkerBatchHttp,
} from "@/lib/elt/managed-worker-stub-http";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
/**
 * Must cover worst case: `vercel-python` waits for Python worker (up to 900s).
 * Stub/local self-calls finish faster.
 */
export const maxDuration = 900;

/**
 * Vercel Cron — schedule in `vercel.json`. Bursts: no always-on worker; each tick pulls pending
 * `eltpulse_managed` runs. Default: stub executor (`ELTPULSE_MANAGED_EXECUTOR=stub`).
 * Set `ELTPULSE_MANAGED_EXECUTOR=local` for real dlt/Sling on the Node host (dev VM / container).
 * Set `ELTPULSE_MANAGED_EXECUTOR=vercel-python` for Vercel **Services** Python worker (`/managed-elt/batch`),
 *   **900s (15 min) max** per cron tick for the Python invocation (see `vercel.json` `experimentalServices`).
 * Set `ELTPULSE_MANAGED_EXECUTOR=delegate` to POST the same batch payload to `ELTPULSE_MANAGED_DELEGATE_URL` (option #2).
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` (same as `/api/cron/monitors`).
 *
 * Requires `ELTPULSE_INTERNAL_API_SECRET` and a resolvable app base URL (`ELTPULSE_CRON_APP_URL`,
 * or `VERCEL_URL` on Vercel, or `NEXT_PUBLIC_APP_URL`).
 *
 * Query: `limit` (default 5), `budgetMs` (default 45000).
 */
export async function GET(request: Request) {
  noStore();
  const authHeader = request.headers.get("authorization");

  if (process.env.NODE_ENV !== "production") {
    const secret = process.env.CRON_SECRET;
    if (secret && authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const internal = process.env.ELTPULSE_INTERNAL_API_SECRET?.trim();
  const baseUrl = resolveControlPlaneBaseUrl();
  if (!internal || !baseUrl) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: !internal
        ? "Set ELTPULSE_INTERNAL_API_SECRET to run managed-worker cron ticks."
        : "Set ELTPULSE_CRON_APP_URL (or deploy on Vercel with VERCEL_URL / NEXT_PUBLIC_APP_URL) for self-calls.",
    });
  }

  const url = new URL(request.url);
  const mode = resolveManagedExecutorMode();
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") ?? 5) || 5));
  const longRunner = mode === "vercel-python" || mode === "delegate";
  const defaultBudget = longRunner ? 900_000 : 45_000;
  const maxBudget = longRunner ? 900_000 : 120_000;
  const budgetMs = Math.min(
    maxBudget,
    Math.max(5_000, Number(url.searchParams.get("budgetMs") ?? defaultBudget) || defaultBudget)
  );

  try {
    const { processed, errors } = await runManagedWorkerBatchHttp({
      baseUrl,
      secret: internal,
      limit,
      deadlineMs: budgetMs,
    });
    return NextResponse.json({
      ok: true,
      baseUrl,
      limit,
      budgetMs,
      processed,
      errors,
    });
  } catch (err) {
    console.error("[cron/managed-worker]", err);
    return NextResponse.json({ error: "Managed worker cron failed" }, { status: 500 });
  }
}
