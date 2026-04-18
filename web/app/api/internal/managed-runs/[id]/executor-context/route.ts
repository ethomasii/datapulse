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
    },
  });

  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
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
  const [source, destination] = await Promise.all([
    loadConnection(userId, run.pipeline.sourceConnectionId),
    loadConnection(userId, run.pipeline.destinationConnectionId),
  ]);

  return NextResponse.json({
    run: {
      id: run.id,
      status: run.status,
      partitionValue: run.partitionValue,
      partitionColumn: run.partitionColumn,
      correlationId: run.correlationId,
    },
    pipeline: run.pipeline,
    connections: { source, destination },
  });
}
