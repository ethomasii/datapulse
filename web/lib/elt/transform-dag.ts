/**
 * Lakeflow-style unified transform DAG — components + dbt/python/sql transform nodes.
 */
import type { Edge, Node } from "@xyflow/react";
import type { PipelineComponentSpec } from "@/lib/elt/declarative-pipeline-spec";
import { routeComponent } from "@/lib/elt/component-compile-router";
import { getComponentById } from "@/lib/elt/component-registry";
import type { CanvasComponentNodeData } from "@/lib/elt/canvas-component-sync";
import {
  deriveStepAssetKey,
  enrichComponentListAssets,
  normalizeAssetKey,
  resolveStepInputAssetKeys,
} from "@/lib/elt/pipeline-asset-keys";

export type TransformDagNodeKind = "extract" | "load" | "transform" | "component";

export type TransformDagNode = {
  id: string;
  specId: string;
  kind: TransformDagNodeKind;
  componentId: string;
  label: string;
  category: string;
  compileTarget: string;
  assetKey: string | null;
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

function specsFromCanvas(nodes: Node[], edges: Edge[], pipelineName: string): PipelineComponentSpec[] {
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

  return enrichComponentListAssets(pipelineName, specs);
}

function transformStepsFromCanvas(
  nodes: Node[],
  edges: Edge[],
  pipelineName: string,
  lastComponentId: string | null
): PipelineComponentSpec[] {
  const transforms = nodes.filter((n) => n.type === "transformNode");
  const out: PipelineComponentSpec[] = [];
  let prevId = lastComponentId;

  transforms.forEach((node, i) => {
    const d = node.data as Record<string, unknown>;
    const tool = String(d.transformTool ?? "other");
    const specId = `transform_${tool}_${i + 1}`;
    const type = tool === "dbt" ? "dbt" : tool === "sql" ? "sql" : "python";
    const config: Record<string, unknown> = {
      transform_tool: tool,
      ...(tool === "dbt"
        ? {
            package_path: d.dbtPackagePath,
            selector: d.dbtSelector,
            dataset_name: d.dbtTargetSchema,
          }
        : {}),
      ...(tool === "python" || tool === "sql" ? { code: d.postTransformCode } : {}),
    };
    out.push({
      id: specId,
      type,
      config,
      ...(prevId ? { after: [prevId] } : {}),
      assetKey: deriveStepAssetKey(pipelineName, specId, {
        asset_name: `${pipelineName}.${specId}`,
      }),
    });
    prevId = specId;
  });

  return out;
}

function backboneNodes(pipelineName: string): TransformDagNode[] {
  return [
    {
      id: "__source",
      specId: "__source",
      kind: "extract",
      componentId: "source",
      label: "Extract",
      category: "source",
      compileTarget: "dlt",
      assetKey: null,
      outputAsset: `${pipelineName}.raw`,
      inputAssets: [],
      order: 0,
    },
    {
      id: "__dest",
      specId: "__dest",
      kind: "load",
      componentId: "destination",
      label: "Load",
      category: "sink",
      compileTarget: "dlt",
      assetKey: `${pipelineName}.staging`,
      outputAsset: `${pipelineName}.staging`,
      inputAssets: [`${pipelineName}.raw`],
      order: 0,
    },
  ];
}

export function deriveTransformDag(
  nodes: Node[],
  edges: Edge[],
  specComponents?: PipelineComponentSpec[] | null,
  opts?: { pipelineName?: string }
): TransformDagGraph {
  const pipelineName = String(opts?.pipelineName ?? "pipeline").trim() || "pipeline";
  const componentSpecs =
    specComponents?.length
      ? enrichComponentListAssets(pipelineName, specComponents)
      : specsFromCanvas(nodes, edges, pipelineName);

  const lastCompId = componentSpecs.length ? componentSpecs[componentSpecs.length - 1]!.id : null;
  const transformSpecs = transformStepsFromCanvas(nodes, edges, pipelineName, lastCompId);
  const allSpecs = [...componentSpecs, ...transformSpecs];
  const ordered = topoFromSpecs(allSpecs);
  const assetBySpec = new Map<string, string>();

  const dagNodes: TransformDagNode[] = [];
  let order = 0;

  for (const b of backboneNodes(pipelineName)) {
    dagNodes.push({ ...b, order: order++ });
  }

  for (const spec of ordered) {
    const cfg = (spec.config ?? {}) as Record<string, unknown>;
    const componentId = String(cfg.template_id ?? cfg.component_id ?? spec.id).trim();
    const isTransform = spec.id.startsWith("transform_");
    const catalog = isTransform ? null : getComponentById(componentId);
    const category = isTransform ? "transform" : (catalog?.category ?? "transformation");
    const route = isTransform
      ? { target: spec.type, hint: spec.type }
      : routeComponent(componentId, category);
    const assetKey = spec.assetKey ?? deriveStepAssetKey(pipelineName, spec.id, cfg);
    assetBySpec.set(spec.id, assetKey);
    const inputAssets = spec.inputs ?? resolveStepInputAssetKeys(cfg, assetBySpec);

    dagNodes.push({
      id: spec.id,
      specId: spec.id,
      kind: isTransform ? "transform" : "component",
      componentId: isTransform ? String(cfg.transform_tool ?? spec.type) : componentId,
      label: String(cfg.label ?? catalog?.name ?? spec.id),
      category,
      compileTarget: route.target,
      assetKey,
      outputAsset: assetKey,
      inputAssets,
      order: order++,
    });
  }

  const dagEdges: TransformDagEdge[] = [
    { id: "extract->load", source: "__source", target: "__dest" },
  ];

  const firstStep = ordered[0];
  if (firstStep) {
    dagEdges.push({ id: "load->first", source: "__dest", target: firstStep.id });
  }

  for (const spec of allSpecs) {
    for (const dep of spec.after ?? []) {
      dagEdges.push({ id: `${dep}->${spec.id}`, source: dep, target: spec.id });
    }
  }

  const layers: string[][] = [["__source"], ["__dest"]];
  const stepIds = ordered.map((s) => s.id);
  if (stepIds.length) {
    const layerMap = new Map<number, string[]>();
    for (const spec of ordered) {
      const depth = (spec.after ?? []).length;
      if (!layerMap.has(depth)) layerMap.set(depth, []);
      layerMap.get(depth)!.push(spec.id);
    }
    const depths = [...layerMap.keys()].sort((a, b) => a - b);
    for (const d of depths) {
      layers.push(layerMap.get(d)!);
    }
  }

  const lines = ["flowchart LR"];
  for (const n of dagNodes) {
    const keyLabel = n.assetKey ? `\\n${n.assetKey}` : "";
    const label = `${n.label}${keyLabel}`;
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

export { normalizeAssetKey };
