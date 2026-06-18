import type { WorkspacePermissions } from "@/lib/auth/org-permissions";
import { parseTags } from "@/lib/elt/catalog-entries";

/** Tags that mark catalog entries visible in limited (public) browse mode. */
export const PUBLIC_CATALOG_TAGS = new Set(["catalog:public", "public"]);

export type CatalogVisibility = WorkspacePermissions["catalogVisibility"];

export function isPublicCatalogTags(tags: unknown): boolean {
  return parseTags(tags).some((t) => PUBLIC_CATALOG_TAGS.has(t.toLowerCase()));
}

export function filterCatalogEntriesByVisibility<
  T extends { tags?: unknown; metadata?: unknown },
>(entries: T[], visibility: CatalogVisibility): T[] {
  if (visibility === "full") return entries;
  return entries.filter((e) => {
    if (isPublicCatalogTags(e.tags)) return true;
    const meta = e.metadata;
    if (meta && typeof meta === "object" && !Array.isArray(meta)) {
      const vis = String((meta as Record<string, unknown>).visibility ?? "").toLowerCase();
      if (vis === "public") return true;
    }
    return false;
  });
}

export function assetKeyIsPublicInCatalog(
  assetKey: string,
  entriesByKey: Map<string, { tags?: unknown; metadata?: unknown }>
): boolean {
  const row = entriesByKey.get(assetKey);
  if (!row) return false;
  return filterCatalogEntriesByVisibility([row], "public_only").length > 0;
}
