import type { Edge, Node } from "@xyflow/react";
import { filterEdgesToPipelineRules } from "@/components/pipeline-canvas/canvas-edge-defaults";

export type ValidatePipelineCanvasOptions = {
  /** When true, source/destination catalog types must be set (saved pipeline + inspector). */
  requireConnectorTypes?: boolean;
  pipelineSourceType?: string | null;
  pipelineDestinationType?: string | null;
};

export type PipelineCanvasValidationResult = {
  ok: boolean;
  errors: string[];
};

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
  const sources = nodes.filter((n) => n.type === "sourceNode");
  const dests = nodes.filter((n) => n.type === "destNode");
  const transforms = nodes.filter((n) => n.type === "transformNode");

  if (sources.length === 0) {
    errors.push("Add a source node (extract).");
  }
  if (dests.length === 0) {
    errors.push("Add a destination node (load).");
  }

  const { requireConnectorTypes, pipelineSourceType, pipelineDestinationType } = options;
  if (requireConnectorTypes) {
    if (!String(pipelineSourceType ?? "").trim()) {
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

  const filtered = filterEdgesToPipelineRules(nodes, edges);
  if (edges.length > 0 && filtered.length < edges.length) {
    errors.push(
      "Remove invalid edges. Allowed wiring: extract → load, load → transform, transform → transform only."
    );
  }

  if (sources.length > 0 && dests.length > 0) {
    if (filtered.length === 0) {
      errors.push("Connect source to destination (and any transform steps).");
    } else {
      const adj = new Map<string, string[]>();
      for (const e of filtered) {
        if (!adj.has(e.source)) adj.set(e.source, []);
        adj.get(e.source)!.push(e.target);
      }
      const visited = new Set<string>();
      const q: string[] = [];
      for (const s of sources) {
        visited.add(s.id);
        q.push(s.id);
      }
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
          errors.push("Every node must be reachable from a source (connect the full pipeline).");
          break;
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
