import type { DbtRunManifest } from "@/lib/elt/dbt-run-manifest";
import type { PipelineAssetBundle } from "@/lib/elt/pipeline-assets";

/** Mark transform assets observed on the last successful dbt manifest. */
export function enrichBundleFromDbtManifest(bundle: PipelineAssetBundle): PipelineAssetBundle {
  const manifest: DbtRunManifest | undefined = bundle.lastRun?.dbtManifest;
  if (!manifest?.models?.length) return bundle;

  const observed = new Set(manifest.models.filter((m) => m.status === "success").map((m) => m.name.toLowerCase()));

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
