import { getDltHubSource } from "@/lib/elt/dlt-hub-registry";
import { resolveDbtHubPackage } from "@/lib/elt/dbt-hub-packages";
import type { AssetColumnDef, CatalogEntryMetadata } from "@/lib/elt/catalog-metadata";
import { mergeAssetColumns } from "@/lib/elt/catalog-metadata";
import { dbtColumnsForModel } from "@/lib/elt/dbt-artifact-manifest";
import type { PipelineAssetBundle, WorkspaceAsset } from "@/lib/elt/pipeline-assets";

export type AssetTechnicalProfile = {
  columns: AssetColumnDef[];
  columnSources: string[];
  inferredDescription?: string;
  configNotes?: string;
  dbtPackageDescription?: string;
};

function hubSourceDescription(sourceType: string): string | undefined {
  const slug = sourceType.toLowerCase().trim();
  const hub = getDltHubSource(slug);
  return hub?.description;
}

function dbtModelInferredDescription(asset: WorkspaceAsset, bundle: PipelineAssetBundle): string | undefined {
  if (asset.kind !== "transform") return undefined;
  const hub = resolveDbtHubPackage(bundle.sourceType);
  if (!hub) return undefined;
  if (hub.models.includes(asset.name)) {
    return `${hub.description} Model \`${asset.name}\` from package ${hub.package.replace(/^dlt-hub\//, "")}.`;
  }
  return hub.description;
}

/** Config-derived notes — no warehouse or AI. */
export function buildInferredTechnicalProfile(
  asset: WorkspaceAsset,
  bundle: PipelineAssetBundle
): AssetTechnicalProfile {
  const columnSources: string[] = [];
  const columns: AssetColumnDef[] = [];
  let inferredDescription: string | undefined;

  if (asset.kind === "source") {
    inferredDescription = hubSourceDescription(asset.sourceType) ?? asset.description;
    if (inferredDescription) columnSources.push("dlt");
  } else if (asset.kind === "raw") {
    inferredDescription =
      asset.syncMode === "database_replication"
        ? `Replicated table \`${asset.landingQualified ?? asset.name}\` from ${asset.sourceType} via Sling.`
        : `Loaded dlt resource \`${asset.name}\` into ${asset.landingQualified ?? asset.landingDataset ?? "landing"}.`;
    columnSources.push(asset.syncMode === "database_replication" ? "sling" : "dlt");
  } else if (asset.kind === "transform") {
    inferredDescription = dbtModelInferredDescription(asset, bundle) ?? asset.description;
    columnSources.push("dbt");
  } else if (asset.kind === "post_transform") {
    inferredDescription = asset.description ?? "Custom post-load transform step.";
  } else if (asset.kind === "object") {
    inferredDescription = asset.description ?? "Object store landing path for pipeline output.";
  }

  const hub = resolveDbtHubPackage(bundle.sourceType);
  const dbtPackageDescription = asset.kind === "transform" && hub ? hub.description : undefined;

  return {
    columns,
    columnSources,
    ...(inferredDescription ? { inferredDescription } : {}),
    ...(asset.description ? { configNotes: asset.description } : {}),
    ...(dbtPackageDescription ? { dbtPackageDescription } : {}),
  };
}

/** Merge stored catalog metadata, inferred profile, and optional warehouse columns. */
export function buildAssetTechnicalProfile(
  asset: WorkspaceAsset,
  bundle: PipelineAssetBundle,
  catalogMetadata?: CatalogEntryMetadata,
  warehouseColumns?: AssetColumnDef[]
): AssetTechnicalProfile {
  const inferred = buildInferredTechnicalProfile(asset, bundle);
  const stored = catalogMetadata?.columns ?? [];
  const dbtCols =
    asset.kind === "transform" && bundle.lastRun?.dbtManifest
      ? dbtColumnsForModel(bundle.lastRun.dbtManifest, asset.name).columns
      : [];
  const merged = mergeAssetColumns(stored, warehouseColumns, dbtCols, inferred.columns);

  const sources = new Set<string>([
    ...inferred.columnSources,
    ...(catalogMetadata?.columnSources ?? []),
    ...(warehouseColumns?.length ? ["warehouse"] : []),
    ...(dbtCols.length ? ["dbt"] : []),
    ...(stored.some((c) => c.source === "manual") ? ["manual"] : []),
  ]);

  return {
    columns: merged,
    columnSources: Array.from(sources),
    inferredDescription:
      catalogMetadata?.inferredDescription ??
      (asset.kind === "transform" && bundle.lastRun?.dbtManifest
        ? dbtColumnsForModel(bundle.lastRun.dbtManifest, asset.name).description ?? inferred.inferredDescription
        : inferred.inferredDescription),
    configNotes: inferred.configNotes,
    dbtPackageDescription: inferred.dbtPackageDescription,
  };
}

/** Metadata patch for catalog import — preserves manual columns/descriptions. */
export function catalogImportMetadataPatch(
  existing: CatalogEntryMetadata | undefined,
  asset: WorkspaceAsset,
  bundle: PipelineAssetBundle
): CatalogEntryMetadata {
  const inferred = buildInferredTechnicalProfile(asset, bundle);
  const hasManualColumns = (existing?.columns ?? []).some((c) => c.source === "manual");
  return {
    ...existing,
    inferredDescription: inferred.inferredDescription ?? existing?.inferredDescription,
    columnSources: inferred.columnSources,
    lastImportedAt: new Date().toISOString(),
    ...(hasManualColumns ? {} : inferred.columns.length ? { columns: inferred.columns } : {}),
  };
}
