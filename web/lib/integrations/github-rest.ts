const GH_API = "https://api.github.com";
const GH_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
} as const;

/** `GET /repos/{owner}/{repo}/contents/{path}` — path segments URL-encoded. */
export function githubRepoContentsApiPath(owner: string, repo: string, relativePath: string, ref?: string): string {
  const enc = relativePath
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${enc}`;
  return ref ? `${base}?ref=${encodeURIComponent(ref)}` : base;
}

export async function githubJson<T>(token: string, path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: T | null }> {
  const res = await fetch(`${GH_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...GH_HEADERS,
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!text) return { ok: res.ok, status: res.status, json: null };
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) as T };
  } catch {
    return { ok: res.ok, status: res.status, json: null };
  }
}

export type GithubRepoListItem = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch?: string;
  updated_at?: string;
};

export type GithubContentFile = {
  type: "file";
  name: string;
  path: string;
  sha: string;
  size: number;
  encoding: "base64";
  content: string;
};

export type GithubContentDirItem = {
  type: "file" | "dir" | "submodule" | "symlink";
  name: string;
  path: string;
  sha: string;
  size?: number;
};

export function decodeGithubFileContent(file: GithubContentFile): string {
  const b64 = file.content.replace(/\s/g, "");
  return Buffer.from(b64, "base64").toString("utf8");
}
