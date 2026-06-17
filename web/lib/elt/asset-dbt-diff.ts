import type { PipelineAssetBundle } from "@/lib/elt/pipeline-assets";

export type DbtAssetDiff = {
  expectedModels: string[];
  observedModels: string[];
  /** Config-declared models not present on last run manifest. */
  missingFromRun: string[];
  /** Manifest models not declared in config-derived assets. */
  extraOnRun: string[];
  failedModels: string[];
  manifestSource?: "config" | "runner";
};

export function computeDbtAssetDiff(bundle: PipelineAssetBundle): DbtAssetDiff | null {
  const expected = bundle.transforms.map((t) => t.name).filter(Boolean);
  if (expected.length === 0 && !bundle.lastRun?.dbtManifest?.models.length) {
    return null;
  }

  const manifest = bundle.lastRun?.dbtManifest;
  const observed = (manifest?.models ?? []).map((m) => m.name);
  const expectedSet = new Set(expected.map((n) => n.toLowerCase()));
  const observedSet = new Set(observed.map((n) => n.toLowerCase()));

  const missingFromRun = expected.filter((n) => !observedSet.has(n.toLowerCase()));
  const extraOnRun = observed.filter((n) => !expectedSet.has(n.toLowerCase()));
  const failedModels = (manifest?.models ?? [])
    .filter((m) => m.status === "error")
    .map((m) => m.name);

  return {
    expectedModels: expected,
    observedModels: observed,
    missingFromRun,
    extraOnRun,
    failedModels,
    manifestSource: manifest?.source,
  };
}
