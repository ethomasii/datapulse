import { createHash } from "node:crypto";
import { db } from "@/lib/db/client";
import { ELTPULSE_REPO } from "@/lib/elt/eltpulse-repo-layout";
import { eltPipelineToDeclarativeYamlString } from "@/lib/elt/pipeline-spec-export";
import { parsePipelineDeclarationYaml, parseAndCompileDeclarativeYaml } from "@/lib/elt/parse-pipeline-declaration";
import { upsertPipelineDefinition } from "@/lib/elt/persist-pipeline";
import { getGithubConnectionForUser } from "@/lib/db/github-connection-query";
import { getGithubAccessTokenForUser } from "@/lib/integrations/github-access-token";
import {
  decodeGithubFileContent,
  githubJson,
  githubRepoContentsApiPath,
  type GithubContentFile,
} from "@/lib/integrations/github-rest";
import { pushPipelineToGithub, type PushPipelineResult } from "@/lib/integrations/github-push-pipeline";
import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";
import type { PipelineGitCommit } from "@/lib/elt/asset-pipeline-github-history";
import {
  getWorkspaceGithubSettings,
  githubPromoteCompareUrl as workspacePromoteCompareUrl,
  resolveUserDevelopmentBranch,
} from "@/lib/elt/workspace-github";

export type PipelineGitSyncStatus = {
  connected: boolean;
  repo: { owner: string; name: string; productionBranch: string; developmentBranch: string } | null;
  /** Branch this user's canvas saves sync against. */
  workingBranch: string | null;
  path: string | null;
  inSync: boolean | null;
  localSha: string | null;
  remoteSha: string | null;
  lastPushedAt: string | null;
  prodInSync?: boolean | null;
  productionDefinitionSource: "neon" | "git";
  developmentDefinitionSource: "neon" | "git";
  personalDevBranch: string | null;
  message: string | null;
};

export type PipelineGitDiffLine = {
  type: "same" | "add" | "remove";
  text: string;
};

function normalizeYamlForHash(text: string): string {
  return text.replace(/\r\n/g, "\n").trimEnd() + "\n";
}

export function hashDeclarativeYaml(text: string): string {
  return createHash("sha256").update(normalizeYamlForHash(text), "utf8").digest("hex").slice(0, 16);
}

/** Simple line diff for UI (not a full Myers diff). */
export function diffYamlLines(local: string, remote: string): PipelineGitDiffLine[] {
  const a = normalizeYamlForHash(local).split("\n");
  const b = normalizeYamlForHash(remote).split("\n");
  const out: PipelineGitDiffLine[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    const left = a[i];
    const right = b[i];
    if (left === right) {
      if (left !== undefined) out.push({ type: "same", text: left });
    } else {
      if (left !== undefined) out.push({ type: "remove", text: left });
      if (right !== undefined) out.push({ type: "add", text: right });
    }
  }
  return out;
}

function repoContextFromGh(
  gh: Awaited<ReturnType<typeof getGithubConnectionForUser>>["row"]
): { owner: string; name: string; productionBranch: string; developmentBranch: string } | null {
  const owner = gh?.defaultRepoOwner?.trim();
  const name = gh?.defaultRepoName?.trim();
  if (!owner || !name) return null;
  return {
    owner,
    name,
    productionBranch: gh?.defaultBranch?.trim() || "main",
    developmentBranch:
      gh?.developmentBranch?.trim() || "develop",
  };
}

async function fetchRemoteYamlAtRef(
  token: string,
  ctx: { owner: string; name: string },
  path: string,
  ref: string
): Promise<{ yaml: string; sha: string } | null> {
  const fp = githubRepoContentsApiPath(ctx.owner, ctx.name, path, ref);
  const res = await githubJson<GithubContentFile>(token, fp);
  if (!res.ok || !res.json || res.json.encoding !== "base64") return null;
  return {
    yaml: decodeGithubFileContent(res.json),
    sha: res.json.sha,
  };
}

