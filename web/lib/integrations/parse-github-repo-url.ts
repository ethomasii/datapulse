/**
 * Parse common GitHub repository URL shapes into owner, repo name, and optional branch (from /tree/...).
 * Returns null if the string does not look like a GitHub repo reference.
 */
export function parseGithubRepositoryUrl(raw: string): { owner: string; repo: string; branch?: string } | null {
  const input = raw.trim();
  if (!input) return null;

  const ssh = /^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/i.exec(input);
  if (ssh) {
    return { owner: ssh[1], repo: ssh[2] };
  }

  let urlStr = input;
  if (!/^https?:\/\//i.test(urlStr)) {
    urlStr = `https://${urlStr}`;
  }

  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    return null;
  }

  if (!u.hostname.toLowerCase().endsWith("github.com")) return null;

  const parts = u.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  const owner = parts[0];
  let repo = parts[1];
  if (repo.endsWith(".git")) repo = repo.slice(0, -4);
  if (!owner || !repo) return null;

  let branch: string | undefined;
  const treeIdx = parts.indexOf("tree");
  if (treeIdx >= 0 && parts.length > treeIdx + 1) {
    // First path segment after `tree` is the ref (branch or tag); deeper paths are folder navigation.
    branch = decodeURIComponent(parts[treeIdx + 1]) || undefined;
  }

  return { owner, repo, branch };
}
