/**
 * Build / merge React Flow canvas graphs from AI component selections (Lakeflow NL loop).
 */

import type { Edge, Node } from "@xyflow/react";
import { getComponentById } from "@/lib/elt/component-registry";
import { routeComponent, type ComponentCompileTarget } from "@/lib/elt/component-compile-router";
import { canvasPortsForCategory, normalizeComponentCategory } from "@/lib/elt/component-canvas-io";
import {
  extractComponentsFromCanvas,
  filterCanvasEdges,
  type ExtractedCanvasComponents,
} from "@/lib/elt/canvas-component-sync";
import { autoLayoutPipelineCanvas } from "@/lib/elt/canvas-auto-layout";
import { getCanvasFromSourceConfig, type PipelineCanvasGraph } from "@/lib/elt/canvas-source-config";

const dashedAnimatedEdgeStyle = {
  strokeWidth: 2,
  stroke: "#64748b",
  strokeDasharray: "6 4",
} as const;

export type AiPipelineComponentInput = {
  component_id: string;
  label?: string;
  config?: Record<string, unknown>;
};

export type BuildPipelineCanvasOptions = {
  sourceType?: string;
  destinationType?: string;
  sourceHint?: string;
  destinationHint?: string;
  components?: AiPipelineComponentInput[];
  /** When set, merge new components into an existing saved canvas. */
  existingCanvas?: PipelineCanvasGraph | null;
};

type ComponentPlacement = "pre_dest" | "post_dest" | "parallel";

function placementForComponent(
  category: string,
  compileTarget: ComponentCompileTarget
): ComponentPlacement {
  const cat = normalizeComponentCategory(category);
  if (compileTarget === "monitor" || cat === "sensor" || cat === "observation") return "parallel";
  if (compileTarget === "quality" || cat === "check") return "post_dest";
  if (
    cat === "transformation" ||
    compileTarget === "warehouse" ||
    compileTarget === "dbt" ||
    compileTarget === "python"
  ) {
    return "post_dest";
  }
  return "pre_dest";
}

function edgeId(source: string, target: string): string {
  return `e-${source}-${target}`;
}

function normalizeEdges(edges: Edge[]): Edge[] {
  return edges.map((e) => ({
    ...e,
    animated: e.animated !== false,
    style: { ...dashedAnimatedEdgeStyle, ...e.style },
  }));
}

function makeEdge(source: string, target: string): Edge {
  return {
    id: edgeId(source, target),
    source,
    target,
    animated: true,
    style: { ...dashedAnimatedEdgeStyle },
  };
}

function buildComponentNode(
  input: AiPipelineComponentInput,
  id: string,
  position: { x: number; y: number }
): Node | null {
  const catalog = getComponentById(input.component_id);
  if (!catalog) return null;

  const route = routeComponent(catalog.id, catalog.category);
  const compileTarget = route.target;
  const category = catalog.category;
  const ports = canvasPortsForCategory(category);

  return {
    id,
    type: "componentNode",
    position,
    data: {
      componentId: catalog.id,
      label: input.label?.trim() || catalog.name,
      category,
      compileTarget,
      compileBadge: route.badge ?? compileTarget,
      compileHint: route.hint,
      canvasPorts: ports,
      config: { ...(input.config ?? {}) },
    },
  };
}

function findOrCreateSourceDest(nodes: Node[], options: BuildPipelineCanvasOptions): {
  sourceId: string;
  destId: string;
  nodes: Node[];
} {
  const next = [...nodes];
  let source = next.find((n) => n.type === "sourceNode");
  let dest = next.find((n) => n.type === "destNode");

  if (!source) {
    source = {
      id: "src-ai",
      type: "sourceNode",
      position: { x: 40, y: 160 },
      data: {
        hint: options.sourceHint ?? (options.sourceType ? `${options.sourceType} extract` : "Source"),
      },
    };
    next.push(source);
  }

  if (!dest) {
    dest = {
      id: "dest-ai",
      type: "destNode",
      position: { x: 520, y: 160 },
      data: {
        hint: options.destinationHint ?? (options.destinationType ? `${options.destinationType} load` : "Destination"),
      },
    };
    next.push(dest);
  }

  return { sourceId: source.id, destId: dest.id, nodes: next };
}

/** Left-to-right layout with clear spacing — run after graph build/merge. */
export function relayoutPipelineCanvas(nodes: Node[], edges: Edge[]): Node[] {
  return autoLayoutPipelineCanvas(nodes, edges);
}

