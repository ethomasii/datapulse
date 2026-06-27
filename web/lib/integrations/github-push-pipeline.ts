import { db } from "@/lib/db/client";
import { getGithubConnectionForUser } from "@/lib/db/github-connection-query";
import { ELTPULSE_REPO } from "@/lib/elt/eltpulse-repo-layout";
import { eltPipelineToDeclarativeYamlString } from "@/lib/elt/pipeline-spec-export";
import { getGithubAccessTokenForUser } from "@/lib/integrations/github-access-token";
import { githubJson, githubRepoContentsApiPath } from "@/lib/integrations/github-rest";
import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";
import {
  resolveUserPlanTier,
  tierAllowsGitArtifactExport,
  upgradeMessageForFeature,
} from "@/lib/plans/tier-features";

function repoContext(
  owner: string | null | undefined,
  name: string | null | undefined,
  branch: string | null | undefined
): { ok: true; owner: string; name: string; branch: string } | { ok: false; message: string } {
  const o = owner?.trim();
  const n = name?.trim();
  if (!o || !n) {
    return {
      ok: false,
      message: "Set default GitHub owner and repository under Repositories.",
    };
  }
  const br = (branch?.trim() || "main") || "main";
  return { ok: true, owner: o, name: n, branch: br };
}

export type PushPipelineResult =
  | { ok: true; path: string; branch: string; htmlUrl: string | null }
  | { ok: false; skipped?: boolean; error: string };

/**
 * Push pipeline declaration YAML to the user's connected GitHub repo.
 * Used by Repositories UI and auto-push on pipeline save.
 */
export async function pushPipelineToGithub(
  userId: string,
  pipelineId: string,
  options?: { branch?: string; commitMessage?: string }
): Promise<PushPipelineResult> {
  const tier = await resolveUserPlanTier(userId);
  if (!tierAllowsGitArtifactExport(tier)) {
    return {
      ok: false,
      skipped: true,
      error: upgradeMessageForFeature("Git artifact export", "pro"),
    };
  }

  const token = await getGithubAccessTokenForUser(userId);
  if (!token) {
    return { ok: false, skipped: true, error: "GitHub is not connected" };
  }

  const { row: gh } = await getGithubConnectionForUser(userId);
  const ctx = repoContext(
    gh?.defaultRepoOwner,
    gh?.defaultRepoName,
    options?.branch ?? gh?.defaultBranch
  );
  if (!ctx.ok) {
    return { ok: false, skipped: true, error: ctx.message };
  }

  const ownerIds = await getAccessibleResourceOwnerIds(userId);
  const row = await db.eltPipeline.findFirst({
    where: { id: pipelineId, userId: { in: ownerIds } },
  });
  if (!row) {
    return { ok: false, error: "Pipeline not found" };
  }

  const yamlText = await eltPipelineToDeclarativeYamlString(row);
  const relPath = `${ELTPULSE_REPO.pipelinesDir}/${row.name}.yaml`;
  const fileUrlPath = githubRepoContentsApiPath(ctx.owner, ctx.name, relPath);
  const fileUrlWithRef = `${fileUrlPath}?ref=${encodeURIComponent(ctx.branch)}`;

  const existing = await githubJson<{ sha?: string }>(token, fileUrlWithRef);
  let sha: string | undefined;
  if (existing.ok && existing.json && typeof existing.json.sha === "string") {
    sha = existing.json.sha;
  }

  const putBody: Record<string, unknown> = {
    message: options?.commitMessage?.trim() || `[eltpulse] Sync pipeline ${row.name}`,
    content: Buffer.from(yamlText, "utf8").toString("base64"),
    branch: ctx.branch,
  };
  if (sha) putBody.sha = sha;

  const put = await fetch(`https://api.github.com${fileUrlPath}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(putBody),
  });

  const putJson = (await put.json()) as {
    message?: string;
    content?: { html_url?: string };
    commit?: { html_url?: string };
  };
  if (!put.ok) {
    const msg = typeof putJson.message === "string" ? putJson.message : "GitHub rejected the commit.";
    return { ok: false, error: msg };
  }

  return {
    ok: true,
    path: relPath,
    branch: ctx.branch,
    htmlUrl: putJson.content?.html_url ?? putJson.commit?.html_url ?? null,
  };
}

/** Fire-and-forget Git push after pipeline save when GitHub is connected. */
export async function maybeAutoPushPipelineToGit(userId: string, pipelineId: string): Promise<void> {
  const disabled =
    process.env.ELTPULSE_AUTO_GIT_PUSH === "0" || process.env.ELTPULSE_AUTO_GIT_PUSH === "false";
  if (disabled) return;
  try {
    await pushPipelineToGithub(userId, pipelineId);
  } catch {
    /* non-fatal */
  }
}
