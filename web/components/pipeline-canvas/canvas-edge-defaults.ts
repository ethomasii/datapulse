import type { Edge, Node } from "@xyflow/react";

/**
 * Valid pipeline wiring: extract → load → zero or more transforms.
 * Downstream of a transform may only be another transform (not load or extract).
 * Into a transform: from destination (load) or another transform only — not directly from source.
 */
export function filterEdgesToPipelineRules(nodes: Node[], edges: Edge[]): Edge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return edges.filter((e) => {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (!s?.type || !t?.type) return false;
    if (s.type === "transformNode") {
      return t.type === "transformNode";
    }
    if (t.type === "transformNode") {
      return s.type === "destNode" || s.type === "transformNode";
    }
    return true;
  });
}

/** Visible dashed edges + motion along the path (React Flow `animated`). */
export const dashedAnimatedEdgeStyle = {
  strokeWidth: 2,
  stroke: "#64748b",
  strokeDasharray: "6 4",
} as const;

export function normalizeEdgesWithDefaults(edges: Edge[]): Edge[] {
  return edges.map((e) => ({
    ...e,
    animated: e.animated !== false,
    style: { ...dashedAnimatedEdgeStyle, ...e.style },
  }));
}

/**
 * If a graph was saved without edges (e.g. older draft / empty array), infer EL→T wiring from node types.
 */
export function withFallbackEdges(nodes: Node[]): Edge[] {
  if (nodes.length < 2) return [];
  const source = nodes.find((n) => n.type === "sourceNode");
  const dest = nodes.find((n) => n.type === "destNode");
  const transform = nodes.find((n) => n.type === "transformNode");
  const base = { animated: true as const, style: { ...dashedAnimatedEdgeStyle } };
  if (source && dest && transform) {
    return [
      { id: "e-f1", source: source.id, target: dest.id, ...base },
      { id: "e-f2", source: dest.id, target: transform.id, ...base },
    ];
  }
  if (source && dest) {
    return [{ id: "e-f1", source: source.id, target: dest.id, ...base }];
  }
  if (nodes.length <= 4) {
    const sorted = [...nodes].sort((a, b) => a.position.x - b.position.x);
    return sorted.slice(0, -1).map((n, i) => ({
      id: `e-fb-${i}`,
      source: n.id,
      target: sorted[i + 1].id,
      ...base,
    }));
  }
  return [];
}

export function resolveCanvasEdges(nodes: Node[], edges: Edge[] | undefined | null): Edge[] {
  const list = Array.isArray(edges) ? edges : [];
  const resolved = list.length > 0 ? list : withFallbackEdges(nodes);
  const normalized = normalizeEdgesWithDefaults(resolved);
  return filterEdgesToPipelineRules(nodes, normalized);
}
