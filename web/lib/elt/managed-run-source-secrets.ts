import { getGithubAccessTokenForUser } from "@/lib/integrations/github-access-token";

export type ManagedRunSourceConnection = {
  id: string | null;
  name: string;
  connectionType: string;
  connector: string;
  config: Record<string, unknown>;
  secrets: Record<string, string>;
};

/**
 * Resolve source secrets for a managed run, including Integrations OAuth when the
 * pipeline is GitHub-backed but the saved connection has no PAT.
 */
export async function resolveManagedRunSourceConnection(
  userId: string,
  pipelineSourceType: string | null | undefined,
  source: ManagedRunSourceConnection | null
): Promise<ManagedRunSourceConnection | null> {
  const srcType = (pipelineSourceType ?? source?.connector ?? "").toLowerCase();
  const connector = source?.connector?.toLowerCase() ?? "";
  const isGithub = srcType === "github" || connector === "github";

  if (!isGithub) return source;

  const secrets = { ...(source?.secrets ?? {}) };
  if (!secrets.GITHUB_TOKEN?.trim()) {
    const oauth = await getGithubAccessTokenForUser(userId);
    if (oauth) secrets.GITHUB_TOKEN = oauth;
  }

  if (!source) {
    if (!Object.keys(secrets).length) return null;
    return {
      id: null,
      name: "GitHub (Integrations)",
      connectionType: "source",
      connector: "github",
      config: {},
      secrets,
    };
  }

  return { ...source, secrets };
}
