/**
 * Build transform assets from a dbt run manifest (runner-reported), replacing hub guesses.
 */
import type { DbtRunManifest } from "@/lib/elt/dbt-run-manifest";
import type { PipelineAssetBundle, WorkspaceAsset } from "@/lib/elt/pipeline-assets";

function sanitizeIdPart(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/** When the runner PATCHes a manifest, use its model list as the source of truth for /assets. */
export function transformAssetsFromDbtManifest(
  bundle: PipelineAssetBundle,
  manifest: DbtRunManifest
): WorkspaceAsset[] {
  if (!manifest.models.length) return bundle.transforms;

  const dbtDataset =
    manifest.datasetName?.replace(/[^a-zA-Z0-9_]/g, "_") ??
    bundle.transforms[0]?.landingDataset ??
    `${bundle.pipelineName}_dbt`.replace(/[^a-zA-Z0-9_]/g, "_");

  const scope = bundle.transforms[0]?.transformScope ?? "post_replication";
  const packagePath = manifest.packagePath ?? bundle.transforms[0]?.dbtPackage;

  return manifest.models.map((model) => {
    const existing = bundle.transforms.find((t) => t.name.toLowerCase() === model.name.toLowerCase());
    return {
      id: `${bundle.pipelineId}:transform:${sanitizeIdPart(model.name)}`,
      kind: "transform" as const,
      name: model.name,
      displayName: model.name,
      pipelineId: bundle.pipelineId,
      pipelineName: bundle.pipelineName,
      syncMode: bundle.syncMode,
      sourceType: bundle.sourceType,
      destinationType: bundle.destinationType,
      landingDataset: dbtDataset,
      landingQualified: `${dbtDataset}.${model.name}`,
      parentId: existing?.parentId ?? `${bundle.pipelineId}:source`,
      dbtPackage: packagePath,
      transformScope: scope,
      description: model.description ?? existing?.description,
      enabled: bundle.enabled,
      runObserved: model.status === "success",
      warehouseStatus:
        model.status === "success" ? ("verified" as const) : existing?.warehouseStatus,
    };
  });
}

/** Mark transform assets observed on the last successful dbt manifest. */
export function enrichBundleFromDbtManifest(bundle: PipelineAssetBundle): PipelineAssetBundle {
  const manifest: DbtRunManifest | undefined = bundle.lastRun?.dbtManifest;
  if (!manifest?.models?.length) return bundle;

  // Runner-reported manifest replaces config/hub guesses with actual models from dbt.
  if (manifest.source === "runner") {
    return {
      ...bundle,
      transforms: transformAssetsFromDbtManifest(bundle, manifest),
    };
  }

  const observed = new Set(
    manifest.models.filter((m) => m.status === "success").map((m) => m.name.toLowerCase())
  );

  const transforms = bundle.transforms.map((t) => {
    if (!observed.has(t.name.toLowerCase())) return t;
    return {
      ...t,
      runObserved: true,
      warehouseStatus: t.warehouseStatus ?? ("verified" as const),
    };
  });

  return { ...bundle, transforms };
}
