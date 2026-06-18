/**
 * Lakeflow-style transform DAG — component steps as asset-centric dependency graph.
 */
import type { Edge, Node } from "@xyflow/react";
import type { PipelineComponentSpec } from "@/lib/elt/declarative-pipeline-spec";
import { routeComponent } from "@/lib/elt/component-compile-router";
import { getComponentById } from "@/lib/elt/component-registry";
import type { CanvasComponentNodeData } from "@/lib/elt/canvas-component-sync";

export type TransformDagNode = {
  id: string;
  specId: string;
  componentId: string;
  label: string;
  category: string;
  compileTarget: string;
  outputAsset: string | null;
  inputAssets: string[];
  order: number;
};

export type TransformDagEdge = {
  id: string;
  source: string;
  target: string;
};

export type TransformDagGraph = {
  nodes: TransformDagNode[];
  edges: TransformDagEdge[];
  layers: string[][];
  mermaid: string;
};

function resolveOutputAsset(config: Record<string, unknown>): string | null {
  const out = String(
    config.output_table ?? config.asset_name ?? config.table_name ?? config.table ?? ""
  ).trim();
  return out || null;
}

function resolveInputAsset(config: Record<string, unknown>): string | null {
  const left = String(config.left_table ?? config.left_asset_key ?? "").trim();
  const right = String(config.right_table ?? config.right_asset_key ?? "").trim();
  const table = String(config.table ?? config.input_table ?? "").trim();
  if (left && right) return `${left} + ${right}`;
  return table || null;
}

function topoFromSpecs(components: PipelineComponentSpec[]): PipelineComponentSpec[] {
  const byId = new Map(components.map((c) => [c.id, c]));
  const indeg = new Map<string, number>();
  for (const c of components) indeg.set(c.id, 0);
  for (const c of components) {
    for (const dep of c.after ?? []) {
      if (byId.has(dep)) indeg.set(c.id, (indeg.get(c.id) ?? 0) + 1);
    }
  }
  const q = components.filter((c) => (indeg.get(c.id) ?? 0) === 0).map((c) => c.id);
  const out: PipelineComponentSpec[] = [];
  const adj = new Map<string, string[]>();
  for (const c of components) {
    for (const dep of c.after ?? []) {
      if (!adj.has(dep)) adj.set(dep, []);
      adj.get(dep)!.push(c.id);
    }
  }
  while (q.length) {
    const id = q.shift()!;
    const c = byId.get(id);
    if (c) out.push(c);
    for (const t of adj.get(id) ?? []) {
      indeg.set(t, (indeg.get(t) ?? 0) - 1);
      if (indeg.get(t) === 0) q.push(t);
    }
  }
  for (const c of components) {
    if (!out.some((x) => x.id === c.id)) out.push(c);
  }
  return out;
}

function specsFromCanvas(nodes: Node[], edges: Edge[]): PipelineComponentSpec[] {
  const componentNodes = nodes.filter((n) => n.type === "componentNode");
  const specs: PipelineComponentSpec[] = [];
  const nodeToSpec = new Map<string, string>();

  for (const node of componentNodes) {
    const d = node.data as CanvasComponentNodeData;
    const componentId = String(d.componentId ?? "").trim();
    if (!componentId) continue;
    const specId = String(d.label ?? componentId)
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/^[^a-zA-Z]/, "c_")
      .slice(0, 128);
    nodeToSpec.set(node.id, specId);
    const category = d.category ?? getComponentById(componentId)?.category ?? "transformation";
    const route = routeComponent(componentId, category);
    specs.push({
      id: specId,
      type: route.target === "quality" ? "quality" : "python",
      config: { ...(d.config ?? {}), template_id: componentId },
    });
  }

  for (const spec of specs) {
    const nodeId = [...nodeToSpec.entries()].find(([, sid]) => sid === spec.id)?.[0];
    if (!nodeId) continue;
    const after: string[] = [];
    for (const e of edges) {
      if (e.target !== nodeId) continue;
      const srcSpec = nodeToSpec.get(e.source);
      if (srcSpec) after.push(srcSpec);
    }
    if (after.length) spec.after = after;
  }

  return specs;
}

export function deriveTransformDag(
  nodes: Node[],
  edges: Edge[],
  specComponents?: PipelineComponentSpec[] | null
): TransformDagGraph {
  const components =
    specComponents?.length ? specComponents : specsFromCanvas(nodes, edges);
  const ordered = topoFromSpecs(components);
  const assetBySpec = new Map<string, string | null>();

  const dagNodes: TransformDagNode[] = ordered.map((spec, idx) => {
    const cfg = (spec.config ?? {}) as Record<string, unknown>;
    const componentId = String(cfg.template_id ?? cfg.component_id ?? spec.id).trim();
    const catalog = getComponentById(componentId);
    const category = catalog?.category ?? "transformation";
    const route = routeComponent(componentId, category);
    const outputAsset = resolveOutputAsset(cfg);
    if (outputAsset) assetBySpec.set(spec.id, outputAsset);
    const inputFromCfg = resolveInputAsset(cfg);
    const inputAssets: string[] = [];
    if (inputFromCfg) inputAssets.push(inputFromCfg);
    for (const dep of spec.after ?? []) {
      const upstream = assetBySpec.get(dep);
      if (upstream && !inputAssets.includes(upstream)) inputAssets.push(upstream);
    }
    return {
      id: spec.id,
      specId: spec.id,
      componentId,
      label: String(cfg.label ?? catalog?.name ?? componentId),
      category,
      compileTarget: route.target,
      outputAsset,
      inputAssets,
      order: idx + 1,
    };
  });

  const dagEdges: TransformDagEdge[] = [];
  for (const spec of components) {
    for (const dep of spec.after ?? []) {
      dagEdges.push({ id: `${dep}->${spec.id}`, source: dep, target: spec.id });
    }
  }

  const layers: string[][] = [];
  const placed = new Set<string>();
  let frontier = dagNodes.filter((n) => !dagEdges.some((e) => e.target === n.specId)).map((n) => n.specId);
  while (frontier.length) {
    layers.push([...frontier]);
    frontier.forEach((id) => placed.add(id));
    const next = new Set<string>();
    for (const e of dagEdges) {
      if (frontier.includes(e.source) && !placed.has(e.target)) next.add(e.target);
    }
    frontier = [...next].filter((id) => !placed.has(id));
    if (!frontier.length) break;
  }
  for (const n of dagNodes) {
    if (!placed.has(n.specId)) {
      if (!layers.length) layers.push([]);
      layers[layers.length - 1]!.push(n.specId);
    }
  }

  const lines = ["flowchart LR"];
  for (const n of dagNodes) {
    const label = `${n.label}\\n(${n.componentId})`;
    const safe = n.specId.replace(/[^a-zA-Z0-9_]/g, "_");
    lines.push(`  ${safe}["${label}"]`);
  }
  for (const e of dagEdges) {
    const s = e.source.replace(/[^a-zA-Z0-9_]/g, "_");
    const t = e.target.replace(/[^a-zA-Z0-9_]/g, "_");
    lines.push(`  ${s} --> ${t}`);
  }

  return {
    nodes: dagNodes,
    edges: dagEdges,
    layers,
    mermaid: lines.join("\n"),
  };
}
