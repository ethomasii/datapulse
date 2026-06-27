/**
 * GET /api/agent/runs?status=pending&limit=5
 *
 * Agent polls this to discover runs it should execute.
 * Returns runs with full pipeline manifest (code, config, workspace yaml).
 * Authenticated by Bearer agentToken.
 */
import { RunIngestionExecutor } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { getAgentAuthContext } from "@/lib/agent/auth";
import { agentPollRunsWhere } from "@/lib/agent/gateway-routing";
import { resolveExecutionPipelineManifest } from "@/lib/elt/resolve-execution-pipeline-manifest";
import { resolveRunConnectionEnv } from "@/lib/elt/deployments";

/** Customer gateways must not pick runs reserved for eltPulse-operated workers. */
const NOT_CUSTOMER_GATEWAY_POLL: RunIngestionExecutor[] = [
  RunIngestionExecutor.eltpulse_managed,
  RunIngestionExecutor.datapulse_managed,
];

export async function GET(req: Request) {
  const ctx = await getAgentAuthContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { user } = ctx;
  const namedId = ctx.agentTokenRow?.id ?? null;

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? "pending";
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") ?? 5) || 5));
  const pipelineId = url.searchParams.get("pipelineId") ?? undefined;

  const valid = new Set(["pending", "running", "succeeded", "failed", "cancelled"]);
  const statuses = statusParam.split(",").filter((s) => valid.has(s)) as ("pending" | "running" | "succeeded" | "failed" | "cancelled")[];

  const runs = await db.eltPipelineRun.findMany({
    where: {
      AND: [
        agentPollRunsWhere(user.id, namedId),
        { ingestionExecutor: { notIn: NOT_CUSTOMER_GATEWAY_POLL } },
        ...(statuses.length ? [{ status: { in: statuses } as const }] : []),
        ...(pipelineId ? [{ pipelineId }] : []),
      ],
    },
    orderBy: { startedAt: "asc" },
    take: limit,
    include: {
      pipeline: {
        select: {
          id: true,
          name: true,
          tool: true,
          sourceType: true,
          destinationType: true,
          sourceConfiguration: true,
          sourceConnectionId: true,
          destinationConnectionId: true,
          pipelineCode: true,
          configYaml: true,
          workspaceYaml: true,
          description: true,
          groupName: true,
        },
      },
    },
  });

  const hydrated = await Promise.all(
    runs.map(async (run) => {
      let connectionEnv: Record<string, string> | undefined;
      const pipelineOwnerId = run.userId;
      if (run.pipeline) {
        connectionEnv = await resolveRunConnectionEnv(pipelineOwnerId, run.pipeline, run.environment);
      }
      if (!run.pipeline || (run.pipeline.tool !== "dlt" && run.pipeline.tool !== "sling")) {
        return { ...run, connectionEnv };
      }
      const manifest = await resolveExecutionPipelineManifest(pipelineOwnerId, {
        id: run.pipeline.id,
        name: run.pipeline.name,
        tool: run.pipeline.tool,
        sourceType: run.pipeline.sourceType,
        destinationType: run.pipeline.destinationType,
        sourceConfiguration: run.pipeline.sourceConfiguration,
        pipelineCode: run.pipeline.pipelineCode ?? "",
        configYaml: run.pipeline.configYaml,
        workspaceYaml: run.pipeline.workspaceYaml,
        description: run.pipeline.description,
        groupName: run.pipeline.groupName,
      }, run.environment);
      return {
        ...run,
        connectionEnv,
        pipeline: {
          ...run.pipeline,
          pipelineCode: manifest.pipelineCode,
          configYaml: manifest.configYaml ?? run.pipeline.configYaml,
          workspaceYaml: manifest.workspaceYaml ?? run.pipeline.workspaceYaml,
          ...(manifest.sourceConfiguration !== undefined
            ? { sourceConfiguration: manifest.sourceConfiguration }
            : {}),
        },
        definitionSource: manifest.definitionSource,
        definitionGitRef: manifest.gitRef,
      };
    })
  );

  return NextResponse.json({ runs: hydrated });
}
