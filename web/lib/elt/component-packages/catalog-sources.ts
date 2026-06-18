import nativeManifest from "@/lib/elt/data/native-components-manifest.json";
import type { ComponentCatalogSource } from "./types";

type ManifestShape = { repository?: string };

const DEFAULT_BRANCH = process.env.ELTPULSE_COMPONENT_CATALOG_BRANCH ?? "main";

/** Parse `owner/repo`, GitHub URL, or raw base URL into a catalog source. */
export function parseCatalogSource(input: string, branch = DEFAULT_BRANCH): ComponentCatalogSource | null {
  const raw = input.trim();
  if (!raw) return null;

  if (raw.startsWith("https://raw.githubusercontent.com/")) {
    const u = raw.replace(/\/$/, "");
    const parts = u.replace("https://raw.githubusercontent.com/", "").split("/");
    if (parts.length < 2) return null;
    const [owner, repo, b = branch] = parts;
    return {
      id: `${owner}/${repo}`,
      branch: b,
      rawBase: `https://raw.githubusercontent.com/${owner}/${repo}/${b}/`,
    };
  }

  const ghMatch = raw.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+))?\/?$/
  );
  if (ghMatch) {
    const [, owner, repo, b] = ghMatch;
    const ref = b ?? branch;
    return {
      id: `${owner}/${repo}`,
      branch: ref,
      rawBase: `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/`,
    };
  }

  const slug = raw.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (slug) {
    const [, owner, repo] = slug;
    return {
      id: `${owner}/${repo}`,
      branch,
      rawBase: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/`,
    };
  }

  return null;
}

export function defaultCatalogSources(): ComponentCatalogSource[] {
  const out: ComponentCatalogSource[] = [];
  const seen = new Set<string>();

  const add = (src: ComponentCatalogSource | null) => {
    if (!src || seen.has(src.id)) return;
    seen.add(src.id);
    out.push(src);
  };

  const repo = (nativeManifest as ManifestShape).repository;
  if (repo) add(parseCatalogSource(repo));

  const env = process.env.ELTPULSE_COMPONENT_CATALOG_URLS ?? "";
  for (const part of env.split(",").map((s) => s.trim()).filter(Boolean)) {
    add(parseCatalogSource(part));
  }

  return out;
}

/** Merge defaults with pipeline / workspace overrides (first wins for duplicate ids). */
export function resolveCatalogSources(
  sourceConfiguration?: Record<string, unknown> | null,
  workspaceCatalogUrls?: string[] | null
): ComponentCatalogSource[] {
  const out: ComponentCatalogSource[] = [];
  const seen = new Set<string>();

  const add = (src: ComponentCatalogSource | null) => {
    if (!src || seen.has(src.id)) return;
    seen.add(src.id);
    out.push(src);
  };

  const sc = sourceConfiguration ?? {};
  const fromPipeline = sc.component_catalog_urls ?? sc.elt_component_catalog_urls;
  if (Array.isArray(fromPipeline)) {
    for (const u of fromPipeline) {
      if (typeof u === "string") add(parseCatalogSource(u));
    }
  }

  if (workspaceCatalogUrls?.length) {
    for (const u of workspaceCatalogUrls) add(parseCatalogSource(u));
  }

  for (const src of defaultCatalogSources()) add(src);

  return out;
}
