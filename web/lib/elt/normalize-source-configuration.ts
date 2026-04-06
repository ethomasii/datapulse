/**
 * Align sourceConfiguration with Python `pipeline_generator` / dlt codegen expectations.
 * Upstream forms use `repos` (owner/repo list); our generator uses repo_owner + repo_name.
 */

export function normalizeSourceConfigurationForCodegen(
  sourceType: string,
  cfg: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...cfg };
  if (sourceType.toLowerCase() !== "github") {
    return out;
  }
  const hasOwner = typeof out.repo_owner === "string" && out.repo_owner.trim().length > 0;
  const hasName = typeof out.repo_name === "string" && out.repo_name.trim().length > 0;
  if (hasOwner && hasName) {
    return out;
  }
  const first =
    String(out.repos ?? "")
      .split(",")[0]
      ?.trim() ?? "";
  const parts = first.split("/").map((x) => x.trim()).filter(Boolean);
  if (parts.length >= 2) {
    out.repo_owner = parts[0];
    out.repo_name = parts[1];
  }
  return out;
}

/** Ensure GitHub `repos` is populated when only repo_owner/repo_name exist (for schema-driven form). */
export function ensureGithubReposForForm(cfg: Record<string, unknown>): Record<string, unknown> {
  const next = { ...cfg };
  if (typeof next.repos === "string" && next.repos.trim()) {
    return next;
  }
  const o = typeof next.repo_owner === "string" ? next.repo_owner.trim() : "";
  const n = typeof next.repo_name === "string" ? next.repo_name.trim() : "";
  if (o && n) {
    next.repos = `${o}/${n}`;
  }
  return next;
}
