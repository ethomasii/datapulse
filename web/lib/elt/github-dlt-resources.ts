/** Maps UI resource ids to verified GitHub dlt sources shipped with the managed worker. */

export const GITHUB_REACTIONS_RESOURCES = new Set(["issues", "pull_requests"]);
export const GITHUB_REPO_EVENTS_RESOURCE = "repo_events";
export const GITHUB_STARGAZERS_RESOURCE = "stargazers";

export const GITHUB_IMPLEMENTED_RESOURCES = new Set([
  "issues",
  "pull_requests",
  GITHUB_REPO_EVENTS_RESOURCE,
  GITHUB_STARGAZERS_RESOURCE,
]);

/** Shown in the builder but not implemented in verified_sources/github yet. */
export const GITHUB_UNSUPPORTED_RESOURCES = new Set(["commits", "workflows", "releases"]);

export function normalizeGithubResources(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw.map(String)
    : typeof raw === "string"
      ? raw.split(",").map((x) => x.trim()).filter(Boolean)
      : ["issues", "pull_requests"];
  const unique = Array.from(new Set(list.map((r) => r.trim()).filter(Boolean)));
  const implemented = unique.filter((r) => GITHUB_IMPLEMENTED_RESOURCES.has(r));
  return implemented.length > 0 ? implemented : ["issues", "pull_requests"];
}

export function partitionGithubResources(resources: string[]): {
  reactions: string[];
  repoEvents: boolean;
  stargazers: boolean;
} {
  const reactions: string[] = [];
  let repoEvents = false;
  let stargazers = false;
  for (const r of resources) {
    if (GITHUB_REACTIONS_RESOURCES.has(r)) reactions.push(r);
    else if (r === GITHUB_REPO_EVENTS_RESOURCE) repoEvents = true;
    else if (r === GITHUB_STARGAZERS_RESOURCE) stargazers = true;
  }
  if (reactions.length === 0 && !repoEvents && !stargazers) {
    reactions.push("issues", "pull_requests");
  }
  return { reactions, repoEvents, stargazers };
}
