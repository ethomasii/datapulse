import type { PipelineDefinitionSource } from "@prisma/client";
import { db } from "@/lib/db/client";
import { getWorkspacePermissions, workspaceResourceUserId } from "@/lib/auth/org-permissions";
import {
  getGithubConnectionForUser,
  type GithubConnectionSummary,
} from "@/lib/db/github-connection-query";
import { getGithubAccessTokenForUser } from "@/lib/integrations/github-access-token";
import { normalizePipelineRunEnvironment } from "@/lib/elt/pipeline-run-environment";

export type WorkspaceGithubRepoContext = {
  owner: string;
  name: string;
  productionBranch: string;
  developmentBranch: string;
};

export type WorkspaceGithubSettings = {
  /** User id whose GithubConnection row holds repo + tokens (org owner for teams). */
  connectionUserId: string;
  /** User performing the action (for personal dev branch). */
  actingUserId: string;
  connection: GithubConnectionSummary;
  repo: WorkspaceGithubRepoContext;
  token: string | null;
  personalDevBranch: string | null;
  productionDefinitionSource: PipelineDefinitionSource;
  developmentDefinitionSource: PipelineDefinitionSource;
};

export async function resolveWorkspaceGithubOwnerId(actingUserId: string): Promise<string> {
  const perms = await getWorkspacePermissions(actingUserId);
  return workspaceResourceUserId(perms, actingUserId);
}

function repoFromConnection(row: GithubConnectionSummary): WorkspaceGithubRepoContext | null {
  const owner = row.defaultRepoOwner?.trim();
  const name = row.defaultRepoName?.trim();
  if (!owner || !name) return null;
  return {
    owner,
    name,
    productionBranch: row.defaultBranch?.trim() || "main",
    developmentBranch: row.developmentBranch?.trim() || "develop",
  };
}

/** Workspace GitHub context: org owner's connection + acting user's personal branch. */
export async function getWorkspaceGithubSettings(
  actingUserId: string
): Promise<WorkspaceGithubSettings | null> {
  const connectionUserId = await resolveWorkspaceGithubOwnerId(actingUserId);
  const { row } = await getGithubConnectionForUser(connectionUserId);
  if (!row) return null;

  const repo = repoFromConnection(row);
  if (!repo) return null;

  const [token, actingUser] = await Promise.all([
    getGithubAccessTokenForUser(connectionUserId),
    db.user.findUnique({
      where: { id: actingUserId },
      select: { personalDevBranch: true },
    }),
  ]);

  return {
    connectionUserId,
    actingUserId,
    connection: row,
    repo,
    token,
    personalDevBranch: actingUser?.personalDevBranch?.trim() || null,
    productionDefinitionSource: row.productionDefinitionSource ?? "neon",
    developmentDefinitionSource: row.developmentDefinitionSource ?? "neon",
  };
}

/** Git branch used for a user's dev saves and dev-definition reads. */
export function resolveUserDevelopmentBranch(settings: WorkspaceGithubSettings): string {
  return settings.personalDevBranch ?? settings.repo.developmentBranch;
}

export function resolveGitBranchForRunEnvironment(
  settings: WorkspaceGithubSettings,
  environment: string
): string {
  const env = normalizePipelineRunEnvironment(environment);
  return env === "production" ? settings.repo.productionBranch : resolveUserDevelopmentBranch(settings);
}

export function resolveDefinitionSourceForEnvironment(
  settings: WorkspaceGithubSettings,
  environment: string
): PipelineDefinitionSource {
  const env = normalizePipelineRunEnvironment(environment);
  return env === "production"
    ? settings.productionDefinitionSource
    : settings.developmentDefinitionSource;
}

export function githubPromoteCompareUrl(settings: WorkspaceGithubSettings): string | null {
  const { repo } = settings;
  const dev = resolveUserDevelopmentBranch(settings);
  if (dev === repo.productionBranch) return null;
  return `https://github.com/${repo.owner}/${repo.name}/compare/${encodeURIComponent(repo.productionBranch)}...${encodeURIComponent(dev)}?expand=1`;
}
