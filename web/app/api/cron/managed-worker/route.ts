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
export const maxDuration = 800;

/**
 * Vercel Cron — schedule in `vercel.json`. Bursts: no always-on worker; each tick pulls pending
 * `eltpulse_managed` runs. Default: stub executor (`ELTPULSE_MANAGED_EXECUTOR=stub`).
 * Set `ELTPULSE_MANAGED_EXECUTOR=local` for real dlt/Sling on the Node host (dev VM / container).
 * Set `ELTPULSE_MANAGED_EXECUTOR=gha` to **dispatch GitHub Actions** (`.github/workflows/eltpulse-managed-worker.yml`)
 *   — real Python on GitHub runners; no Vercel Services. If `ELTPULSE_MANAGED_EXECUTOR` is unset but
 *   `ELTPULSE_GITHUB_DISPATCH_TOKEN` + `ELTPULSE_GITHUB_REPOSITORY` are set, **defaults to gha**.
 * Set `ELTPULSE_MANAGED_EXECUTOR=vercel-python` only if you use Vercel Services + same-domain Python.
 * Set `ELTPULSE_MANAGED_EXECUTOR=delegate` to POST batch to `ELTPULSE_MANAGED_DELEGATE_URL` (second deployment).
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
  const mode = resolveManagedExecutorMode();

  if (mode === "stub" || (!internal || !baseUrl)) {
    const url = new URL(request.url);
    const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") ?? 5) || 5));
    const budgetMs = Math.min(
      120_000,
      Math.max(5_000, Number(url.searchParams.get("budgetMs") ?? 45_000) || 45_000)
    );
    try {
      const { runManagedWorkerStubBatchInProcess } = await import("@/lib/elt/managed-stub-inprocess");
      const result = await runManagedWorkerStubBatchInProcess({ limit, deadlineMs: budgetMs });
      return NextResponse.json({
        ok: true,
        limit,
        budgetMs,
        executor: "stub-inprocess",
        ...result,
      });
    } catch (err) {
      console.error("[cron/managed-worker]", err);
      return NextResponse.json({ error: "Managed worker cron failed" }, { status: 500 });
    }
  }

  const url = new URL(request.url);
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") ?? 5) || 5));
  const quickDispatch = mode === "gha";
  const longRunner = mode === "vercel-python" || mode === "delegate";
  const defaultBudget = quickDispatch ? 60_000 : longRunner ? 780_000 : 45_000;
  const maxBudget = quickDispatch ? 60_000 : longRunner ? 780_000 : 120_000;
  const budgetMs = Math.min(
    maxBudget,
    Math.max(5_000, Number(url.searchParams.get("budgetMs") ?? defaultBudget) || defaultBudget)
  );

  try {
    const result = await runManagedWorkerBatchHttp({
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
      executor: mode,
      ...result,
    });
  } catch (err) {
    console.error("[cron/managed-worker]", err);
    return NextResponse.json({ error: "Managed worker cron failed" }, { status: 500 });
  }
}
