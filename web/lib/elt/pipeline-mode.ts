/**
 * Transform-only warehouse pipelines — model in-warehouse tables without EL ingest.
 */
import type { Edge, Node } from "@xyflow/react";
import type { PipelineCanvasGraph } from "@/lib/elt/canvas-source-config";

export const ELT_PIPELINE_MODE_KEY = "elt_pipeline_mode";
export const TRANSFORM_ONLY_MODE = "transform_only";

export function isTransformOnlyPipeline(sourceConfiguration: unknown): boolean {
  if (!sourceConfiguration || typeof sourceConfiguration !== "object") return false;
  const mode = (sourceConfiguration as Record<string, unknown>)[ELT_PIPELINE_MODE_KEY];
  return String(mode ?? "").trim() === TRANSFORM_ONLY_MODE;
}

/** Initial canvas: warehouse anchor only (no extract/load ingest). */
export function transformOnlyCanvasGraph(options: { warehouseLabel: string }): PipelineCanvasGraph {
  const nodes: Node[] = [
    {
      id: "n_warehouse",
      type: "destNode",
      position: { x: 80, y: 120 },
      data: {
        hint: options.warehouseLabel,
        transformOnly: true,
      },
    },
  ];
  return { v: 1, nodes, edges: [] as Edge[] };
}

export function minimalTransformOnlySourceConfiguration(
  canvas?: PipelineCanvasGraph
): Record<string, unknown> {
  return {
    [ELT_PIPELINE_MODE_KEY]: TRANSFORM_ONLY_MODE,
    ...(canvas ? { canvas } : {}),
  };
}
