/**
 * Lakeflow-style sync: canvas component nodes → declarative spec + elt_components + monitor hints.
 */

import type { Edge, Node } from "@xyflow/react";
import YAML from "yaml";
import type { EltPipeline } from "@prisma/client";
import {
  DECLARATIVE_PIPELINE_SPEC_VERSION,
  type DeclarativePipelineSpec,
  type PipelineComponentSpec,
} from "@/lib/elt/declarative-pipeline-spec";
import { routeComponent, type ComponentCompileTarget } from "@/lib/elt/component-compile-router";
import { isValidComponentEdge } from "@/lib/elt/component-canvas-io";
import { getComponentById } from "@/lib/elt/component-registry";
import { enrichComponentListAssets } from "@/lib/elt/pipeline-asset-keys";
import { eltPipelineToDeclarativeSpec } from "@/lib/elt/pipeline-spec-export";
import { isPipelineCanvasGraph, type PipelineCanvasGraph } from "@/lib/elt/canvas-source-config";

export type CanvasComponentNodeData = {
  componentId?: string;
  label?: string;
  compileTarget?: ComponentCompileTarget;
  compileHint?: string;
  category?: string;
  config?: Record<string, unknown>;
};

export type ExtractedCanvasComponents = {
  components: PipelineComponentSpec[];
  quality: NonNullable<DeclarativePipelineSpec["quality"]>;
  sensorMonitors: Array<{
    componentId: string;
    monitorType: string;
    label: string;
    config: Record<string, unknown>;
    nodeId: string;
  }>;
};

/** Map dagster-component-templates sensor ids → eltPulse monitor types. */
export const SENSOR_COMPONENT_TO_MONITOR_TYPE: Record<string, string> = {
  s3_monitor: "s3_file_count",
  sqs_monitor: "sqs_message_count",
  gcs_monitor: "gcs_file_arrival",
  kafka_monitor: "kafka_message_count",
  adls_monitor: "adls_file_count",
  sql_monitor: "sql_watermark",
};

function componentSpecType(
  compileTarget: ComponentCompileTarget
): PipelineComponentSpec["type"] {
  if (compileTarget === "quality") return "quality";
  if (compileTarget === "dbt") return "dbt";
  if (compileTarget === "python") return "python";
  if (compileTarget === "monitor") return "custom";
  return "custom";
}

function topoComponentOrder(nodes: Node[], edges: Edge[]): Node[] {
  const components = nodes.filter((n) => n.type === "componentNode");
  if (components.length <= 1) return components;
  const ids = new Set(components.map((n) => n.id));
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) continue;
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }
  const indeg = new Map<string, number>();
  for (const id of Array.from(ids)) indeg.set(id, 0);
  for (const [, targets] of Array.from(adj.entries())) {
    for (const t of targets) indeg.set(t, (indeg.get(t) ?? 0) + 1);
  }
  const q = Array.from(ids).filter((id) => (indeg.get(id) ?? 0) === 0);
  const out: Node[] = [];
  while (q.length) {
    const id = q.shift()!;
    const node = components.find((n) => n.id === id);
    if (node) out.push(node);
    for (const t of adj.get(id) ?? []) {
      indeg.set(t, (indeg.get(t) ?? 0) - 1);
      if (indeg.get(t) === 0) q.push(t);
    }
  }
  for (const n of components) {
    if (!out.some((x) => x.id === n.id)) out.push(n);
  }
  return out;
}

