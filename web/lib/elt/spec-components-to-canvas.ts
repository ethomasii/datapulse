/**
 * Rebuild component nodes on canvas from declarative spec / elt_components (spec → designer).
 */
import type { Edge, Node } from "@xyflow/react";
import type { PipelineComponentSpec } from "@/lib/elt/declarative-pipeline-spec";
import { routeComponent } from "@/lib/elt/component-compile-router";
import { getComponentById } from "@/lib/elt/component-registry";
import type { PipelineCanvasGraph } from "@/lib/elt/canvas-source-config";

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

/** Lay out component nodes from spec when canvas has none (or merge missing steps). */
export function mergeSpecComponentsIntoCanvas(
  canvas: PipelineCanvasGraph,
  components: PipelineComponentSpec[]
): PipelineCanvasGraph {
  if (!components.length) return canvas;

  const nodes = [...(canvas.nodes as Node[])];
  const edges = [...(canvas.edges as Edge[])];
  const existingSpecIds = new Set(
    nodes
      .filter((n) => n.type === "componentNode")
      .map((n) => String((n.data as { label?: string })?.label ?? "").replace(/[^a-zA-Z0-9_]/g, "_"))
  );

  const specIdToNodeId = new Map<string, string>();
  const baseX = 520;
  const baseY = 80;
  const rowH = 100;

  components.forEach((spec, i) => {
    const cfg = (spec.config ?? {}) as Record<string, unknown>;
    const componentId = String(cfg.template_id ?? cfg.component_id ?? "").trim();
    if (!componentId) return;

    const label = spec.id;
    if (existingSpecIds.has(label.replace(/[^a-zA-Z0-9_]/g, "_"))) {
      const existing = nodes.find(
        (n) =>
          n.type === "componentNode" &&
          String((n.data as { componentId?: string })?.componentId) === componentId
      );
      if (existing) specIdToNodeId.set(spec.id, existing.id);
      return;
    }

    const catalog = getComponentById(componentId);
    const category = catalog?.category ?? "transformation";
    const route = routeComponent(componentId, category);
    const nodeId = nextNodeId(spec.id);
    specIdToNodeId.set(spec.id, nodeId);

    nodes.push({
      id: nodeId,
      type: "componentNode",
      position: { x: baseX, y: baseY + i * rowH },
      data: {
        componentId,
        label: catalog?.name ?? componentId,
        category,
        compileTarget: route.target,
        compileHint: route.hint,
        config: { ...cfg, template_id: componentId },
      },
    });
  });

  for (const spec of components) {
    const targetId = specIdToNodeId.get(spec.id);
    if (!targetId) continue;
    for (const dep of spec.after ?? []) {
      const sourceId = specIdToNodeId.get(dep);
      if (!sourceId) continue;
      const edgeId = `spec_e_${sourceId}_${targetId}`;
      if (!edges.some((e) => e.id === edgeId)) {
        edges.push({
          id: edgeId,
          source: sourceId,
          target: targetId,
          animated: true,
        });
      }
    }
  }

  return { ...canvas, nodes, edges, v: canvas.v ?? 1 };
}

export function hydrateCanvasFromSourceConfiguration(
  sourceConfiguration: Record<string, unknown>
): PipelineCanvasGraph | null {
  const canvas = sourceConfiguration.canvas;
  if (!canvas || typeof canvas !== "object") return null;
  const g = canvas as PipelineCanvasGraph;
  if (!Array.isArray(g.nodes) || !Array.isArray(g.edges)) return null;

  const hasComponents = g.nodes.some((n) => (n as Node).type === "componentNode");
  const specs = extractSpecComponents(sourceConfiguration);
  if (!hasComponents && specs.length) {
    return mergeSpecComponentsIntoCanvas(g, specs);
  }
  return g;
}
