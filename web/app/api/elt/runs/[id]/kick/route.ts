import { NextResponse } from "next/server";
import {
  API_SCOPES,
  hasScope,
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { getWorkspacePermissions } from "@/lib/auth/org-permissions";
import { db } from "@/lib/db/client";
import { processManagedRunImmediately } from "@/lib/elt/process-managed-run";
import { refreshAndPersistPipelineArtifacts } from "@/lib/elt/refresh-pipeline-artifacts-for-execution";

type RouteContext = { params: { id: string } };

/** Re-dispatch a stuck pending managed run (same path as create-and-run). */
export async function POST(req: Request, context: RouteContext) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.RUNS_WRITE)) return scopeForbiddenResponse();

  const perms = await getWorkspacePermissions(auth.user.id);
  if (!perms.canWrite) {
    return NextResponse.json({ error: "View-only access" }, { status: 403 });
  }

  const { id } = context.params;
  const ownerIds = perms.resourceOwnerIds;
  const run = await db.eltPipelineRun.findFirst({
    where: { id, userId: { in: ownerIds } },
    select: { id: true, status: true, ingestionExecutor: true, pipelineId: true, userId: true },
  });
  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isManaged =
    run.ingestionExecutor === "eltpulse_managed" || run.ingestionExecutor === "datapulse_managed";
  if (!isManaged) {
    return NextResponse.json(
      { error: "Only eltPulse-managed runs can be kicked from the control plane." },
      { status: 400 }
    );
  }
  if (run.status !== "pending") {
    return NextResponse.json({ error: `Run is already ${run.status}.` }, { status: 409 });
  }

  try {
    if (run.pipelineId) {
      try {
        await refreshAndPersistPipelineArtifacts(run.userId, run.pipelineId);
      } catch (e) {
        console.warn("[elt/runs/kick] pipeline artifact refresh failed", run.pipelineId, e);
      }
    }
    const dispatch = await processManagedRunImmediately(run.id);
    const refreshed = await db.eltPipelineRun.findFirst({
      where: { id: run.id },
      include: {
        pipeline: { select: { id: true, name: true, tool: true, sourceType: true, sourceConfiguration: true } },
        dbtProject: { select: { id: true, name: true } },
        targetAgentToken: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      run: refreshed,
      dispatch,
    });
  } catch (e) {
    console.error("[elt/runs/kick]", run.id, e);
    return NextResponse.json({ error: "Failed to start managed worker" }, { status: 502 });
  }
}
