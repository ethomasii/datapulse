import type { PipelineAssetBundle, WorkspaceAsset } from "@/lib/elt/pipeline-assets";

export type LineageNodeKind = "source" | "raw" | "transform" | "post_transform";

export type AssetLineageNode = {
  id: string;
  kind: LineageNodeKind;
  label: string;
  sublabel?: string;
};

export type AssetLineageEdge = {
  id: string;
  from: string;
  to: string;
};

export type AssetLineageGraph = {
  nodes: AssetLineageNode[];
  edges: AssetLineageEdge[];
};

/** Build a simple source → raw → transform graph from a pipeline asset bundle. */
export function buildAssetLineageGraph(bundle: PipelineAssetBundle): AssetLineageGraph {
  const nodes: AssetLineageNode[] = [];
  const edges: AssetLineageEdge[] = [];

  const push = (asset: WorkspaceAsset) => {
    nodes.push({
      id: asset.id,
      kind: asset.kind,
      label: asset.displayName,
      sublabel: asset.landingQualified ?? asset.landingDataset,
    });
  };

  push(bundle.source);
  for (const raw of bundle.rawAssets) push(raw);
  for (const t of bundle.transforms) push(t);
  for (const p of bundle.postTransforms) push(p);

  for (const raw of bundle.rawAssets) {
    edges.push({ id: `${bundle.source.id}->${raw.id}`, from: bundle.source.id, to: raw.id });
  }

  if (bundle.rawAssets.length === 0) {
    for (const t of [...bundle.transforms, ...bundle.postTransforms]) {
      edges.push({ id: `${bundle.source.id}->${t.id}`, from: bundle.source.id, to: t.id });
    }
  } else {
    for (const t of bundle.transforms) {
      const parentRaw = bundle.rawAssets[0]!;
      edges.push({ id: `${parentRaw.id}->${t.id}`, from: parentRaw.id, to: t.id });
    }
    for (const p of bundle.postTransforms) {
      const parent = bundle.transforms[0] ?? bundle.rawAssets[0] ?? bundle.source;
      edges.push({ id: `${parent.id}->${p.id}`, from: parent.id, to: p.id });
    }
  }

  return { nodes, edges };
}
