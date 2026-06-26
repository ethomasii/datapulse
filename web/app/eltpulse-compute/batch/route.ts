import { NextResponse } from "next/server";
import {
  runManagedWorkerBatchDirect,
  shouldUseDelegateHttp,
} from "@/lib/elt/managed-batch-direct";
import { runManagedWorkerDelegateBatchHttp } from "@/lib/elt/managed-worker-delegate";
import { resolveManagedDelegateConfig } from "@/lib/elt/managed-worker-stub-http";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

function authorized(req: Request): boolean {
  const expected =
    process.env.ELTPULSE_MANAGED_DELEGATE_SECRET?.trim() ||
    process.env.ELTPULSE_MANAGED_VERCEL_PYTHON_SECRET?.trim() ||
    process.env.ELTPULSE_INTERNAL_API_SECRET?.trim() ||
    "";
  if (!expected) return false;
  return (req.headers.get("authorization") ?? "") === `Bearer ${expected}`;
}

/**
 * eltPulse managed compute batch — Node handler (replaces unreliable co-located Python HTTP on Vercel).
 * POST /eltpulse-compute/batch
 */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const limit = Math.min(20, Math.max(1, Number(body.limit ?? 5) || 5));
  const deadlineMs = Math.min(
    900_000,
    Math.max(5_000, Number(body.deadlineMs ?? body.deadline_ms ?? 120_000) || 120_000)
  );
  const runId =
    typeof body.runId === "string"
      ? body.runId
      : typeof body.run_id === "string"
        ? body.run_id
        : undefined;

  const config = resolveManagedDelegateConfig();
  if (config && shouldUseDelegateHttp(config.url)) {
    try {
      const result = await runManagedWorkerDelegateBatchHttp({
        batchUrl: config.url,
        secret: config.secret,
        limit,
        deadlineMs,
        runId,
        organizationId:
          typeof body.organizationId === "string"
            ? body.organizationId
            : typeof body.organization_id === "string"
              ? body.organization_id
              : undefined,
        pool: body.pool === "shared" ? "shared" : undefined,
      });
      return NextResponse.json({ ok: true, ...result, executor: "delegate-http" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ ok: false, error: msg }, { status: 502 });
    }
  }

  try {
    const result = await runManagedWorkerBatchDirect({ limit, deadlineMs, runId });
    return NextResponse.json({ ok: true, ...result, executor: "node-direct" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "eltpulse-managed-compute",
    runtime: "node",
  });
}
