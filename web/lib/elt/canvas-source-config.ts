/** React Flow diagram stored inside pipeline `sourceConfiguration` (same DB row as form fields). */
export const PIPELINE_CANVAS_KEY = "canvas";

export type PipelineCanvasGraph = {
  nodes: unknown[];
  edges: unknown[];
  /** Schema version for future migrations */
  v?: number;
};

export function isPipelineCanvasGraph(v: unknown): v is PipelineCanvasGraph {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.nodes) && Array.isArray(o.edges);
}

export function getCanvasFromSourceConfig(
  cfg: Record<string, unknown> | null | undefined
): PipelineCanvasGraph | null {
  if (!cfg) return null;
  const raw = cfg[PIPELINE_CANVAS_KEY];
  return isPipelineCanvasGraph(raw) ? raw : null;
}

/** Remove canvas from config for codegen / exported YAML (layout omitted from generated runner config). */
export function stripCanvasFromSourceConfig(
  cfg: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!cfg) return {};
  const { [PIPELINE_CANVAS_KEY]: _removed, ...rest } = cfg;
  return rest;
}
