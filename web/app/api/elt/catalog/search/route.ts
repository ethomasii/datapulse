import { NextResponse } from "next/server";
import {
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { filterCatalogEntriesByVisibility } from "@/lib/auth/catalog-access";
import { getAccessibleResourceOwnerIds, pipelineOwnerWhere } from "@/lib/auth/workspace-access";
import { hasCatalogReadScope } from "@/lib/auth/workspace-auth-helpers";
import { getWorkspacePermissions } from "@/lib/auth/org-permissions";
import { db } from "@/lib/db/client";
import { parseTags } from "@/lib/elt/catalog-entries";
import { parseCatalogMetadata } from "@/lib/elt/catalog-metadata";
import {
  computeSearchQuality,
  qualityBadgeLabels,
  scoreCatalogHit,
} from "@/lib/elt/catalog-search-ranking";
import { buildAssetLineageGraph } from "@/lib/elt/asset-lineage";
import { buildWorkspaceAssets, type PipelineRunAssetInput, type WorkspaceAsset } from "@/lib/elt/pipeline-assets";
import { mergeCatalogIntoAssetsPayload } from "@/lib/elt/catalog-entries";

export type CatalogSearchHit = {
  assetKey: string;
  kind: string;
  displayName: string;
  description?: string;
  tags: string[];
  pipelineId?: string;
  pipelineName?: string;
  source: "catalog_entry" | "asset";
  score: number;
  qualityBadges: string[];
  relatedAssetKeys?: string[];
};

function matchesQuery(hay: string, q: string): boolean {
  return hay.toLowerCase().includes(q);
}

function relatedFromLineage(asset: WorkspaceAsset, bundle: { source: WorkspaceAsset; rawAssets: WorkspaceAsset[]; transforms: WorkspaceAsset[]; postTransforms: WorkspaceAsset[] } | undefined): string[] {
  if (!bundle) return [];
  try {
    const graph = buildAssetLineageGraph({
      ...bundle,
      pipelineId: asset.pipelineId,
      pipelineName: asset.pipelineName,
      syncMode: asset.syncMode,
      sourceType: asset.sourceType,
      destinationType: asset.destinationType,
      enabled: asset.enabled,
      landingDataset: asset.landingDataset ?? "",
      freshness: "never_run",
      freshnessLabel: "Unknown",
      updatedAt: new Date().toISOString(),
    });
    const related = new Set<string>();
    for (const e of graph.edges) {
      if (e.from === asset.id) related.add(e.to);
      if (e.to === asset.id) related.add(e.from);
    }
    return Array.from(related).slice(0, 5);
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasCatalogReadScope(auth)) return scopeForbiddenResponse();

  const q = new URL(req.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (!q || q.length < 2) {
    return NextResponse.json({ error: "Provide q with at least 2 characters" }, { status: 400 });
  }

  const perms = await getWorkspacePermissions(auth.user.id);
  const ownerIds = await getAccessibleResourceOwnerIds(auth.user.id);
  const limit = Math.min(100, Math.max(1, Number(new URL(req.url).searchParams.get("limit") ?? 50) || 50));

  const [entries, pipelines, recentViews] = await Promise.all([
    db.catalogEntry.findMany({ where: { userId: { in: ownerIds } }, orderBy: { updatedAt: "desc" } }),
    db.eltPipeline.findMany({
      where: pipelineOwnerWhere(ownerIds),
      select: {
        id: true,
        name: true,
        tool: true,
        enabled: true,
        sourceType: true,
        destinationType: true,
        sourceConfiguration: true,
        updatedAt: true,
      },
    }),
    db.catalogAssetView.findMany({
      where: { userId: auth.user.id },
      orderBy: { viewedAt: "desc" },
      take: 50,
    }),
  ]);

  const pipelineIds = pipelines.map((p) => p.id);
  const latestRunsByPipelineId = new Map<string, PipelineRunAssetInput>();
  if (pipelineIds.length > 0) {
    const runs = await db.eltPipelineRun.findMany({
      where: { pipelineId: { in: pipelineIds } },
      orderBy: { startedAt: "desc" },
      take: Math.min(pipelineIds.length * 3, 300),
      select: { id: true, pipelineId: true, status: true, startedAt: true, finishedAt: true, telemetry: true },
    });
    for (const run of runs) {
      if (run.pipelineId && !latestRunsByPipelineId.has(run.pipelineId)) {
        latestRunsByPipelineId.set(run.pipelineId, { ...run, pipelineId: run.pipelineId });
      }
    }
  }

  const entriesByKey = new Map(entries.map((r) => [r.assetKey, r]));
  const payload = mergeCatalogIntoAssetsPayload(
    buildWorkspaceAssets(pipelines, latestRunsByPipelineId),
    entriesByKey
  );
  const assetByKey = new Map(payload.assets.map((a) => [a.id, a]));
  const bundleByPipelineId = new Map(payload.pipelines.map((b) => [b.pipelineId, b]));
  const lastRunStatusByPipeline = new Map(
    payload.pipelines.map((b) => [b.pipelineId, b.lastRun?.status])
  );
  const recentViewKeys = new Set(recentViews.map((v) => v.assetKey));

  const pipelineNameById = new Map(pipelines.map((p) => [p.id, p.name]));
  const visibleEntries = filterCatalogEntriesByVisibility(entries, perms.catalogVisibility);
  const candidates: CatalogSearchHit[] = [];
  const seen = new Set<string>();

  for (const row of visibleEntries) {
    const tags = parseTags(row.tags);
    const meta = parseCatalogMetadata(row.metadata);
    const columnHay = (meta.columns ?? []).map((c) => `${c.name} ${c.type ?? ""} ${c.description ?? ""}`).join(" ");
    const hay = [row.assetKey, row.displayName ?? "", row.description ?? "", row.kind, meta.inferredDescription ?? "", columnHay, ...tags].join(" ");
    if (!matchesQuery(hay, q)) continue;
    seen.add(row.assetKey);

    const asset = assetByKey.get(row.assetKey);
    const quality = computeSearchQuality({
      tags: row.tags,
      description: row.description,
      columnCount: meta.columns?.length,
      certifiedAt: row.certifiedAt,
      asset,
      lastRunStatus: asset ? lastRunStatusByPipeline.get(asset.pipelineId) : undefined,
    });
    const exactName = (row.displayName ?? row.assetKey).toLowerCase() === q;
    const score = scoreCatalogHit(quality, { recentlyViewed: recentViewKeys.has(row.assetKey), exactNameMatch: exactName });

    candidates.push({
      assetKey: row.assetKey,
      kind: row.kind,
      displayName: row.displayName ?? row.assetKey,
      description: row.description ?? undefined,
      tags,
      pipelineId: row.pipelineId ?? undefined,
      pipelineName: row.pipelineId ? pipelineNameById.get(row.pipelineId) : undefined,
      source: "catalog_entry",
      score,
      qualityBadges: qualityBadgeLabels(quality),
      relatedAssetKeys: asset ? relatedFromLineage(asset, bundleByPipelineId.get(asset.pipelineId)) : undefined,
    });
  }

  if (perms.catalogVisibility === "full") {
    for (const asset of payload.assets) {
      if (seen.has(asset.id)) continue;
      const hay = [
        asset.id,
        asset.displayName,
        asset.name,
        asset.kind,
        asset.landingQualified ?? "",
        asset.pipelineName ?? "",
        asset.description ?? "",
        asset.catalogDescription ?? "",
      ].join(" ");
      if (!matchesQuery(hay, q)) continue;
      seen.add(asset.id);

      const entry = entriesByKey.get(asset.id);
      const meta = parseCatalogMetadata(entry?.metadata);
      const quality = computeSearchQuality({
        tags: asset.catalogTags,
        description: asset.catalogDescription,
        columnCount: meta.columns?.length ?? asset.catalogColumnCount,
        certifiedAt: entry?.certifiedAt,
        asset,
        lastRunStatus: lastRunStatusByPipeline.get(asset.pipelineId),
      });
      const exactName = asset.displayName.toLowerCase() === q;
      const score = scoreCatalogHit(quality, { recentlyViewed: recentViewKeys.has(asset.id), exactNameMatch: exactName });

      candidates.push({
        assetKey: asset.id,
        kind: asset.kind,
        displayName: asset.catalogDisplayName ?? asset.displayName,
        description: asset.catalogDescription,
        pipelineId: asset.pipelineId,
        pipelineName: asset.pipelineName,
        tags: asset.catalogTags ?? [],
        source: "asset",
        score,
        qualityBadges: qualityBadgeLabels(quality),
        relatedAssetKeys: relatedFromLineage(asset, bundleByPipelineId.get(asset.pipelineId)),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const hits = candidates.slice(0, limit);

  return NextResponse.json({ q, hits, total: hits.length, permissions: { catalogVisibility: perms.catalogVisibility } });
}
