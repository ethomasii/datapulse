import { db } from "@/lib/db/client";
import { ELTPULSE_REPO } from "@/lib/elt/eltpulse-repo-layout";
import { githubJson } from "@/lib/integrations/github-rest";
import {
  getWorkspaceGithubSettings,
  resolveUserDevelopmentBranch,
} from "@/lib/elt/workspace-github";
import { pushPipelineToGithub } from "@/lib/integrations/github-push-pipeline";
import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";

export type CreatePromotionPrResult =
  | { ok: true; htmlUrl: string; number: number; alreadyExists?: boolean }
  | { ok: false; error: string };

type GithubPull = {
  number: number;
  html_url: string;
  state: string;
  head: { ref: string };
  base: { ref: string };
};

/** Open (or return existing) PR from the user's dev branch → production branch. */
export async function createPromotionPullRequest(
  actingUserId: string,
  pipelineId: string,
  opts: { title: string; body?: string; pushFirst?: boolean }
): Promise<CreatePromotionPrResult> {
  const settings = await getWorkspaceGithubSettings(actingUserId);
  if (!settings?.token || !settings.repo) {
    return { ok: false, error: "GitHub is not connected or repository not configured." };
  }

  const ownerIds = await getAccessibleResourceOwnerIds(actingUserId);
  const pipeline = await db.eltPipeline.findFirst({
    where: { id: pipelineId, userId: { in: ownerIds } },
    select: { name: true },
  });
  if (!pipeline) return { ok: false, error: "Pipeline not found." };

  const head = resolveUserDevelopmentBranch(settings);
  const base = settings.repo.productionBranch;
  if (head === base) {
    return { ok: false, error: "Dev branch matches production — nothing to promote." };
  }

  if (opts.pushFirst !== false) {
    const push = await pushPipelineToGithub(actingUserId, pipelineId, {
      branch: head,
      commitMessage: `[eltpulse] Pre-promote ${pipeline.name}`,
    });
    if (!push.ok && !push.skipped) {
      return { ok: false, error: push.error ?? "Could not push latest YAML before opening PR." };
    }
  }

  const { owner, name: repo } = settings.repo;
  const listPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=open&head=${encodeURIComponent(`${owner}:${head}`)}&base=${encodeURIComponent(base)}`;
  const existing = await githubJson<GithubPull[]>(settings.token, listPath);
  if (existing.ok && Array.isArray(existing.json) && existing.json.length > 0) {
    const pr = existing.json[0]!;
    return { ok: true, htmlUrl: pr.html_url, number: pr.number, alreadyExists: true };
  }

  const title = opts.title.trim() || `[eltpulse] Promote ${pipeline.name}`;
  const body =
    opts.body?.trim() ||
    [
      `Promote pipeline **${pipeline.name}** to production.`,
      "",
      `- **From:** \`${head}\``,
      `- **To:** \`${base}\``,
      `- **Path:** \`${ELTPULSE_REPO.pipelinesDir}/${pipeline.name}.yaml\``,
      "",
      "_Opened from eltPulse._",
    ].join("\n");

  const create = await githubJson<GithubPull & { message?: string }>(
    settings.token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, head, base }),
    }
  );

  if (!create.ok || !create.json?.html_url) {
    const msg =
      create.json && typeof create.json.message === "string"
        ? create.json.message
        : "GitHub rejected the pull request.";
    return { ok: false, error: msg };
  }

  return { ok: true, htmlUrl: create.json.html_url, number: create.json.number };
}
