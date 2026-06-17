import { NextResponse } from "next/server";
import type { Prisma, RunIngestionExecutor, RunStatus } from "@prisma/client";
import { getActiveOrganizationForSession } from "@/lib/auth/active-org";
import {
  API_SCOPES,
  hasScope,
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { db } from "@/lib/db/client";
import { processManagedRunImmediately } from "@/lib/elt/process-managed-run";
import { resolveNewRunExecution } from "@/lib/agent/run-execution";
import { RunPartitionResolutionError, resolveRunPartitionFields } from "@/lib/elt/run-partition-resolution";
import { createRunBodySchema } from "@/lib/elt/run-types";

export async function GET(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.RUNS_READ)) return scopeForbiddenResponse();

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
    userId: auth.user.id,
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
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.RUNS_WRITE)) return scopeForbiddenResponse();

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
    where: { id: body.pipelineId, userId: auth.user.id },
    select: {
      id: true,
      defaultTargetAgentTokenId: true,
      executionHost: true,
      sourceConfiguration: true,
    },
  });
  if (!pipeline) {
    return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
  }

  const organizationId =
    auth.via === "session"
      ? ((await getActiveOrganizationForSession())?.id ?? auth.user.organizationId ?? null)
      : (auth.user.organizationId ?? null);

  let targetAgentTokenId: string | null;
  let ingestionExecutor: RunIngestionExecutor;
  try {
    const resolved = await resolveNewRunExecution({
      userId: auth.user.id,
      organizationId,
      executionHost: pipeline.executionHost,
      pipelineDefaultTargetAgentTokenId: pipeline.defaultTargetAgentTokenId,
      bodyOverride: body.targetAgentTokenId,
      userExecutionPlane: auth.user.executionPlane,
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

  let partitionColumn: string | null = null;
  let partitionValue: string | null = null;
  let triggeredBy: string | null = body.triggeredBy?.trim() || null;
  try {
    const resolved = resolveRunPartitionFields(
      {
        partitionColumn: body.partitionColumn,
        partitionValue: body.partitionValue,
        triggeredBy: body.triggeredBy,
      },
      pipeline.sourceConfiguration
    );
    partitionColumn = resolved.partitionColumn;
    partitionValue = resolved.partitionValue;
    triggeredBy = resolved.triggeredBy;
  } catch (e) {
    if (e instanceof RunPartitionResolutionError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
    }
    throw e;
  }

  const run = await db.eltPipelineRun.create({
    data: {
      userId: auth.user.id,
      pipelineId: pipeline.id,
      ingestionExecutor,
      status: body.status,
      environment: body.environment,
      correlationId,
      triggeredBy,
      partitionColumn,
      partitionValue,
      targetAgentTokenId,
    },
    include: { pipeline: { select: { id: true, name: true } } },
  });

  const isManaged =
    ingestionExecutor === "eltpulse_managed" || ingestionExecutor === "datapulse_managed";

  if (isManaged) {
    try {
      await processManagedRunImmediately(run.id);
    } catch {
      /* cron picks up pending runs if immediate processing fails */
    }
  }

  const refreshed = isManaged
    ? await db.eltPipelineRun.findFirst({
        where: { id: run.id },
        include: { pipeline: { select: { id: true, name: true } } },
      })
    : null;

  return NextResponse.json({ run: refreshed ?? run }, { status: 201 });
}
