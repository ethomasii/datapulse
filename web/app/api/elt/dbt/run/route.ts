import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspacePermissions } from "@/lib/auth/org-permissions";
import {
  API_SCOPES,
  hasScope,
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { pipelineOwnerWhere } from "@/lib/auth/workspace-access";
import { resolveNewRunExecution } from "@/lib/agent/run-execution";
import { db } from "@/lib/db/client";
import { pipelineHasDbtEnabled } from "@/lib/elt/dbt-run-phases";
import { processManagedRunImmediately } from "@/lib/elt/process-managed-run";

const bodySchema = z.object({
  pipelineId: z.string().min(1),
  action: z.enum(["run", "compile", "test"]).default("run"),
  environment: z.string().max(64).optional().default("default"),
});

/**
 * Trigger a dbt-only run for a pipeline (compile, run, or test).
 * Creates a pending run with `triggeredBy: ui:dbt_<action>` and processes immediately when managed.
 */
export async function POST(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.RUNS_WRITE)) return scopeForbiddenResponse();

  const perms = await getWorkspacePermissions(auth.user.id);
  if (!perms.canWrite) {
    return NextResponse.json({ error: "View-only access" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { pipelineId, action, environment } = parsed.data;
  const pipeline = await db.eltPipeline.findFirst({
    where: { id: pipelineId, ...pipelineOwnerWhere(perms.resourceOwnerIds) },
    select: {
      id: true,
      userId: true,
      enabled: true,
      executionHost: true,
      defaultTargetAgentTokenId: true,
      sourceConfiguration: true,
    },
  });

  if (!pipeline) {
    return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
  }
  if (!pipeline.enabled) {
    return NextResponse.json({ error: "Pipeline is disabled" }, { status: 400 });
  }
  if (!pipelineHasDbtEnabled(pipeline.sourceConfiguration)) {
    return NextResponse.json({ error: "dbt is not enabled on this pipeline" }, { status: 400 });
  }

  const actor = await db.user.findUnique({
    where: { id: pipeline.userId },
    select: { executionPlane: true, organizationId: true },
  });

  let targetAgentTokenId: string | null = null;
  let ingestionExecutor: Awaited<ReturnType<typeof resolveNewRunExecution>>["ingestionExecutor"];
  try {
    const resolved = await resolveNewRunExecution({
      userId: pipeline.userId,
      organizationId: actor?.organizationId ?? null,
      executionHost: pipeline.executionHost,
      pipelineDefaultTargetAgentTokenId: pipeline.defaultTargetAgentTokenId,
      bodyOverride: undefined,
      userExecutionPlane: actor?.executionPlane ?? "eltpulse_managed",
    });
    targetAgentTokenId = resolved.targetAgentTokenId;
    ingestionExecutor = resolved.ingestionExecutor;
  } catch {
    return NextResponse.json({ error: "Invalid gateway token" }, { status: 400 });
  }

  const triggeredBy = `ui:dbt_${action}`;
  const correlationId = crypto.randomUUID();

  const run = await db.eltPipelineRun.create({
    data: {
      userId: pipeline.userId,
      pipelineId: pipeline.id,
      ingestionExecutor,
      status: "pending",
      environment,
      correlationId,
      triggeredBy,
      partitionColumn: null,
      partitionValue: null,
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
      console.error("[dbt/run]", run.id, e);
    }
  }

  const refreshed = await db.eltPipelineRun.findUnique({
    where: { id: run.id },
    include: { pipeline: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ run: refreshed ?? run, action, triggeredBy }, { status: 201 });
}
