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
          pipelineCode: true,
          configYaml: true,
          workspaceYaml: true,
        },
      },
    },
  });

  return NextResponse.json({ runs });
}
