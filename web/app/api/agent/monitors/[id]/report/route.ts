/**
 * POST /api/agent/monitors/:id/report
 *
 * Customer gateway reports a monitor evaluation (S3/SQS, etc.): updates lastCheckAt and optionally enqueues a pipeline run.
 */
import { NextResponse } from "next/server";
import { getAgentAuthContext } from "@/lib/agent/auth";
import { monitorEvaluatesOnControlPlane } from "@/lib/agent/monitor-execution";
import { db } from "@/lib/db/client";
import { enqueuePipelineRunForMonitor } from "@/lib/monitors/run-monitors";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAgentAuthContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Monitor id is required" }, { status: 400 });
  }

  let body: { shouldTrigger?: unknown; message?: unknown; metadata?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const shouldTrigger = body.shouldTrigger === true;
  const message = typeof body.message === "string" ? body.message : "";
  const metadata =
    body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? (body.metadata as Record<string, unknown>)
      : {};

  const monitor = await db.eltMonitor.findFirst({
    where: { id, userId: ctx.user.id },
    select: {
      id: true,
      name: true,
      pipelineId: true,
      executionHost: true,
    },
  });

  if (!monitor) {
    return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
  }

  if (monitorEvaluatesOnControlPlane(monitor.executionHost, ctx.user.executionPlane)) {
    return NextResponse.json(
      {
        error:
          "This monitor is configured for eltPulse-managed evaluation; gateway reports are not accepted.",
      },
      { status: 400 }
    );
  }

  const now = new Date();
  let runId: string | null = null;

  await db.eltMonitor.update({
    where: { id: monitor.id },
    data: { lastCheckAt: now },
  });

  if (shouldTrigger) {
    const q = await enqueuePipelineRunForMonitor(ctx.user.id, monitor.pipelineId, monitor.name);
    if (!q.ok) {
      return NextResponse.json({ error: q.reason }, { status: 409 });
    }
    runId = q.runId;
    await db.eltMonitor.update({
      where: { id: monitor.id },
      data: { lastTriggeredAt: now },
    });
  }

  return NextResponse.json({
    ok: true,
    runId,
    message,
    metadata,
  });
}
