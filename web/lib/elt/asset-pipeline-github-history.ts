import { getGithubConnectionForUser } from "@/lib/db/github-connection-query";
import { ELTPULSE_REPO } from "@/lib/elt/eltpulse-repo-layout";
import { getGithubAccessTokenForUser } from "@/lib/integrations/github-access-token";
import { githubJson } from "@/lib/integrations/github-rest";

export type PipelineGitCommit = {
  sha: string;
  message: string;
  author: string;
  at: string;
  htmlUrl: string;
};

/** Fetch recent commits touching the pipeline declaration YAML in the connected repo. */
export async function fetchPipelineGithubHistory(
  userId: string,
  pipelineName: string,
  limit = 15
): Promise<PipelineGitCommit[]> {
  const token = await getGithubAccessTokenForUser(userId);
  if (!token) return [];

  const { row: gh } = await getGithubConnectionForUser(userId);
  const owner = gh?.defaultRepoOwner?.trim();
  const repo = gh?.defaultRepoName?.trim();
  const branch = gh?.defaultBranch?.trim() || "main";
  if (!owner || !repo) return [];

  const path = `${ELTPULSE_REPO.pipelinesDir}/${pipelineName}.yaml`;
  const q = new URLSearchParams({
    path,
    sha: branch,
    per_page: String(Math.min(limit, 30)),
  });

  const res = await githubJson<
    Array<{
      sha: string;
      html_url?: string;
      commit?: {
        message?: string;
        author?: { name?: string; date?: string };
      };
    }>
  >(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?${q.toString()}`);

  if (!res.ok || !Array.isArray(res.json)) return [];

  return res.json
    .filter((c) => c.sha && c.commit)
    .map((c) => ({
      sha: c.sha.slice(0, 7),
      message: c.commit?.message?.trim() ?? "Commit",
      author: c.commit?.author?.name?.trim() ?? "Unknown",
      at: c.commit?.author?.date ?? new Date().toISOString(),
      htmlUrl: c.html_url ?? `https://github.com/${owner}/${repo}/commits/${c.sha}`,
    }));
}
