/**
 * Full declarative spec ↔ canvas round-trip (Lakeflow Designer layout).
 */
import type { Edge, Node } from "@xyflow/react";
import type { DeclarativePipelineSpec, PipelineComponentSpec } from "@/lib/elt/declarative-pipeline-spec";
import { routeComponent } from "@/lib/elt/component-compile-router";
import { getComponentById } from "@/lib/elt/component-registry";
import type { PipelineCanvasGraph } from "@/lib/elt/canvas-source-config";
import { enrichComponentListAssets } from "@/lib/elt/pipeline-asset-keys";

let layoutCounter = 0;

function nextNodeId(prefix: string) {
  layoutCounter += 1;
  return `spec_${prefix}_${layoutCounter}`;
}

export function extractSpecComponents(sourceConfiguration: Record<string, unknown>): PipelineComponentSpec[] {
  const raw = sourceConfiguration.elt_components;
  if (Array.isArray(raw) && raw.length) {
    return raw as PipelineComponentSpec[];
  }
  return [];
}

function defaultBackbone(sourceType: string, destType: string): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    {
      id: "n_source",
      type: "sourceNode",
      position: { x: 40, y: 120 },
      data: { hint: `Source: ${sourceType}` },
    },
    {
      id: "n_dest",
      type: "destNode",
      position: { x: 360, y: 120 },
      data: { hint: `Destination: ${destType}` },
    },
  ];
  const edges: Edge[] = [
    { id: "e_source_dest", source: "n_source", target: "n_dest", animated: true },
  ];
  return { nodes, edges };
}

/** Build full canvas graph from v2 declarative spec (YAML apply → designer). */
export function buildCanvasFromDeclarativeSpec(
  spec: DeclarativePipelineSpec,
  sourceType: string,
  destinationType: string
): PipelineCanvasGraph {
  const { nodes, edges } = defaultBackbone(sourceType, destinationType);
  const pipelineName = spec.name;
  const components = spec.components?.length
    ? enrichComponentListAssets(pipelineName, spec.components)
    : [];

  let anchorX = 560;
  let anchorY = 80;
  const specIdToNodeId = new Map<string, string>();
  let lastNodeId = "n_dest";

  const dbt = spec.transform?.dbt;
  if (dbt?.enabled !== false && dbt) {
    const tid = nextNodeId("dbt");
    nodes.push({
      id: tid,
      type: "transformNode",
      position: { x: anchorX, y: anchorY },
      data: {
        label: "dbt transform",
        transformTool: "dbt",
        dbtPackagePath: dbt.package_path ?? dbt.packagePath ?? "",
        dbtSelector: dbt.select ?? dbt.selector ?? "",
        dbtTargetSchema: dbt.dataset_name ?? dbt.datasetName ?? "",
      },
    });
    edges.push({ id: `e_${lastNodeId}_${tid}`, source: lastNodeId, target: tid, animated: true });
    lastNodeId = tid;
    anchorY += 100;
  }

  const postType = spec.transform?.post_transform_type ?? spec.transform?.postTransformType;
  if (postType === "python" || postType === "sql") {
    const tid = nextNodeId("post");
    nodes.push({
      id: tid,
      type: "transformNode",
      position: { x: anchorX, y: anchorY },
      data: {
        label: `${postType} transform`,
        transformTool: postType,
        postTransformCode: "",
      },
    });
    edges.push({ id: `e_${lastNodeId}_${tid}`, source: lastNodeId, target: tid, animated: true });
    lastNodeId = tid;
    anchorY += 100;
  }

  components.forEach((comp, i) => {
    const cfg = (comp.config ?? {}) as Record<string, unknown>;
    const componentId = String(cfg.template_id ?? cfg.component_id ?? comp.type).trim();
    const catalog = getComponentById(componentId);
    const category = catalog?.category ?? "transformation";
    const route = routeComponent(componentId, category);
    const nodeId = nextNodeId(comp.id);
    specIdToNodeId.set(comp.id, nodeId);
    nodes.push({
      id: nodeId,
      type: "componentNode",
      position: { x: anchorX + 180, y: 80 + i * 100 },
      data: {
        componentId: componentId || comp.id,
        label: catalog?.name ?? comp.id,
        category,
        compileTarget: route.target,
        compileHint: route.hint,
        config: {
          ...cfg,
          template_id: componentId || comp.id,
          asset_key: comp.assetKey,
          input_asset_keys: comp.inputs,
        },
      },
    });

    const upstream = comp.after?.length ? comp.after[comp.after.length - 1]! : lastNodeId;
    const upstreamNode = specIdToNodeId.get(upstream) ?? (upstream === lastNodeId ? lastNodeId : undefined);
    if (upstreamNode) {
      edges.push({
        id: `e_${upstreamNode}_${nodeId}`,
        source: upstreamNode,
        target: nodeId,
        animated: true,
      });
    } else if (comp.after?.length) {
      for (const dep of comp.after) {
        const src = specIdToNodeId.get(dep);
        if (src) {
          edges.push({ id: `e_${src}_${nodeId}`, source: src, target: nodeId, animated: true });
        }
      }
    } else {
      edges.push({ id: `e_${lastNodeId}_${nodeId}`, source: lastNodeId, target: nodeId, animated: true });
    }
  });

  return { nodes, edges, v: 1 };
}

