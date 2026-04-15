/**
 * PATCH /api/agent/runs/:id
 *
 * Agent reports run progress, logs, **telemetry** (rows/bytes/progress samples), and final status.
 * Authenticated by Bearer agentToken.
 *
 * Body (all optional; zod-validated, same shape as `PATCH /api/elt/runs/:id`):
 *   status, appendLog, logEntries, errorSummary, finishedAt,
 *   telemetrySummary, appendTelemetrySample, telemetrySamples
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

  return NextResponse.json({ run });
}
