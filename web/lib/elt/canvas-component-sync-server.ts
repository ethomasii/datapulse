import "server-only";

import type { EltPipeline } from "@prisma/client";
import type { Edge, Node } from "@xyflow/react";
import YAML from "yaml";
import { DECLARATIVE_PIPELINE_SPEC_VERSION } from "@/lib/elt/declarative-pipeline-spec";
import { isPipelineCanvasGraph, type PipelineCanvasGraph } from "@/lib/elt/canvas-source-config";
import { eltPipelineToDeclarativeSpec } from "@/lib/elt/pipeline-spec-export";
import { extractComponentsFromCanvas } from "@/lib/elt/canvas-component-sync";

/** Merge canvas component extraction into sourceConfiguration + rebuild v2 YAML. */
export async function syncCanvasToPipelineSpec(
  pipeline: EltPipeline,
  sourceConfiguration: Record<string, unknown>
): Promise<{ sourceConfiguration: Record<string, unknown>; declarativeSpecYaml: string }> {
  const canvasRaw = sourceConfiguration.canvas;
  const next = { ...sourceConfiguration };

  if (!isPipelineCanvasGraph(canvasRaw)) {
    const yaml = pipeline.declarativeSpecYaml?.trim()
      ? pipeline.declarativeSpecYaml.trimEnd() + "\n"
      : YAML.stringify(
          {
            eltpulse_pipeline: DECLARATIVE_PIPELINE_SPEC_VERSION,
            upsert: true,
            ...(await eltPipelineToDeclarativeSpec(pipeline)),
          },
          { lineWidth: 0 }
        ).trimEnd() + "\n";
    return { sourceConfiguration: next, declarativeSpecYaml: yaml };
  }

  const canvas = canvasRaw as PipelineCanvasGraph;
  const nodes = canvas.nodes as Node[];
  const edges = canvas.edges as Edge[];
  const extracted = extractComponentsFromCanvas(nodes, edges, { pipelineName: pipeline.name });

  if (extracted.components.length) {
    next.elt_components = extracted.components;
  }

  if (extracted.quality.length) {
    const existing = Array.isArray(next.elt_quality) ? [...(next.elt_quality as unknown[])] : [];
    next.elt_quality = [...existing, ...extracted.quality];
  }

  if (extracted.sensorMonitors.length) {
    next.elt_canvas_sensors = extracted.sensorMonitors.map((s) => ({
      component_id: s.componentId,
      monitor_type: s.monitorType,
      label: s.label,
      config: s.config,
    }));
  }

  const spec = await eltPipelineToDeclarativeSpec({
    ...pipeline,
    sourceConfiguration: next,
  } as EltPipeline);

  if (extracted.components.length) spec.components = extracted.components;
  if (extracted.quality.length) {
    spec.quality = [...(spec.quality ?? []), ...extracted.quality];
  }

  const doc = {
    eltpulse_pipeline: DECLARATIVE_PIPELINE_SPEC_VERSION,
    upsert: true,
    ...spec,
  };

  return {
    sourceConfiguration: next,
    declarativeSpecYaml: YAML.stringify(doc, { lineWidth: 0 }).trimEnd() + "\n",
  };
}
