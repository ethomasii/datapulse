import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { getGithubAccessTokenForUser } from "@/lib/integrations/github-access-token";
import {
  githubJson,
  githubRepoContentsApiPath,
  type GithubContentDirItem,
} from "@/lib/integrations/github-rest";

/**
 * List files and folders at a path in a connected user's GitHub repo.
 * Query: owner, repo, branch (optional), path (optional, default "").
 */
export async function GET(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getGithubAccessTokenForUser(user.id);
  if (!token) {
    return NextResponse.json({ error: "GitHub is not connected." }, { status: 400 });
  }

  const url = new URL(req.url);
  const owner = (url.searchParams.get("owner") ?? "").trim();
  const repo = (url.searchParams.get("repo") ?? "").trim();
  const branch = (url.searchParams.get("branch") ?? "main").trim() || "main";
  const path = (url.searchParams.get("path") ?? "").trim();

  if (!owner || !repo) {
    return NextResponse.json({ error: "owner and repo are required" }, { status: 400 });
  }

  const listPath = path
    ? githubRepoContentsApiPath(owner, repo, path, branch)
    : `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents?ref=${encodeURIComponent(branch)}`;

  const { ok, status, json } = await githubJson<GithubContentDirItem[] | GithubContentDirItem | { message?: string }>(
    token,
    listPath
  );

  if (status === 404) {
    return NextResponse.json({ path, branch, entries: [], exists: false });
  }

  if (!ok) {
    const msg =
      json && typeof json === "object" && "message" in json
        ? String((json as { message?: string }).message)
        : "Could not read repository path.";
    return NextResponse.json({ error: msg }, { status: status >= 400 && status < 600 ? status : 502 });
  }

  const items = Array.isArray(json) ? json : json && typeof json === "object" && "type" in json ? [json] : [];

  const entries = items.map((e) => ({
    name: e.name,
    path: e.path,
    type: e.type === "dir" ? ("dir" as const) : ("file" as const),
  }));

  return NextResponse.json({
    path,
    branch,
    exists: true,
    entries,
  });
}
