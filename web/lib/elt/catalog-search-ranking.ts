import type { AssetFreshnessMeta } from "@/lib/elt/asset-freshness";
import { isPublicCatalogTags, PUBLIC_CATALOG_TAGS } from "@/lib/auth/catalog-access";
import { parseTags } from "@/lib/elt/catalog-entries";
import type { WorkspaceAsset, WarehouseAssetStatus } from "@/lib/elt/pipeline-assets";

export const CERTIFIED_CATALOG_TAGS = new Set(["catalog:certified", "catalog:trusted", "certified", "trusted"]);

export type CatalogSearchQuality = {
  certified: boolean;
  documented: boolean;
  hasColumns: boolean;
  warehouseVerified: boolean;
  runObserved: boolean;
  freshness?: AssetFreshnessMeta["freshness"];
  lastRunStatus?: string;
  columnCount?: number;
};

export type RankedCatalogHit = {
  score: number;
  quality: CatalogSearchQuality;
};

export function isCertifiedCatalogTags(tags: unknown): boolean {
  return parseTags(tags).some((t) => CERTIFIED_CATALOG_TAGS.has(t.toLowerCase()));
}

export function computeSearchQuality(input: {
  tags?: unknown;
  description?: string | null;
  columnCount?: number;
  certifiedAt?: Date | null;
  asset?: Pick<WorkspaceAsset, "warehouseStatus" | "runObserved" | "assetFreshness">;
  lastRunStatus?: string;
}): CatalogSearchQuality {
  const tags = parseTags(input.tags);
  return {
    certified: Boolean(input.certifiedAt) || isCertifiedCatalogTags(tags),
    documented: Boolean(input.description?.trim()),
    hasColumns: (input.columnCount ?? 0) > 0,
    warehouseVerified: input.asset?.warehouseStatus === "verified",
    runObserved: Boolean(input.asset?.runObserved),
    freshness: input.asset?.assetFreshness?.freshness,
    lastRunStatus: input.lastRunStatus,
    columnCount: input.columnCount,
  };
}

/** Higher score = rank first in search results. */
export function scoreCatalogHit(
  quality: CatalogSearchQuality,
  opts?: { recentlyViewed?: boolean; exactNameMatch?: boolean }
): number {
  let score = 0;
  if (quality.certified) score += 100;
  if (quality.documented) score += 40;
  if (quality.warehouseVerified) score += 30;
  if (quality.runObserved) score += 20;
  if (quality.hasColumns) score += 15;
  if (quality.freshness === "fresh") score += 25;
  else if (quality.freshness === "stale") score += 5;
  if (quality.lastRunStatus === "succeeded") score += 15;
  if (quality.lastRunStatus === "failed") score -= 20;
  if (opts?.recentlyViewed) score += 10;
  if (opts?.exactNameMatch) score += 50;
  return score;
}

export function qualityBadgeLabels(q: CatalogSearchQuality): string[] {
  const out: string[] = [];
  if (q.certified) out.push("Certified");
  if (q.warehouseVerified) out.push("Verified");
  if (q.freshness === "fresh") out.push("Fresh");
  if (q.lastRunStatus === "failed") out.push("Last run failed");
  if (q.hasColumns && q.columnCount) out.push(`${q.columnCount} cols`);
  return out;
}

export { PUBLIC_CATALOG_TAGS, isPublicCatalogTags };
