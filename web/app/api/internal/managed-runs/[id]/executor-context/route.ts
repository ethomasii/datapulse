/**
 * GET /api/internal/managed-runs/:id/executor-context
 *
 * Returns pipeline artifacts + decrypted connection secrets for a **claimed** managed run
 * (`status === "running"`). Prevents leaking secrets for pending runs still in the queue.
 *
 * Auth: `Authorization: Bearer ${ELTPULSE_INTERNAL_API_SECRET}`.
 */
import { RunIngestionExecutor } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { parseStoredConnectionSecrets } from "@/lib/elt/connection-secrets-store";
import { sourceConfigurationFromDbtProject } from "@/lib/elt/dbt-projects";
import { resolveRouteParamId } from "@/lib/server/route-params";

export const dynamic = "force-dynamic";

const MANAGED: RunIngestionExecutor[] = [
  RunIngestionExecutor.eltpulse_managed,
  RunIngestionExecutor.datapulse_managed,
];

type Ctx = { params: { id: string } | Promise<{ id: string }> };

async function loadConnection(userId: string, id: string | null) {
  if (!id) return null;
  const row = await db.connection.findFirst({
    where: { id, userId },
    select: {
      id: true,
      name: true,
      connectionType: true,
      connector: true,
      config: true,
      connectionSecretsEnc: true,
    },
  });
  if (!row) return null;
  const { connectionSecretsEnc, ...rest } = row;
  return {
    ...rest,
    secrets: parseStoredConnectionSecrets(connectionSecretsEnc),
  };
}

export async function GET(req: Request, ctx: Ctx) {
  const secret = process.env.ELTPULSE_INTERNAL_API_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = await resolveRouteParamId(ctx.params);

  const run = await db.eltPipelineRun.findFirst({
    where: { id },
    include: {
      pipeline: {
        select: {
          id: true,
          name: true,
          tool: true,
          sourceType: true,
          destinationType: true,
          sourceConfiguration: true,
          pipelineCode: true,
          configYaml: true,
          workspaceYaml: true,
          sourceConnectionId: true,
          destinationConnectionId: true,
        },
      },
      dbtProject: {
        select: {
          id: true,
          name: true,
          packagePath: true,
          gitUrl: true,
          gitBranch: true,
          gitSubpath: true,
          targetSchema: true,
          runScope: true,
          selector: true,
          scheduleEnabled: true,
          cronSchedule: true,
          scheduleTimezone: true,
          hubPackageKey: true,
          destinationConnectionId: true,
        },
      },
    },
  });

  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!run.pipeline && !run.dbtProject) {
    return NextResponse.json({ error: "Run has no pipeline or dbt project" }, { status: 409 });
  }
  if (!MANAGED.includes(run.ingestionExecutor)) {
    return NextResponse.json({ error: "Run is not managed-ingestion" }, { status: 403 });
  }
  if (run.status !== "running") {
    return NextResponse.json(
      { error: "Executor context is only available after the run is claimed (status running)." },
      { status: 409 }
    );
  }

  const userId = run.userId;
  const destinationConnectionId =
    run.pipeline?.destinationConnectionId ?? run.dbtProject?.destinationConnectionId ?? null;
  const [source, destination] = await Promise.all([
    loadConnection(userId, run.pipeline?.sourceConnectionId ?? null),
    loadConnection(userId, destinationConnectionId),
  ]);

  const pipelinePayload = run.pipeline ?? {
    id: run.dbtProject!.id,
    name: run.dbtProject!.name,
    tool: "dbt",
    sourceType: "dbt",
    destinationType: destination?.connector ?? "warehouse",
    sourceConfiguration: sourceConfigurationFromDbtProject(run.dbtProject!),
    pipelineCode: null,
    configYaml: null,
    workspaceYaml: null,
    sourceConnectionId: null,
    destinationConnectionId,
  };

  return NextResponse.json({
    run: {
      id: run.id,
      status: run.status,
      partitionValue: run.partitionValue,
      partitionColumn: run.partitionColumn,
      correlationId: run.correlationId,
      triggeredBy: run.triggeredBy,
      dbtProjectId: run.dbtProjectId,
    },
    pipeline: pipelinePayload,
    dbtProject: run.dbtProject ?? null,
    connections: { source, destination },
  });
}
