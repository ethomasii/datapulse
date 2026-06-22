import type { PipelineAssetBundle, WorkspaceAsset } from "@/lib/elt/pipeline-assets";

export type LineageNodeKind = "source" | "raw" | "transform" | "post_transform" | "object";

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
  /** True when edges come from dbt manifest parent_map */
  fromManifest?: boolean;
};

function assetByShortName(bundle: PipelineAssetBundle, shortName: string): WorkspaceAsset | undefined {
  const q = shortName.toLowerCase().trim();
  const all = [
    bundle.source,
    ...bundle.rawAssets,
    ...bundle.transforms,
    ...bundle.postTransforms,
  ];
  return all.find(
    (a) =>
      a.name.toLowerCase() === q ||
      a.displayName.toLowerCase() === q ||
      a.id.toLowerCase().endsWith(`:${q}`)
  );
}

function pushNode(nodes: AssetLineageNode[], asset: WorkspaceAsset) {
  if (nodes.some((n) => n.id === asset.id)) return;
  nodes.push({
    id: asset.id,
    kind: asset.kind,
    label: asset.displayName,
    sublabel: asset.landingQualified ?? asset.landingDataset,
  });
}

/** Build lineage from dbt manifest modelDependencies (parent_map). */
export function buildManifestLineageGraph(
  bundle: PipelineAssetBundle,
  modelDependencies: Record<string, string[]>
): AssetLineageGraph {
  const nodes: AssetLineageNode[] = [];
  const edges: AssetLineageEdge[] = [];
  const edgeKeys = new Set<string>();

  pushNode(nodes, bundle.source);
  for (const raw of bundle.rawAssets) pushNode(nodes, raw);
  for (const t of bundle.transforms) pushNode(nodes, t);
  for (const p of bundle.postTransforms) pushNode(nodes, p);

  const addEdge = (from: string, to: string) => {
    const key = `${from}->${to}`;
    if (edgeKeys.has(key) || from === to) return;
    edgeKeys.add(key);
    edges.push({ id: key, from, to });
  };

  // Source → raw landing tables
  for (const raw of bundle.rawAssets) {
    addEdge(bundle.source.id, raw.id);
  }

  // Manifest: parent → child for each dbt model
  for (const [modelName, parents] of Object.entries(modelDependencies)) {
    const child = assetByShortName(bundle, modelName);
    if (!child) continue;
    pushNode(nodes, child);

    let linked = false;
    for (const parentName of parents) {
      const parent = assetByShortName(bundle, parentName);
      if (parent) {
        pushNode(nodes, parent);
        addEdge(parent.id, child.id);
        linked = true;
      }
    }

    // Orphan transform with no resolved parents → link from source or first raw
    if (!linked) {
      const fallback = bundle.rawAssets[0] ?? bundle.source;
      addEdge(fallback.id, child.id);
    }
  }

  // Post-transforms chain from nearest transform
  for (const p of bundle.postTransforms) {
    pushNode(nodes, p);
    const parent = bundle.transforms.find((t) => modelDependencies[p.name]?.includes(t.name)) ??
      bundle.transforms[0] ??
      bundle.rawAssets[0] ??
      bundle.source;
    addEdge(parent.id, p.id);
  }

  return { nodes, edges, fromManifest: true };
}

/** Build source → raw → transform graph; uses manifest deps when available on last run. */
export function buildAssetLineageGraph(bundle: PipelineAssetBundle): AssetLineageGraph {
  const deps = bundle.lastRun?.dbtManifest?.modelDependencies;
  if (deps && Object.keys(deps).length > 0) {
    return buildManifestLineageGraph(bundle, deps);
  }

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

  return { nodes, edges, fromManifest: false };
}
