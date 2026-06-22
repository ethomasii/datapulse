import type { Edge, Node } from "@xyflow/react";
import { filterCanvasEdges } from "@/lib/elt/canvas-component-sync";

export type ValidatePipelineCanvasOptions = {
  /** When true, source/destination catalog types must be set (saved pipeline + inspector). */
  requireConnectorTypes?: boolean;
  pipelineSourceType?: string | null;
  pipelineDestinationType?: string | null;
  /** Warehouse-native pipeline — no extract source; warehouse dest is the graph root. */
  transformOnly?: boolean;
};

export type PipelineCanvasValidationResult = {
  ok: boolean;
  errors: string[];
};

function assertReachableFromRoots(
  nodes: Node[],
  edges: Edge[],
  roots: Node[],
  errorMessage: string,
  errors: string[]
): void {
  if (roots.length === 0 || edges.length === 0) return;
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }
  const visited = new Set<string>();
  const q = roots.map((r) => r.id);
  for (const id of q) visited.add(id);
  while (q.length) {
    const u = q.shift()!;
    for (const v of adj.get(u) ?? []) {
      if (!visited.has(v)) {
        visited.add(v);
        q.push(v);
      }
    }
  }
  for (const n of nodes) {
    if (!visited.has(n.id)) {
      errors.push(errorMessage);
      break;
    }
  }
}

/**
 * Validates the visual pipeline graph before persisting or exporting JSON.
 * Intended to block unusable diagrams that would produce misleading codegen or boilerplate.
 */
export function validatePipelineCanvasGraph(
  nodes: Node[],
  edges: Edge[],
  options: ValidatePipelineCanvasOptions = {}
): PipelineCanvasValidationResult {
  const errors: string[] = [];
  const transformOnly = options.transformOnly === true;
  const sources = nodes.filter((n) => n.type === "sourceNode");
  const dests = nodes.filter((n) => n.type === "destNode");
  const transforms = nodes.filter((n) => n.type === "transformNode");
  const components = nodes.filter((n) => n.type === "componentNode");

  if (!transformOnly && sources.length === 0) {
    errors.push("Add a source node (extract).");
  }
  if (dests.length === 0) {
    errors.push(
      transformOnly
        ? "Add a warehouse node (default lake connection)."
        : "Add a destination node (load)."
    );
  }

  const { requireConnectorTypes, pipelineSourceType, pipelineDestinationType } = options;
  if (requireConnectorTypes) {
    if (!transformOnly && !String(pipelineSourceType ?? "").trim()) {
      errors.push("Choose a source type for this pipeline (inspector or node).");
    }
    if (!String(pipelineDestinationType ?? "").trim()) {
      errors.push("Choose a destination type for this pipeline (inspector or node).");
    }
  }

  for (const n of transforms) {
    const tool = String((n.data as Record<string, unknown> | undefined)?.transformTool ?? "").trim();
    if (!tool) {
      errors.push('Each transform node must choose an approach (not "Not set").');
      break;
    }
  }

  const filtered = filterCanvasEdges(nodes, edges);
  if (edges.length > 0 && filtered.length < edges.length) {
    errors.push(
      transformOnly
        ? "Remove invalid edges. Allowed: warehouse → transform/component chain, transform → transform, and component ports."
        : "Remove invalid edges. Allowed: source → load, load → transform, transform → transform, and component template ports (see component catalog)."
    );
  }

  if (transformOnly && dests.length > 0) {
    if (components.length === 0 && transforms.length === 0 && filtered.length === 0) {
      // Empty canvas with warehouse anchor only — ok until user adds steps via starter/Genie.
    } else if (filtered.length > 0) {
      assertReachableFromRoots(
        nodes,
        filtered,
        dests,
        "Every step must be reachable from the warehouse node (connect the transform chain).",
        errors
      );
    }
  } else if (sources.length > 0 && dests.length > 0) {
    if (filtered.length === 0 && components.length === 0) {
      errors.push("Connect source to destination (and any transform or component steps).");
    } else if (filtered.length > 0) {
      assertReachableFromRoots(
        nodes,
        filtered,
        sources,
        "Every node must be reachable from a source (connect the full pipeline).",
        errors
      );
    }
  }

  return { ok: errors.length === 0, errors };
}
