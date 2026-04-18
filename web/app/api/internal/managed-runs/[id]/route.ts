/**
 * PATCH /api/internal/managed-runs/:id
 *
 * Progress / terminal status for managed-ingestion runs only. Preserves `ingestionExecutor`
 * (unlike `/api/agent/runs/:id`, which forces `customer_agent` for customer gateways).
 *
 * Auth: `Authorization: Bearer ${ELTPULSE_INTERNAL_API_SECRET}`.
 */
import { RunIngestionExecutor, type Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { applyPatchRunBody } from "@/lib/elt/apply-run-patch";
import { maybeDispatchRunWebhook } from "@/lib/elt/maybe-dispatch-run-webhook";
import { patchRunBodySchema } from "@/lib/elt/run-types";
import { resolveRouteParamId } from "@/lib/server/route-params";

export const dynamic = "force-dynamic";

const MANAGED: RunIngestionExecutor[] = [
  RunIngestionExecutor.eltpulse_managed,
  RunIngestionExecutor.datapulse_managed,
];

type Ctx = { params: { id: string } | Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const secret = process.env.ELTPULSE_INTERNAL_API_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = await resolveRouteParamId(ctx.params);

  const existing = await db.eltPipelineRun.findFirst({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!MANAGED.includes(existing.ingestionExecutor)) {
    return NextResponse.json({ error: "Run is not managed-ingestion" }, { status: 403 });
  }

  if (existing.status === "cancelled") {
    return NextResponse.json({ run: existing, cancel: true });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchRunBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const body = parsed.data;

  if (body.status === "running" && existing.status === "pending") {
    const claimed = await db.eltPipelineRun.updateMany({
      where: {
        id,
        status: "pending",
        ingestionExecutor: { in: MANAGED },
      },
      data: { status: "running" },
    });
    if (claimed.count === 0) {
      return NextResponse.json({ error: "Already claimed or not pending" }, { status: 409 });
    }
    const run = await db.eltPipelineRun.findFirst({
      where: { id },
      include: { pipeline: { select: { name: true } } },
    });
    return NextResponse.json({ run, cancel: false });
  }

  const patch = applyPatchRunBody(
    {
      status: existing.status,
      logEntries: existing.logEntries,
      telemetry: (existing as { telemetry?: unknown }).telemetry,
      finishedAt: existing.finishedAt,
    },
    body
  );

  const logTouched = body.logEntries !== undefined || body.appendLog !== undefined;

  const data: Prisma.EltPipelineRunUpdateInput = {
    status: patch.nextStatus as never,
    ...(logTouched ? { logEntries: patch.logEntries as unknown as Prisma.InputJsonValue } : {}),
    ...(patch.telemetryJson !== undefined ? { telemetry: patch.telemetryJson } : {}),
    ...(patch.errorSummary !== undefined ? { errorSummary: patch.errorSummary } : {}),
    finishedAt: patch.nextFinishedAt,
  };

  const run = await db.eltPipelineRun.update({
    where: { id },
    data,
    include: { pipeline: { select: { name: true } } },
  });

  if (patch.willBeTerminal && !patch.wasTerminal) {
    await maybeDispatchRunWebhook(run.id, existing.userId);
  }

  return NextResponse.json({ run, cancel: false });
}
