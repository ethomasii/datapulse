/**
 * GET /api/agent/runs?status=pending&limit=5
 *
 * Agent polls this to discover runs it should execute.
 * Returns runs with full pipeline manifest (code, config, workspace yaml).
 * Authenticated by Bearer agentToken.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { getUserFromAgentToken } from "@/lib/agent/auth";

export async function GET(req: Request) {
  const user = await getUserFromAgentToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? "pending";
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") ?? 5) || 5));
  const pipelineId = url.searchParams.get("pipelineId") ?? undefined;

  const valid = new Set(["pending", "running", "succeeded", "failed", "cancelled"]);
  const statuses = statusParam.split(",").filter((s) => valid.has(s)) as ("pending" | "running" | "succeeded" | "failed" | "cancelled")[];

  const runs = await db.eltPipelineRun.findMany({
    where: {
      userId: user.id,
      status: statuses.length ? { in: statuses } : undefined,
      ...(pipelineId ? { pipelineId } : {}),
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