export async function getPipelineGitSyncStatus(
  userId: string,
  pipelineId: string
): Promise<PipelineGitSyncStatus> {
  const ownerIds = await getAccessibleResourceOwnerIds(userId);
  const row = await db.eltPipeline.findFirst({
    where: { id: pipelineId, userId: { in: ownerIds } },
  });
  if (!row) {
    return {
      connected: false,
      repo: null,
      workingBranch: null,
      path: null,
      inSync: null,
      localSha: null,
      remoteSha: null,
      lastPushedAt: null,
      productionDefinitionSource: "neon",
      developmentDefinitionSource: "neon",
      personalDevBranch: null,
      message: "Pipeline not found",
    };
  }

  const settings = await getWorkspaceGithubSettings(userId);
  const path = `${ELTPULSE_REPO.pipelinesDir}/${row.name}.yaml`;

  if (!settings?.token || !settings.repo) {
    return {
      connected: Boolean(settings?.connection),
      repo: settings?.repo ?? null,
      workingBranch: settings ? resolveUserDevelopmentBranch(settings) : null,
      path,
      inSync: null,
      localSha: null,
      remoteSha: null,
      lastPushedAt: null,
      productionDefinitionSource: settings?.productionDefinitionSource ?? "neon",
      developmentDefinitionSource: settings?.developmentDefinitionSource ?? "neon",
      personalDevBranch: settings?.personalDevBranch ?? null,
      message: settings?.connection
        ? "Set default GitHub repository under Repositories."
        : "GitHub is not connected.",
    };
  }

  const repo = settings.repo;
  const workingBranch = resolveUserDevelopmentBranch(settings);
  const token = settings.token;

  const localYaml = await eltPipelineToDeclarativeYamlString(row);
  const localSha = hashDeclarativeYaml(localYaml);

  const remote = await fetchRemoteYamlAtRef(token, repo, path, workingBranch);
  if (!remote) {
    return {
      connected: true,
      repo,
      path,
      inSync: false,
      localSha,
      remoteSha: null,
      lastPushedAt: null,
      message: `Not yet pushed to Git (${workingBranch} branch).`,
      workingBranch,
      productionDefinitionSource: settings.productionDefinitionSource,
      developmentDefinitionSource: settings.developmentDefinitionSource,
      personalDevBranch: settings.personalDevBranch,
    };
  }

  const remoteSha = hashDeclarativeYaml(remote.yaml);
  const prodRemote = await fetchRemoteYamlAtRef(token, repo, path, repo.productionBranch);
  const prodSha = prodRemote ? hashDeclarativeYaml(prodRemote.yaml) : null;
  const prodInSync = prodSha != null && prodSha === remoteSha;

  return {
    connected: true,
    repo,
    workingBranch,
    path,
    inSync: localSha === remoteSha,
    localSha,
    remoteSha,
    lastPushedAt: row.updatedAt.toISOString(),
    prodInSync,
    productionDefinitionSource: settings.productionDefinitionSource,
    developmentDefinitionSource: settings.developmentDefinitionSource,
    personalDevBranch: settings.personalDevBranch,
    message:
      localSha === remoteSha
        ? prodInSync
          ? `In sync with ${workingBranch}; production (${repo.productionBranch}) matches.`
          : `In sync with ${workingBranch}. Merge to ${repo.productionBranch} on GitHub to promote.`
        : `Canvas differs from ${workingBranch} on GitHub.`,
  };
}

export async function fetchPipelineGitHistory(
  userId: string,
  pipelineId: string,
  limit = 20
): Promise<PipelineGitCommit[]> {
  const ownerIds = await getAccessibleResourceOwnerIds(userId);
  const row = await db.eltPipeline.findFirst({
    where: { id: pipelineId, userId: { in: ownerIds } },
    select: { name: true },
  });
  if (!row) return [];

  const { fetchPipelineGithubHistory } = await import("@/lib/elt/asset-pipeline-github-history");
  return fetchPipelineGithubHistory(userId, row.name, limit);
}

export async function diffPipelineAgainstGitRef(
  userId: string,
  pipelineId: string,
  ref: string
): Promise<{ local: string; remote: string; diff: PipelineGitDiffLine[] } | { error: string }> {
  const ownerIds = await getAccessibleResourceOwnerIds(userId);
  const row = await db.eltPipeline.findFirst({
    where: { id: pipelineId, userId: { in: ownerIds } },
  });
  if (!row) return { error: "Pipeline not found" };

  const settings = await getWorkspaceGithubSettings(userId);
  if (!settings?.token || !settings.repo) return { error: "GitHub repository not configured" };

  const path = `${ELTPULSE_REPO.pipelinesDir}/${row.name}.yaml`;
  const remote = await fetchRemoteYamlAtRef(settings.token, settings.repo, path, ref);
  if (!remote) return { error: `Could not load ${path} at ${ref}` };

  const local = await eltPipelineToDeclarativeYamlString(row);
  return { local, remote: remote.yaml, diff: diffYamlLines(local, remote.yaml) };
}

