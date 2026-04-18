/**
 * Triggers `.github/workflows/eltpulse-managed-worker.yml` via the GitHub REST API.
 * The workflow runs `python main.py` on GitHub-hosted runners (real dlt/Sling) — no Vercel Services.
 *
 * Env (Vercel or any cron caller):
 * - ELTPULSE_GITHUB_DISPATCH_TOKEN — PAT or GitHub App token with **Actions: write** on the repo
 * - ELTPULSE_GITHUB_REPOSITORY — `owner/repo`
 * - ELTPULSE_GITHUB_WORKFLOW_FILE — optional, default `eltpulse-managed-worker.yml`
 * - ELTPULSE_GITHUB_DISPATCH_REF — optional, default `main`
 */
export async function runManagedWorkerGithubDispatchHttp(): Promise<{
  processed: number;
  errors: string[];
  githubDispatched: true;
}> {
  const token = process.env.ELTPULSE_GITHUB_DISPATCH_TOKEN?.trim();
  const repo = process.env.ELTPULSE_GITHUB_REPOSITORY?.trim();
  const workflowFile =
    process.env.ELTPULSE_GITHUB_WORKFLOW_FILE?.trim() || "eltpulse-managed-worker.yml";
  const ref = process.env.ELTPULSE_GITHUB_DISPATCH_REF?.trim() || "main";

  if (!token || !repo) {
    throw new Error(
      "Set ELTPULSE_GITHUB_DISPATCH_TOKEN and ELTPULSE_GITHUB_REPOSITORY (owner/repo) for ELTPULSE_MANAGED_EXECUTOR=gha."
    );
  }

  const parts = repo.split("/").filter(Boolean);
  if (parts.length !== 2) {
    throw new Error(`ELTPULSE_GITHUB_REPOSITORY must be owner/repo (got "${repo}")`);
  }
  const [owner, name] = parts;

  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
    name
  )}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref }),
  });

  if (res.status !== 204 && !res.ok) {
    const t = await res.text();
    throw new Error(`GitHub workflow dispatch failed ${res.status}: ${t.slice(0, 800)}`);
  }

  return { processed: 0, errors: [], githubDispatched: true };
}