/** Lay out missing component nodes from elt_components when canvas exists. */
export function mergeSpecComponentsIntoCanvas(
  canvas: PipelineCanvasGraph,
  components: PipelineComponentSpec[],
  pipelineName = "pipeline"
): PipelineCanvasGraph {
  if (!components.length) return canvas;

  const enriched = enrichComponentListAssets(pipelineName, components);
  const nodes = [...(canvas.nodes as Node[])];
  const edges = [...(canvas.edges as Edge[])];
  const specIdToNodeId = new Map<string, string>();

  for (const node of nodes) {
    if (node.type !== "componentNode") continue;
    const d = node.data as { componentId?: string; label?: string };
    const sid = String(d.label ?? d.componentId ?? "")
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/^[^a-zA-Z]/, "c_");
    if (sid) specIdToNodeId.set(sid, node.id);
  }

  const baseX = 520;
  enriched.forEach((spec, i) => {
    if (specIdToNodeId.has(spec.id)) return;
    const cfg = (spec.config ?? {}) as Record<string, unknown>;
    const componentId = String(cfg.template_id ?? cfg.component_id ?? "").trim();
    if (!componentId) return;
    const catalog = getComponentById(componentId);
    const category = catalog?.category ?? "transformation";
    const route = routeComponent(componentId, category);
    const nodeId = nextNodeId(spec.id);
    specIdToNodeId.set(spec.id, nodeId);
    nodes.push({
      id: nodeId,
      type: "componentNode",
      position: { x: baseX, y: 80 + i * 100 },
      data: {
        componentId,
        label: catalog?.name ?? componentId,
        category,
        compileTarget: route.target,
        compileHint: route.hint,
        config: { ...cfg, template_id: componentId, asset_key: spec.assetKey },
      },
    });
  });

  for (const spec of enriched) {
    const targetId = specIdToNodeId.get(spec.id);
    if (!targetId) continue;
    for (const dep of spec.after ?? []) {
      const sourceId = specIdToNodeId.get(dep);
      if (!sourceId) continue;
      const edgeId = `spec_e_${sourceId}_${targetId}`;
      if (!edges.some((e) => e.id === edgeId)) {
        edges.push({ id: edgeId, source: sourceId, target: targetId, animated: true });
      }
    }
  }

  return { ...canvas, nodes, edges, v: canvas.v ?? 1 };
}

export function hydrateCanvasFromSourceConfiguration(
  sourceConfiguration: Record<string, unknown>,
  pipelineName = "pipeline"
): PipelineCanvasGraph | null {
  const canvas = sourceConfiguration.canvas;
  if (!canvas || typeof canvas !== "object") return null;
  const g = canvas as PipelineCanvasGraph;
  if (!Array.isArray(g.nodes) || !Array.isArray(g.edges)) return null;

  const hasComponents = g.nodes.some((n) => (n as Node).type === "componentNode");
  const specs = extractSpecComponents(sourceConfiguration);
  if (!hasComponents && specs.length) {
    return mergeSpecComponentsIntoCanvas(g, specs, pipelineName);
  }
  return g;
}
