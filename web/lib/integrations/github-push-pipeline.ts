import { db } from "@/lib/db/client";
import { ELTPULSE_REPO } from "@/lib/elt/eltpulse-repo-layout";
import { eltPipelineToDeclarativeYamlString } from "@/lib/elt/pipeline-spec-export";
import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";
import {
  getWorkspaceGithubSettings,
  resolveUserDevelopmentBranch,
} from "@/lib/elt/workspace-github";
import { githubJson, githubRepoContentsApiPath } from "@/lib/integrations/github-rest";
import {
  resolveUserPlanTier,
  tierAllowsGitArtifactExport,
  upgradeMessageForFeature,
} from "@/lib/plans/tier-features";

export type PushPipelineResult =
  | { ok: true; path: string; branch: string; htmlUrl: string | null }
  | { ok: false; skipped?: boolean; error: string };

/**
 * Push pipeline declaration YAML to the workspace GitHub repo.
 * Canvas saves target the acting user's dev branch (personal or shared).
 */
export async function pushPipelineToGithub(
  actingUserId: string,
  pipelineId: string,
  options?: { branch?: string; commitMessage?: string }
): Promise<PushPipelineResult> {
  const tier = await resolveUserPlanTier(actingUserId);
  if (!tierAllowsGitArtifactExport(tier)) {
    return {
      ok: false,
      skipped: true,
      error: upgradeMessageForFeature("Git artifact export", "pro"),
    };
  }

  const settings = await getWorkspaceGithubSettings(actingUserId);
  if (!settings?.token || !settings.repo) {
    return { ok: false, skipped: true, error: "GitHub is not connected or repository not configured" };
  }

  const branch = options?.branch?.trim() || resolveUserDevelopmentBranch(settings);
  const { owner, name } = settings.repo;

  const ownerIds = await getAccessibleResourceOwnerIds(actingUserId);
  const row = await db.eltPipeline.findFirst({
    where: { id: pipelineId, userId: { in: ownerIds } },
  });
  if (!row) {
    return { ok: false, error: "Pipeline not found" };
  }

  const yamlText = await eltPipelineToDeclarativeYamlString(row, {
    includeDeployments: true,
    actingUserId,
  });
  const relPath = `${ELTPULSE_REPO.pipelinesDir}/${row.name}.yaml`;
  const fileUrlPath = githubRepoContentsApiPath(owner, name, relPath);
  const fileUrlWithRef = `${fileUrlPath}?ref=${encodeURIComponent(branch)}`;

  const existing = await githubJson<{ sha?: string }>(settings.token, fileUrlWithRef);
  let sha: string | undefined;
  if (existing.ok && existing.json && typeof existing.json.sha === "string") {
    sha = existing.json.sha;
  }

  const putBody: Record<string, unknown> = {
    message: options?.commitMessage?.trim() || `[eltpulse] Sync pipeline ${row.name}`,
    content: Buffer.from(yamlText, "utf8").toString("base64"),
    branch,
  };
  if (sha) putBody.sha = sha;

  const put = await fetch(`https://api.github.com${fileUrlPath}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${settings.token}`,
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
    branch,
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
