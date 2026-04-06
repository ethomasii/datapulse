import type { Edge, Node } from "@xyflow/react";
import { PIPELINE_CANVAS_KEY } from "./canvas-source-config";

/**
 * Attach or preserve `canvas` on a config object (used by JSON editor and guided canvas save).
 */
export function attachCanvasToSourceConfiguration(
  base: Record<string, unknown>,
  loadedGraph: { nodes: Node[]; edges: Edge[] } | null,
  previousFull: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...base };
  delete next[PIPELINE_CANVAS_KEY];

  const hasLoadedGraph =
    loadedGraph !== null &&
    Array.isArray(loadedGraph.nodes) &&
    Array.isArray(loadedGraph.edges);

  let canvas: unknown = previousFull[PIPELINE_CANVAS_KEY];
  if (hasLoadedGraph) {
    canvas = { nodes: loadedGraph!.nodes, edges: loadedGraph!.edges, v: 1 };
  }

  if (canvas !== undefined && canvas !== null) {
    return { ...next, [PIPELINE_CANVAS_KEY]: canvas };
  }
  return { ...next };
}

/**
 * Parse editor JSON (connector fields, dlt_dbt, elt_*, etc.) and attach the current diagram `canvas`
 * from React Flow when available; otherwise keep `previousFull.canvas`.
 */
export function mergeEditorSourceConfiguration(
  editedJsonText: string,
  loadedGraph: { nodes: Node[]; edges: Edge[] } | null,
  previousFull: Record<string, unknown>
): Record<string, unknown> {
  let base: Record<string, unknown>;
  try {
    base = JSON.parse(editedJsonText.trim() || "{}") as Record<string, unknown>;
  } catch {
    throw new Error("Source configuration must be valid JSON");
  }
  return attachCanvasToSourceConfiguration(base, loadedGraph, previousFull);
}