/** Build or extend a pipeline canvas graph from AI-selected components. */
export function buildPipelineCanvasFromComponents(
  options: BuildPipelineCanvasOptions
): { nodes: Node[]; edges: Edge[] } {
  const inputs = options.components ?? [];
  const existingNodes = (options.existingCanvas?.nodes ?? []) as Node[];
  const existingEdges = (options.existingCanvas?.edges ?? []) as Edge[];

  const { sourceId, destId, nodes: baseNodes } = findOrCreateSourceDest(existingNodes, options);
  const nodes: Node[] = [...baseNodes];
  const edges: Edge[] = [...existingEdges];

  const preDest: Node[] = [];
  const postDest: Node[] = [];
  const parallel: Node[] = [];

  let compIdx = 0;
  for (const input of inputs) {
    const id = `comp-ai-${input.component_id}-${compIdx}`;
    compIdx += 1;
    const node = buildComponentNode(input, id, { x: 0, y: 0 });
    if (!node) continue;

    const d = node.data as Record<string, unknown>;
    const placement = placementForComponent(
      String(d.category ?? ""),
      String(d.compileTarget ?? "") as ComponentCompileTarget
    );
    if (placement === "parallel") parallel.push(node);
    else if (placement === "post_dest") postDest.push(node);
    else preDest.push(node);
    nodes.push(node);
  }

  // Backbone: source → [pre chain] → dest → [post chain]
  const hasBackbone = edges.some((e) => e.source === sourceId && e.target === destId);
  let chainTail = sourceId;

  if (preDest.length === 0 && !hasBackbone && !edges.some((e) => e.source === sourceId)) {
    edges.push(makeEdge(sourceId, destId));
  }

  for (let i = 0; i < preDest.length; i++) {
    const node = preDest[i]!;
    node.position = { x: 180 + i * 200, y: 160 };
    const prev = i === 0 ? sourceId : preDest[i - 1]!.id;
    if (!edges.some((e) => e.source === prev && e.target === node.id)) {
      edges.push(makeEdge(prev, node.id));
    }
    chainTail = node.id;
  }

  if (preDest.length > 0 && !edges.some((e) => e.source === chainTail && e.target === destId)) {
    edges.push(makeEdge(chainTail, destId));
  } else if (preDest.length === 0 && !hasBackbone && !edges.some((e) => e.source === sourceId && e.target === destId)) {
    edges.push(makeEdge(sourceId, destId));
  }

  let postTail = destId;
  for (let i = 0; i < postDest.length; i++) {
    const node = postDest[i]!;
    node.position = { x: 720 + i * 200, y: 160 };
    if (!edges.some((e) => e.source === postTail && e.target === node.id)) {
      edges.push(makeEdge(postTail, node.id));
    }
    postTail = node.id;
  }

  for (let i = 0; i < parallel.length; i++) {
    const node = parallel[i]!;
    node.position = { x: 180 + i * 200, y: 40 };
    if (!edges.some((e) => e.source === sourceId && e.target === node.id)) {
      edges.push(makeEdge(sourceId, node.id));
    }
  }

  const resolved = normalizeEdges(edges);
  const filtered = filterCanvasEdges(nodes, resolved);
  const laidOut = relayoutPipelineCanvas(nodes, filtered);
  return { nodes: laidOut, edges: filtered };
}

/** Attach a built canvas to sourceConfiguration and return extraction summary. */
export function applyCanvasComponentsToSourceConfig(
  sourceConfiguration: Record<string, unknown>,
  options: BuildPipelineCanvasOptions
): {
  sourceConfiguration: Record<string, unknown>;
  canvas: PipelineCanvasGraph;
  extracted: ExtractedCanvasComponents;
  skippedComponents: string[];
} {
  const existing = getCanvasFromSourceConfig(sourceConfiguration);
  const skippedComponents: string[] = [];
  const validInputs = (options.components ?? []).filter((c) => {
    if (getComponentById(c.component_id)) return true;
    skippedComponents.push(c.component_id);
    return false;
  });

  const { nodes, edges } = buildPipelineCanvasFromComponents({
    ...options,
    components: validInputs,
    existingCanvas: existing,
  });

  const canvas: PipelineCanvasGraph = { nodes, edges, v: 1 };
  const next: Record<string, unknown> = { ...sourceConfiguration, canvas };
  const extracted = extractComponentsFromCanvas(nodes, edges);

  if (extracted.components.length) {
    next.elt_components = extracted.components;
  }
  if (extracted.quality.length) {
    next.elt_quality = extracted.quality;
  }
  if (extracted.sensorMonitors.length) {
    next.elt_canvas_sensors = extracted.sensorMonitors.map((s) => ({
      component_id: s.componentId,
      monitor_type: s.monitorType,
      label: s.label,
      config: s.config,
    }));
  }

  return { sourceConfiguration: next, canvas, extracted, skippedComponents };
}