export async function restorePipelineFromGitCommit(
  userId: string,
  pipelineId: string,
  commitSha: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ownerIds = await getAccessibleResourceOwnerIds(userId);
  const row = await db.eltPipeline.findFirst({
    where: { id: pipelineId, userId: { in: ownerIds } },
    select: { name: true },
  });
  if (!row) return { ok: false, error: "Pipeline not found" };

  const settings = await getWorkspaceGithubSettings(userId);
  if (!settings?.token || !settings.repo) return { ok: false, error: "GitHub repository not configured" };

  const path = `${ELTPULSE_REPO.pipelinesDir}/${row.name}.yaml`;
  const remote = await fetchRemoteYamlAtRef(settings.token, settings.repo, path, commitSha);
  if (!remote) return { ok: false, error: "Could not load file at that commit" };

  try {
    let parsed;
    try {
      parsed = await parseAndCompileDeclarativeYaml(userId, remote.yaml);
    } catch {
      parsed = parsePipelineDeclarationYaml(remote.yaml);
    }
    const result = await upsertPipelineDefinition(userId, parsed.body, {
      ...(parsed.declarativeSpecYaml ? { declarativeSpecYaml: parsed.declarativeSpecYaml } : {}),
      ...(parsed.deploymentBindings ? { deploymentBindings: parsed.deploymentBindings } : {}),
    });
    if (!result.ok) return { ok: false, error: result.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function syncPipelineFromProductionBranch(
  userId: string,
  pipelineId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const settings = await getWorkspaceGithubSettings(userId);
  if (!settings?.repo) return { ok: false, error: "GitHub repository not configured" };
  return restorePipelineFromGitCommit(userId, pipelineId, settings.repo.productionBranch);
}

export function githubPromoteCompareUrl(
  repo: { owner: string; name: string; productionBranch: string; developmentBranch: string },
  workingBranch?: string
): string | null {
  const dev = workingBranch?.trim() || repo.developmentBranch;
  if (dev === repo.productionBranch) return null;
  return `https://github.com/${repo.owner}/${repo.name}/compare/${encodeURIComponent(repo.productionBranch)}...${encodeURIComponent(dev)}?expand=1`;
}

export async function promotePipelineToProduction(
  userId: string,
  pipelineId: string
): Promise<PushPipelineResult & { compareUrl?: string | null; deployedAt?: string }> {
  const result = await pushPipelineToGitBranch(userId, pipelineId, {
    branch: "production",
    commitMessage: `[eltpulse] Deploy to production`,
  });
  if (!result.ok) return result;

  const { recordWorkspaceAuditForUser } = await import("@/lib/audit/workspace-audit");
  void recordWorkspaceAuditForUser({
    userId,
    action: "pipeline.updated",
    detail: { pipelineId, deployedToProduction: true, branch: result.branch, path: result.path },
  });

  return { ...result, deployedAt: new Date().toISOString() };
}

export async function pushPipelineToGitBranch(
  userId: string,
  pipelineId: string,
  options?: { branch?: "production" | "development"; commitMessage?: string }
): Promise<PushPipelineResult & { compareUrl?: string | null }> {
  const settings = await getWorkspaceGithubSettings(userId);
  if (!settings?.repo) {
    return { ok: false, skipped: true, error: "GitHub repository not configured" };
  }

  const branch =
    options?.branch === "production"
      ? settings.repo.productionBranch
      : resolveUserDevelopmentBranch(settings);

  const result = await pushPipelineToGithub(userId, pipelineId, {
    branch,
    commitMessage: options?.commitMessage,
  });

  if (!result.ok) return result;

  const compareUrl =
    options?.branch === "development" && branch !== settings.repo.productionBranch
      ? workspacePromoteCompareUrl(settings)
      : null;

  return { ...result, compareUrl };
}

export async function recordPipelineRevision(
  pipelineId: string,
  declarativeSpecYaml: string,
  opts?: { message?: string; gitCommitSha?: string }
): Promise<void> {
  const yaml = declarativeSpecYaml.trimEnd() + "\n";
  await db.pipelineRevision.create({
    data: {
      pipelineId,
      declarativeSpecYaml: yaml,
      message: opts?.message ?? null,
      gitCommitSha: opts?.gitCommitSha ?? null,
    },
  });

  const keep = 50;
  const stale = await db.pipelineRevision.findMany({
    where: { pipelineId },
    orderBy: { createdAt: "desc" },
    skip: keep,
    select: { id: true },
  });
  if (stale.length) {
    await db.pipelineRevision.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  }
}

export async function listPipelineRevisions(userId: string, pipelineId: string, limit = 20) {
  const ownerIds = await getAccessibleResourceOwnerIds(userId);
  const pipeline = await db.eltPipeline.findFirst({
    where: { id: pipelineId, userId: { in: ownerIds } },
    select: { id: true },
  });
  if (!pipeline) return [];

  return db.pipelineRevision.findMany({
    where: { pipelineId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      message: true,
      gitCommitSha: true,
      createdAt: true,
      declarativeSpecYaml: true,
    },
  });
}

export async function restorePipelineRevision(
  userId: string,
  pipelineId: string,
  revisionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ownerIds = await getAccessibleResourceOwnerIds(userId);
  const rev = await db.pipelineRevision.findFirst({
    where: { id: revisionId, pipeline: { id: pipelineId, userId: { in: ownerIds } } },
  });
  if (!rev) return { ok: false, error: "Revision not found" };

  try {
    const decl = parsePipelineDeclarationYaml(rev.declarativeSpecYaml);
    const result = await upsertPipelineDefinition(userId, decl.body, {
      declarativeSpecYaml: rev.declarativeSpecYaml,
    });
    if (!result.ok) return { ok: false, error: result.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
