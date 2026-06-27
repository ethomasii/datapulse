import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { getWorkspacePermissions } from "@/lib/auth/org-permissions";
import {
  diffPipelineAgainstGitRef,
  fetchPipelineGitHistory,
  getPipelineGitSyncStatus,
  listPipelineRevisions,
  promotePipelineToProduction,
  pushPipelineToGitBranch,
  restorePipelineFromGitCommit,
  restorePipelineRevision,
} from "@/lib/elt/pipeline-git-sync";
import {
  listPipelineDeploymentBindings,
  upsertPipelineDeploymentBindings,
} from "@/lib/elt/deployments";
import { resolveRouteParamId } from "@/lib/server/route-params";

type Ctx = { params: Promise<{ id: string }> };

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("promote_to_production") }),
  z.object({ action: z.literal("push"), branch: z.enum(["production", "development"]).optional() }),
  z.object({ action: z.literal("restore_git"), commitSha: z.string().min(7).max(64) }),
  z.object({ action: z.literal("restore_revision"), revisionId: z.string().min(1) }),
  z.object({
    action: z.literal("save_bindings"),
    bindings: z.array(
      z.object({
        deploymentId: z.string().min(1),
        sourceConnectionId: z.string().nullable().optional(),
        destinationConnectionId: z.string().nullable().optional(),
      })
    ),
  }),
]);

export async function GET(req: Request, ctx: Ctx) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pipelineId = await resolveRouteParamId(ctx.params);
  const url = new URL(req.url);
  const ref = url.searchParams.get("diffRef")?.trim();

  try {
    const [sync, gitHistory, revisions, bindings] = await Promise.all([
      getPipelineGitSyncStatus(user.id, pipelineId),
      fetchPipelineGitHistory(user.id, pipelineId, 25),
      listPipelineRevisions(user.id, pipelineId, 25),
      listPipelineDeploymentBindings(user.id, pipelineId),
    ]);

    const diff = ref ? await diffPipelineAgainstGitRef(user.id, pipelineId, ref) : null;

    return NextResponse.json({
      sync,
      gitHistory,
      revisions: revisions.map((r) => ({
        id: r.id,
        message: r.message,
        gitCommitSha: r.gitCommitSha,
        createdAt: r.createdAt.toISOString(),
      })),
      deploymentBindings: bindings,
      ...(diff && !("error" in diff) ? { diff } : {}),
      ...(diff && "error" in diff ? { diffError: diff.error } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("PipelineRevision") || msg.includes("does not exist")) {
      return NextResponse.json(
        { error: "Run prisma db push — pipeline revisions / deployments tables missing." },
        { status: 503 }
      );
    }
    throw e;
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const perms = await getWorkspacePermissions(user.id);
  if (!perms.canWrite) return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const pipelineId = await resolveRouteParamId(ctx.params);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const body = parsed.data;

  if (body.action === "promote_to_production") {
    const result = await promotePipelineToProduction(user.id, pipelineId);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, skipped: result.skipped ?? false },
        { status: result.skipped ? 400 : 502 }
      );
    }
    return NextResponse.json(result);
  }

  if (body.action === "push") {
    const result = await pushPipelineToGitBranch(user.id, pipelineId, { branch: body.branch ?? "production" });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, skipped: result.skipped ?? false },
        { status: result.skipped ? 400 : 502 }
      );
    }
    return NextResponse.json(result);
  }

  if (body.action === "restore_git") {
    const result = await restorePipelineFromGitCommit(user.id, pipelineId, body.commitSha);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "restore_revision") {
    const result = await restorePipelineRevision(user.id, pipelineId, body.revisionId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  await upsertPipelineDeploymentBindings(user.id, pipelineId, body.bindings);
  void pushPipelineToGitBranch(user.id, pipelineId, {
    branch: "development",
    commitMessage: `[eltpulse] Update deployment bindings`,
  }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
