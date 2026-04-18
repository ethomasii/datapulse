import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { getGithubAccessTokenForUser } from "@/lib/integrations/github-access-token";
import { githubJson, type GithubRepoListItem } from "@/lib/integrations/github-rest";

/**
 * List repositories visible to the connected GitHub user (up to 100, recently updated first).
 * Optional `?q=` filters by substring on full name (case-insensitive).
 */
export async function GET(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getGithubAccessTokenForUser(user.id);
  if (!token) {
    return NextResponse.json({ error: "GitHub is not connected. Use Integrations to connect." }, { status: 400 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  const { ok, status, json } = await githubJson<GithubRepoListItem[]>(
    token,
    "/user/repos?per_page=100&sort=updated"
  );
  if (!ok || !Array.isArray(json)) {
    return NextResponse.json(
      { error: "Could not list GitHub repositories." },
      { status: status >= 400 && status < 600 ? status : 502 }
    );
  }

  let repos = json.map((r) => ({
    name: r.name,
    fullName: r.full_name,
    url: r.html_url ?? `https://github.com/${r.full_name}`,
    description: r.description ?? null,
    private: r.private,
    defaultBranch: r.default_branch ?? "main",
  }));
  if (q) {
    repos = repos.filter((r) => r.fullName.toLowerCase().includes(q));
  }

  return NextResponse.json({ repos });
}