/** Extract component templates from React Flow canvas nodes (Lakeflow Designer model). */
export function extractComponentsFromCanvas(
  nodes: Node[],
  edges: Edge[],
  opts?: { pipelineName?: string }
): ExtractedCanvasComponents {
  const ordered = topoComponentOrder(nodes, edges);
  const components: PipelineComponentSpec[] = [];
  const quality: NonNullable<DeclarativePipelineSpec["quality"]> = [];
  const sensorMonitors: ExtractedCanvasComponents["sensorMonitors"] = [];

  const idToSpecId = new Map<string, string>();

  for (const node of ordered) {
    const d = node.data as CanvasComponentNodeData;
    const componentId = String(d.componentId ?? "").trim();
    if (!componentId) continue;

    const catalog = getComponentById(componentId);
    const category = catalog?.category ?? d.category ?? "custom";
    const route = routeComponent(componentId, category);
    const compileTarget = d.compileTarget ?? route.target;
    const config: Record<string, unknown> = {
      ...(d.config ?? {}),
      template_id: componentId,
      compile_target: compileTarget,
    };
    const specId = String(d.label ?? componentId)
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/^[^a-zA-Z]/, "c_")
      .slice(0, 128);

    idToSpecId.set(node.id, specId);

    if (compileTarget === "monitor" || SENSOR_COMPONENT_TO_MONITOR_TYPE[componentId]) {
      const monitorType = SENSOR_COMPONENT_TO_MONITOR_TYPE[componentId] ?? "s3_file_count";
      sensorMonitors.push({
        componentId,
        monitorType,
        label: String(d.label ?? catalog?.name ?? componentId),
        config,
        nodeId: node.id,
      });
    }

    const after: string[] = [];
    for (const e of edges) {
      if (e.target !== node.id) continue;
      const srcSpec = idToSpecId.get(e.source);
      if (srcSpec) after.push(srcSpec);
    }

    const specType = componentSpecType(compileTarget);
    components.push({
      id: specId,
      type: specType,
      config,
      ...(after.length ? { after } : {}),
    });

    if (specType === "quality" && typeof config.table === "string" && config.table) {
      quality.push({
        table: config.table,
        ...(Array.isArray(config.not_null) ? { not_null: config.not_null.map(String) } : {}),
        ...(Array.isArray(config.unique) ? { unique: config.unique.map(String) } : {}),
      });
    }
  }

  const pipelineName = String(opts?.pipelineName ?? "pipeline").trim() || "pipeline";
  const enriched = enrichComponentListAssets(pipelineName, components);

  return { components: enriched, quality, sensorMonitors };
}

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
          { eltpulse_pipeline: DECLARATIVE_PIPELINE_SPEC_VERSION, upsert: true, ...(await eltPipelineToDeclarativeSpec(pipeline)) },
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

/** Whether an edge between two canvas nodes is allowed (includes component ports). */
export function isValidPipelineCanvasEdge(source: Node, target: Node): boolean {
  if (source.type === "componentNode" || target.type === "componentNode") {
    const srcCat =
      String((source.data as CanvasComponentNodeData)?.category ?? "") ||
      getComponentById(String((source.data as CanvasComponentNodeData)?.componentId ?? ""))?.category ||
      "transformation";
    const tgtCat =
      String((target.data as CanvasComponentNodeData)?.category ?? "") ||
      getComponentById(String((target.data as CanvasComponentNodeData)?.componentId ?? ""))?.category ||
      "transformation";

    if (source.type === "componentNode" && target.type === "componentNode") {
      return isValidComponentEdge(srcCat, tgtCat);
    }
    if (source.type === "sourceNode" && target.type === "componentNode") {
      return true;
    }
    if (source.type === "componentNode" && target.type === "destNode") {
      return true;
    }
    if (source.type === "destNode" && target.type === "componentNode") {
      return true;
    }
    if (source.type === "componentNode" && target.type === "transformNode") {
      return true;
    }
    if (source.type === "transformNode" && target.type === "componentNode") {
      return true;
    }
  }

  return filterLegacyPipelineEdge(source, target);
}

function filterLegacyPipelineEdge(source: Node, target: Node): boolean {
  if (source.type === "transformNode") return target.type === "transformNode";
  if (target.type === "transformNode") {
    return source.type === "destNode" || source.type === "transformNode";
  }
  return true;
}

export function filterCanvasEdges(nodes: Node[], edges: Edge[]): Edge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return edges.filter((e) => {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (!s || !t) return false;
    return isValidPipelineCanvasEdge(s, t);
  });
}
