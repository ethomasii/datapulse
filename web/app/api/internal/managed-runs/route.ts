import { RunIngestionExecutor, type Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { resolveExecutionPipelineCode } from "@/lib/elt/refresh-pipeline-artifacts-for-execution";

export const dynamic = "force-dynamic";

const MANAGED: RunIngestionExecutor[] = [
  RunIngestionExecutor.eltpulse_managed,
  RunIngestionExecutor.datapulse_managed,
];

function managedRunWhere(extra: Prisma.EltPipelineRunWhereInput): Prisma.EltPipelineRunWhereInput {
  return {
    status: "pending",
    ingestionExecutor: { in: MANAGED },
    ...extra,
  };
}

/** Shared pool: orgs on shared mode + runs without a workspace org. */
function sharedPoolWhere(): Prisma.EltPipelineRunWhereInput {
  return managedRunWhere({
    OR: [
      { workspaceOrganizationId: null },
      { workspaceOrganization: { managedComputeMode: "shared" } },
    ],
  });
}

/** Dedicated org queue: only pending runs for that org's isolated fleet with active billing. */
function dedicatedOrgWhere(organizationId: string): Prisma.EltPipelineRunWhereInput {
  return managedRunWhere({
    workspaceOrganizationId: organizationId,
    workspaceOrganization: {
      managedComputeMode: "dedicated",
      dedicatedComputeSubscriptionStatus: { in: ["active", "trialing"] },
    },
  });
}

export async function GET(req: Request) {
  const secret = process.env.ELTPULSE_INTERNAL_API_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") ?? 5) || 5));
  const organizationId = url.searchParams.get("organizationId")?.trim() || null;
  const pool = url.searchParams.get("pool")?.trim().toLowerCase() || null;

  let where: Prisma.EltPipelineRunWhereInput;
  if (organizationId) {
    where = dedicatedOrgWhere(organizationId);
  } else if (pool === "shared") {
    where = sharedPoolWhere();
  } else {
    // Legacy: all pending managed runs (single shared worker without pool filter).
    where = managedRunWhere({});
  }

  const runs = await db.eltPipelineRun.findMany({
    where,
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
          description: true,
          groupName: true,
        },
      },
    },
  });

  const runsWithFreshCode = await Promise.all(
    runs.map(async (run) => {
      if (!run.pipeline) return run;
      const pipelineCode = await resolveExecutionPipelineCode(run.user.id, {
        ...run.pipeline,
        pipelineCode: run.pipeline.pipelineCode ?? "",
      });
      return {
        ...run,
        pipeline: { ...run.pipeline, pipelineCode },
      };
    })
  );

  return NextResponse.json({ runs: runsWithFreshCode, pool: organizationId ? "dedicated" : pool ?? "all" });
}
