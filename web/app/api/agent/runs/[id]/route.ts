/**
 * GET  /api/agent/runs/:id  — check current run status (agent polls this to detect cancellation)
 * PATCH /api/agent/runs/:id — report progress, logs, telemetry, final status
 *
 * Both authenticated by Bearer agentToken.
 * PATCH response includes `cancel: true` when the run has been cancelled server-side
 * while the agent was executing, so the agent can abort immediately.
 */
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { getAgentAuthContext } from "@/lib/agent/auth";
import { agentCanMutateRun } from "@/lib/agent/gateway-routing";
import { applyPatchRunBody } from "@/lib/elt/apply-run-patch";
import { maybeDispatchRunWebhook } from "@/lib/elt/maybe-dispatch-run-webhook";
import { patchRunBodySchema } from "@/lib/elt/run-types";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const ctx = await getAgentAuthContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { user } = ctx;
  const namedId = ctx.agentTokenRow?.id ?? null;

  const { id } = await params;
  const run = await db.eltPipelineRun.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      status: true,
      targetAgentTokenId: true,
      pipeline: { select: { id: true, name: true } },
    },
  });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!agentCanMutateRun(namedId, run.targetAgentTokenId)) {
    return NextResponse.json({ error: "This run is targeted to a different gateway" }, { status: 403 });
  }

  return NextResponse.json({ run, cancel: run.status === "cancelled" });
}

export async function PATCH(req: Request, { params }: Params) {
  const ctx = await getAgentAuthContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { user } = ctx;
  const namedId = ctx.agentTokenRow?.id ?? null;

  const { id } = await params;
  const existing = await db.eltPipelineRun.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!agentCanMutateRun(namedId, existing.targetAgentTokenId)) {
    return NextResponse.json(
      { error: "This run is targeted to a different gateway" },
      { status: 403 }
    );
  }

  // If the run was cancelled server-side (user clicked Cancel), tell the agent
  // to stop immediately rather than continuing to write progress.
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

  // ── Atomic claim guard ───────────────────────────────────────────────────────
  // When a gateway is transitioning a run from pending → running, use an
  // atomic updateMany with a status=pending guard so that two gateway replicas
  // racing to claim the same run produce exactly one winner. The loser gets a
  // 409 Conflict and should skip this run — another replica already owns it.
  if (body.status === "running" && existing.status === "pending") {
    const claimed = await db.eltPipelineRun.updateMany({
      where: { id, userId: user.id, status: "pending" },
      data: { status: "running", ingestionExecutor: "customer_agent" },
    });
    if (claimed.count === 0) {
      // Another replica claimed it first
      return NextResponse.json({ error: "Already claimed by another gateway" }, { status: 409 });
    }
    // Re-fetch after atomic update to return the current record
    const run = await db.eltPipelineRun.findFirst({
      where: { id },
      include: { pipeline: { select: { name: true } } },
    });
    return NextResponse.json({ run, cancel: false });
  }
  // ────────────────────────────────────────────────────────────────────────────

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
    ingestionExecutor: "customer_agent",
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
    await maybeDispatchRunWebhook(run.id, user.id);
  }

  return NextResponse.json({ run, cancel: false });
}
