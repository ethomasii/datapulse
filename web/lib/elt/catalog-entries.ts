import type { PipelineAssetBundle, WorkspaceAsset, WorkspaceAssetsResponse } from "@/lib/elt/pipeline-assets";

export type CatalogEntryRow = {
  id: string;
  assetKey: string;
  kind: string;
  displayName: string | null;
  description: string | null;
  tags: unknown;
  metadata: unknown;
  pipelineId: string | null;
  importedAt: Date | null;
  updatedAt: Date;
};

export type CatalogEntryPatch = {
  assetKey: string;
  kind?: string;
  displayName?: string | null;
  description?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
  pipelineId?: string | null;
};

export function parseTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => String(t).trim()).filter(Boolean).slice(0, 32);
}

export function catalogMetaForAsset(
  asset: WorkspaceAsset,
  entry: CatalogEntryRow | undefined
): WorkspaceAsset {
  if (!entry) return asset;
  const tags = parseTags(entry.tags);
  return {
    ...asset,
    catalogDescription: entry.description ?? undefined,
    catalogTags: tags.length ? tags : undefined,
    catalogDisplayName: entry.displayName ?? undefined,
  };
}

export function mergeCatalogIntoAssetsPayload(
  payload: WorkspaceAssetsResponse,
  entriesByKey: Map<string, CatalogEntryRow>
): WorkspaceAssetsResponse {
  const pipelines = payload.pipelines.map((bundle) => {
    const mapAssets = (assets: WorkspaceAsset[]) =>
      assets.map((a) => catalogMetaForAsset(a, entriesByKey.get(a.id)));
    return {
      ...bundle,
      source: catalogMetaForAsset(bundle.source, entriesByKey.get(bundle.source.id)),
      rawAssets: mapAssets(bundle.rawAssets),
      transforms: mapAssets(bundle.transforms),
      postTransforms: mapAssets(bundle.postTransforms),
    };
  });
  const assets = pipelines.flatMap((b) => [b.source, ...b.rawAssets, ...b.transforms, ...b.postTransforms]);
  return { ...payload, pipelines, assets };
}

/** Build catalog entry upserts from current workspace asset bundles. */
export function catalogEntriesFromAssets(
  userId: string,
  payload: WorkspaceAssetsResponse
): CatalogEntryPatch[] {
  const out: CatalogEntryPatch[] = [];
  for (const bundle of payload.pipelines) {
    out.push({
      assetKey: `dbt_project:${bundle.pipelineId}`,
      kind: "dbt_project",
      displayName: `${bundle.pipelineName} dbt`,
      pipelineId: bundle.pipelineId,
    });
    for (const asset of [bundle.source, ...bundle.rawAssets, ...bundle.transforms, ...bundle.postTransforms]) {
      out.push({
        assetKey: asset.id,
        kind: asset.kind,
        displayName: asset.displayName,
        pipelineId: asset.pipelineId,
      });
    }
  }
  return out.filter((e) => e.assetKey && e.kind);
}

export function dbtProjectsFromBundles(pipelines: PipelineAssetBundle[]) {
  return pipelines
    .filter((b) => b.transforms.length > 0 || b.lastRun?.dbtManifest)
    .map((b) => ({
      pipelineId: b.pipelineId,
      pipelineName: b.pipelineName,
      sourceType: b.sourceType,
      destinationType: b.destinationType,
      enabled: b.enabled,
      modelCount: b.transforms.length,
      packagePath: b.transforms[0]?.dbtPackage,
      transformScope: b.transforms[0]?.transformScope,
      freshness: b.freshness,
      freshnessLabel: b.freshnessLabel,
      lastRun: b.lastRun,
      dbtDiff: b.dbtDiff,
    }));
}
