import { NextResponse } from "next/server";
import type { Prisma, RunIngestionExecutor, RunStatus } from "@prisma/client";
import { getActiveOrganizationForSession } from "@/lib/auth/active-org";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { resolveNewRunExecution } from "@/lib/agent/run-execution";
import { createRunBodySchema } from "@/lib/elt/run-types";

export async function GET(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const pipelineId = url.searchParams.get("pipelineId") ?? undefined;
  const statusRaw = url.searchParams.get("status");
  const valid = new Set<string>(["pending", "running", "succeeded", "failed", "cancelled"]);
  const statuses = statusRaw
    ? (statusRaw.split(",").filter((s): s is RunStatus => valid.has(s)) as RunStatus[])
    : undefined;
  const environment = url.searchParams.get("environment") ?? undefined;
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));

  const where: Prisma.EltPipelineRunWhereInput = {
    userId: user.id,
    ...(pipelineId ? { pipelineId } : {}),
    ...(statuses?.length ? { status: { in: statuses } } : {}),
    ...(environment ? { environment } : {}),
  };

  const runs = await db.eltPipelineRun.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: limit,
    include: {
      pipeline: { select: { id: true, name: true } },
      targetAgentToken: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ runs });
}

export async function POST(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createRunBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const body = parsed.data;
  const pipeline = await db.eltPipeline.findFirst({
    where: { id: body.pipelineId, userId: user.id },
    select: {
      id: true,
      defaultTargetAgentTokenId: true,
      executionHost: true,
    },
  });
  if (!pipeline) {
    return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
  }

  const orgCtx = await getActiveOrganizationForSession();
  const organizationId = orgCtx?.id ?? user.organizationId ?? null;

  let targetAgentTokenId: string | null;
  let ingestionExecutor: RunIngestionExecutor;
  try {
    const resolved = await resolveNewRunExecution({
      userId: user.id,
      organizationId,
      executionHost: pipeline.executionHost,
      pipelineDefaultTargetAgentTokenId: pipeline.defaultTargetAgentTokenId,
      bodyOverride: body.targetAgentTokenId,
      userExecutionPlane: user.executionPlane,
    });
    targetAgentTokenId = resolved.targetAgentTokenId;
    ingestionExecutor = resolved.ingestionExecutor;
  } catch {
    return NextResponse.json({ error: "Invalid gateway token" }, { status: 400 });
  }

  const correlationId = body.correlationId?.trim() || crypto.randomUUID();

  const existing = await db.eltPipelineRun.findUnique({ where: { correlationId } });
  if (existing) {
    return NextResponse.json({ error: "correlationId already exists" }, { status: 409 });
  }

  const run = await db.eltPipelineRun.create({
    data: {
      userId: user.id,
      pipelineId: pipeline.id,
      ingestionExecutor,
      status: body.status,
      environment: body.environment,
      correlationId,
      triggeredBy: body.triggeredBy ?? null,
      targetAgentTokenId,
    },
    include: { pipeline: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ run }, { status: 201 });
}
