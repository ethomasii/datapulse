import { NextRequest, NextResponse } from "next/server";
import { resolveRunTargetAgentTokenId } from "@/lib/agent/gateway-routing";
import { db } from "@/lib/db/client";

type Ctx = { params: { token: string } };

/**
 * Incoming webhook trigger endpoint.
 * POST /api/webhooks/trigger/:token
 *
 * Body (JSON):
 *   { pipeline: string, environment?: string, correlationId?: string }
 *
 * The token is the user's `incomingWebhookToken`. No Clerk session required —
 * the token IS the auth. Keep it secret.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { token } = ctx.params;

  if (!token || token.length < 20) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Look up user by token
  const user = await db.user.findUnique({
    where: { incomingWebhookToken: token },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  let body: { pipeline?: string; environment?: string; correlationId?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const pipelineName = typeof body.pipeline === "string" ? body.pipeline.trim() : "";
  if (!pipelineName) {
    return NextResponse.json({ error: "pipeline name is required" }, { status: 400 });
  }

  const pipeline = await db.eltPipeline.findFirst({
    where: { userId: user.id, name: pipelineName },
    select: { id: true, name: true, enabled: true, defaultTargetAgentTokenId: true },
  });

  if (!pipeline) {
    return NextResponse.json({ error: `Pipeline "${pipelineName}" not found` }, { status: 404 });
  }

  if (!pipeline.enabled) {
    return NextResponse.json({ error: `Pipeline "${pipelineName}" is disabled` }, { status: 409 });
  }

  const correlationId = (typeof body.correlationId === "string" && body.correlationId.trim())
    ? body.correlationId.trim()
    : crypto.randomUUID();

  // Check for duplicate correlationId
  const dup = await db.eltPipelineRun.findUnique({ where: { correlationId } });
  if (dup) {
    return NextResponse.json({ error: "correlationId already exists" }, { status: 409 });
  }

  const environment = typeof body.environment === "string" && body.environment.trim()
    ? body.environment.trim()
    : "webhook";

  const targetAgentTokenId = await resolveRunTargetAgentTokenId({
    userId: user.id,
    bodyOverride: undefined,
    pipelineDefaultId: pipeline.defaultTargetAgentTokenId,
  });

  const run = await db.eltPipelineRun.create({
    data: {
      userId: user.id,
      pipelineId: pipeline.id,
      status: "pending",
      environment,
      correlationId,
      triggeredBy: "incoming_webhook",
      targetAgentTokenId,
    },
    select: { id: true, correlationId: true, status: true, environment: true },
  });

  return NextResponse.json({ ok: true, run }, { status: 201 });
}
