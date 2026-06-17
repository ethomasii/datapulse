import type { AssetFreshnessMeta } from "@/lib/elt/asset-freshness";
import { computePipelineFreshness } from "@/lib/elt/asset-freshness";
import type { PipelineAssetBundle, PipelineLastRunSummary, WorkspaceAsset } from "@/lib/elt/pipeline-assets";
import { parseRunTelemetry } from "@/lib/elt/run-telemetry";

function normalizeResourceKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "_");
}

/** Collect resource/table names touched during a run from telemetry samples. */
export function resourcesTouchedFromTelemetry(telemetry: unknown): Set<string> {
  const parsed = parseRunTelemetry(telemetry);
  const keys = new Set<string>();
  if (parsed.summary.currentResource) {
    keys.add(normalizeResourceKey(parsed.summary.currentResource));
  }
  for (const sample of parsed.samples) {
    if (sample.resource) keys.add(normalizeResourceKey(sample.resource));
  }
  return keys;
}

function assetMatchesResource(asset: WorkspaceAsset, resources: Set<string>): boolean {
  if (resources.size === 0) return false;
  const candidates = [
    normalizeResourceKey(asset.name),
    normalizeResourceKey(asset.displayName),
    asset.landingQualified ? normalizeResourceKey(asset.landingQualified.split(".").pop() ?? "") : "",
  ].filter(Boolean);
  for (const c of candidates) {
    if (resources.has(c)) return true;
    for (const r of Array.from(resources)) {
      if (r.includes(c) || c.includes(r)) return true;
    }
  }
  return false;
}

export function computeAssetFreshness(
  asset: WorkspaceAsset,
  lastRun: PipelineLastRunSummary | undefined,
  pipelineEnabled: boolean,
  resourcesTouched: Set<string>
): AssetFreshnessMeta {
  const pipelineMeta = computePipelineFreshness(lastRun, pipelineEnabled);

  if (asset.kind === "source") {
    return pipelineMeta;
  }

  if (!lastRun) {
    return {
      freshness: "never_run",
      label: "Never run",
      badgeClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
      detail: "No runs yet for this pipeline.",
    };
  }

  const status = lastRun.status.toLowerCase();
  if (status === "running" || status === "pending") {
    return {
      freshness: "running",
      label: "Running",
      badgeClass: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
      detail: "Pipeline run in progress.",
    };
  }

  if (asset.kind === "transform" || asset.kind === "post_transform") {
    const model = lastRun.dbtManifest?.models.find(
      (m) => m.name.toLowerCase() === asset.name.toLowerCase()
    );
    if (model) {
      if (model.status === "error") {
        return {
          freshness: "failed",
          label: "dbt failed",
          badgeClass: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200",
          detail: "This model failed on the last dbt run.",
        };
      }
      return {
        freshness: "fresh",
        label: "Built",
        badgeClass: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
        detail: "Observed on the last dbt run.",
      };
    }
    if (status === "failed" || status === "cancelled") {
      return pipelineMeta;
    }
    return {
      freshness: "stale",
      label: "Not on last run",
      badgeClass: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
      detail: "Expected from config but not reported on the last dbt manifest.",
    };
  }

  if (status === "failed" || status === "cancelled") {
    return pipelineMeta;
  }

  if (assetMatchesResource(asset, resourcesTouched)) {
    return {
      freshness: "fresh",
      label: "Loaded",
      badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
      detail: "Touched on the last run telemetry.",
    };
  }

  if (pipelineMeta.freshness === "fresh") {
    return {
      freshness: "stale",
      label: "Not seen",
      badgeClass: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
      detail: "Pipeline ran recently but this table was not in run telemetry.",
    };
  }

  return pipelineMeta;
}

function mapAssets(
  assets: WorkspaceAsset[],
  lastRun: PipelineLastRunSummary | undefined,
  enabled: boolean,
  resourcesTouched: Set<string>
): WorkspaceAsset[] {
  return assets.map((a) => ({
    ...a,
    assetFreshness: computeAssetFreshness(a, lastRun, enabled, resourcesTouched),
  }));
}

export function enrichBundleAssetFreshness(
  bundle: PipelineAssetBundle,
  resourcesTouched: Set<string>
): PipelineAssetBundle {
  const lastRun = bundle.lastRun;
  const enabled = bundle.enabled;
  return {
    ...bundle,
    source: { ...bundle.source, assetFreshness: computeAssetFreshness(bundle.source, lastRun, enabled, resourcesTouched) },
    rawAssets: mapAssets(bundle.rawAssets, lastRun, enabled, resourcesTouched),
    transforms: mapAssets(bundle.transforms, lastRun, enabled, resourcesTouched),
    postTransforms: mapAssets(bundle.postTransforms, lastRun, enabled, resourcesTouched),
  };
}
