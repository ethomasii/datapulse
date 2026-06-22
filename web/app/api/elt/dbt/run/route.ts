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
import { getAccessibleResourceOwnerIds, pipelineOwnerWhere } from "@/lib/auth/workspace-access";
import { resolveNewRunExecution } from "@/lib/agent/run-execution";
import { db } from "@/lib/db/client";
import { prismaSchemaDriftResponse } from "@/lib/db/prisma-schema-drift-response";
import { pipelineHasDbtEnabled } from "@/lib/elt/dbt-run-phases";
import {
  loadDbtProjectForPipeline,
  projectHasRunnableDbt,
  resolveEffectiveSourceConfiguration,
} from "@/lib/elt/dbt-projects";
import { processManagedRunImmediately } from "@/lib/elt/process-managed-run";
import { resolveWorkspaceOrganizationId } from "@/lib/elt/resolve-workspace-org";

const bodySchema = z
  .object({
    pipelineId: z.string().min(1).optional(),
    dbtProjectId: z.string().min(1).optional(),
    action: z.enum(["run", "compile", "test"]).default("run"),
    environment: z.string().max(64).optional().default("default"),
  })
  .refine((v) => Boolean(v.pipelineId || v.dbtProjectId), {
    message: "pipelineId or dbtProjectId is required",
  });

/**
 * Trigger a dbt-only run for a pipeline or standalone dbt project.
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

  const { pipelineId, dbtProjectId, action, environment } = parsed.data;
  const ownerIds = await getAccessibleResourceOwnerIds(auth.user.id);

  try {
    if (dbtProjectId && !pipelineId) {
      const project = await db.dbtProject.findFirst({
        where: { id: dbtProjectId, userId: { in: ownerIds } },
        include: {
          pipelines: {
            where: { enabled: true },
            take: 1,
            select: {
              id: true,
              name: true,
              userId: true,
              enabled: true,
              executionHost: true,
              defaultTargetAgentTokenId: true,
            },
          },
        },
      });
      if (!project) {
        return NextResponse.json({ error: "dbt project not found" }, { status: 404 });
      }
      if (!projectHasRunnableDbt(project)) {
        return NextResponse.json({ error: "dbt project has no package path or Git URL" }, { status: 400 });
      }
      if (!project.destinationConnectionId && project.pipelines.length === 0) {
        return NextResponse.json(
          { error: "Set a warehouse connection on the project or link a pipeline before running dbt" },
          { status: 400 }
        );
      }

      const linked = project.pipelines[0] ?? null;
      const runUserId = project.userId;
      const actor = await db.user.findUnique({
        where: { id: runUserId },
        select: { executionPlane: true, organizationId: true },
      });

      let targetAgentTokenId: string | null = null;
      let ingestionExecutor: Awaited<ReturnType<typeof resolveNewRunExecution>>["ingestionExecutor"];
      try {
        const resolved = await resolveNewRunExecution({
          userId: runUserId,
          organizationId: actor?.organizationId ?? null,
          executionHost: linked?.executionHost ?? "eltpulse_managed",
          pipelineDefaultTargetAgentTokenId: linked?.defaultTargetAgentTokenId ?? null,
          bodyOverride: undefined,
          userExecutionPlane: actor?.executionPlane ?? "eltpulse_managed",
        });
        targetAgentTokenId = resolved.targetAgentTokenId;
        ingestionExecutor = resolved.ingestionExecutor;
      } catch {
        return NextResponse.json({ error: "Invalid gateway token" }, { status: 400 });
      }

      const triggeredBy = `ui:dbt_${action}`;
      const workspaceOrganizationId = await resolveWorkspaceOrganizationId(
        runUserId,
        actor?.organizationId ?? null
      );
      const run = await db.eltPipelineRun.create({
        data: {
          userId: runUserId,
          pipelineId: linked?.id ?? null,
          dbtProjectId: project.id,
          workspaceOrganizationId,
          ingestionExecutor,
          status: "pending",
          environment,
          correlationId: crypto.randomUUID(),
          triggeredBy,
          partitionColumn: null,
          partitionValue: null,
          targetAgentTokenId,
        },
        include: {
          pipeline: { select: { id: true, name: true } },
          dbtProject: { select: { id: true, name: true } },
        },
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
        include: {
          pipeline: { select: { id: true, name: true } },
          dbtProject: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json(
        { run: refreshed ?? run, action, triggeredBy, dbtProjectId: project.id },
        { status: 201 }
      );
    }

    const pipeline = await db.eltPipeline.findFirst({
      where: { id: pipelineId!, ...pipelineOwnerWhere(perms.resourceOwnerIds) },
      select: {
        id: true,
        userId: true,
        name: true,
        enabled: true,
        executionHost: true,
        defaultTargetAgentTokenId: true,
        sourceConfiguration: true,
        dbtProjectId: true,
      },
    });

    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }
    if (!pipeline.enabled) {
      return NextResponse.json({ error: "Pipeline is disabled" }, { status: 400 });
    }

    const linkedProject = await loadDbtProjectForPipeline(pipeline);
    const effectiveConfig = resolveEffectiveSourceConfiguration(pipeline, linkedProject);
    if (!pipelineHasDbtEnabled(effectiveConfig)) {
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
    const workspaceOrganizationId = await resolveWorkspaceOrganizationId(
      pipeline.userId,
      actor?.organizationId ?? null
    );
    const run = await db.eltPipelineRun.create({
      data: {
        userId: pipeline.userId,
        pipelineId: pipeline.id,
        dbtProjectId: linkedProject?.id ?? dbtProjectId ?? null,
        workspaceOrganizationId,
        ingestionExecutor,
        status: "pending",
        environment,
        correlationId: crypto.randomUUID(),
        triggeredBy,
        partitionColumn: null,
        partitionValue: null,
        targetAgentTokenId,
      },
      include: {
        pipeline: { select: { id: true, name: true } },
        dbtProject: { select: { id: true, name: true } },
      },
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
      include: {
        pipeline: { select: { id: true, name: true } },
        dbtProject: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ run: refreshed ?? run, action, triggeredBy }, { status: 201 });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}
