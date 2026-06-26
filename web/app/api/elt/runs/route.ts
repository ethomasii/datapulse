import { NextResponse } from "next/server";
import type { Prisma, RunIngestionExecutor, RunStatus } from "@prisma/client";
import { getActiveOrganizationForSession } from "@/lib/auth/active-org";
import { getWorkspacePermissions, workspaceResourceUserId } from "@/lib/auth/org-permissions";
import {
  API_SCOPES,
  hasScope,
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { pipelineOwnerWhere } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db/client";
import { processManagedRunImmediately } from "@/lib/elt/process-managed-run";
import { resolveNewRunExecution } from "@/lib/agent/run-execution";
import { resolveWorkspaceOrganizationId } from "@/lib/elt/resolve-workspace-org";
import { RunPartitionResolutionError, resolveRunPartitionFields } from "@/lib/elt/run-partition-resolution";
import { createRunBodySchema } from "@/lib/elt/run-types";
import {
  resolveUserPlanTier,
  runHistoryPrismaFilter,
  tierAllowsRunsApi,
  upgradeMessageForFeature,
} from "@/lib/plans/tier-features";

/** Allow managed worker dispatch to complete during quick-start create-and-run. */
export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.RUNS_READ)) return scopeForbiddenResponse();

  const perms = await getWorkspacePermissions(auth.user.id);
  const ownerIds = perms.resourceOwnerIds;
  const resourceOwnerId = workspaceResourceUserId(perms, auth.user.id);
  const tier = await resolveUserPlanTier(resourceOwnerId);

  if (auth.via === "api_key" && !tierAllowsRunsApi(tier)) {
    return NextResponse.json({ error: upgradeMessageForFeature("Runs API", "pro") }, { status: 403 });
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
    userId: { in: ownerIds },
    ...(pipelineId ? { pipelineId } : {}),
    ...(statuses?.length ? { status: { in: statuses } } : {}),
    ...(environment ? { environment } : {}),
  };

  const historyFilter = runHistoryPrismaFilter(tier);
  if (historyFilter) {
    where.AND = [...(Array.isArray(where.AND) ? where.AND : []), historyFilter];
  }

  const runs = await db.eltPipelineRun.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: limit,
    include: {
      pipeline: { select: { id: true, name: true } },
      dbtProject: { select: { id: true, name: true } },
      targetAgentToken: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ runs });
}

export async function POST(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.RUNS_WRITE)) return scopeForbiddenResponse();

  const perms = await getWorkspacePermissions(auth.user.id);
  if (!perms.canWrite) {
    return NextResponse.json({ error: "View-only access — ask an org admin to upgrade your role." }, { status: 403 });
  }

  const resourceOwnerId = workspaceResourceUserId(perms, auth.user.id);
  const tier = await resolveUserPlanTier(resourceOwnerId);
  if (auth.via === "api_key" && !tierAllowsRunsApi(tier)) {
    return NextResponse.json({ error: upgradeMessageForFeature("Runs API", "pro") }, { status: 403 });
  }

  const ownerIds = perms.resourceOwnerIds;

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
    where: { id: body.pipelineId, ...pipelineOwnerWhere(ownerIds) },
    select: {
      id: true,
      userId: true,
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
      userId: pipeline.userId,
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
      userId: pipeline.userId,
      pipelineId: pipeline.id,
      workspaceOrganizationId: await resolveWorkspaceOrganizationId(pipeline.userId, organizationId),
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
    } catch (e) {
      console.error("[elt/runs] managed immediate processing failed", run.id, e);
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
