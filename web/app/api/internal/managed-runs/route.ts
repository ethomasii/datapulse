/**
 * GET /api/internal/managed-runs?limit=5
 *
 * Pending runs reserved for eltPulse-operated execution (`ingestionExecutor` managed).
 * Auth: `Authorization: Bearer ${ELTPULSE_INTERNAL_API_SECRET}`.
 *
 * Intended for eltPulse's own worker fleet (K8s jobs, VM agents, etc.) — not customer gateways.
 */
import { RunIngestionExecutor } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";

const MANAGED: RunIngestionExecutor[] = [
  RunIngestionExecutor.eltpulse_managed,
  RunIngestionExecutor.datapulse_managed,
];

export async function GET(req: Request) {
  const secret = process.env.ELTPULSE_INTERNAL_API_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") ?? 5) || 5));

  const runs = await db.eltPipelineRun.findMany({
    where: {
      status: "pending",
      ingestionExecutor: { in: MANAGED },
    },
    orderBy: { startedAt: "asc" },
    take: limit,
    include: {
      user: { select: { id: true, email: true } },
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
