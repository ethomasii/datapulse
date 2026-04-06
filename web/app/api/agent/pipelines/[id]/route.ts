/**
 * GET /api/agent/pipelines/:id
 *
 * Returns the full pipeline manifest the agent needs to execute a run:
 * pipeline code, config yaml, workspace yaml, and source configuration.
 * Authenticated by Bearer agentToken.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { getUserFromAgentToken } from "@/lib/agent/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const user = await getUserFromAgentToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const pipeline = await db.eltPipeline.findFirst({
    where: { id, userId: user.id },
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
      enabled: true,
    },
  });

  if (!pipeline) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ pipeline });
}
