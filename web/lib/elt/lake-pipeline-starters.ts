/**
 * Agnostic single-lake (and light multi-source) pipeline starters — wire transforms after ingest.
 */
import type { Edge, Node } from "@xyflow/react";
import type { AiPipelineComponentInput } from "@/lib/elt/ai-pipeline-canvas-build";
import { buildPipelineCanvasFromComponents } from "@/lib/elt/ai-pipeline-canvas-build";
import type { CanvasGraphEditAction } from "@/lib/elt/canvas-graph-edit";
import type { PipelineCanvasGraph } from "@/lib/elt/canvas-source-config";

export type LakePipelineStarter = {
  id: string;
  title: string;
  description: string;
  triggers: string[];
  /** 1 = one ingested table; 2+ = union/join patterns */
  sourceCount: number | "many";
  components: (input: LakeStarterContext) => AiPipelineComponentInput[];
  graphEdits?: CanvasGraphEditAction[];
};

export type LakeStarterContext = {
  /** Primary loaded table (schema.table) */
  source_table: string;
  /** Optional second source for join/union starters */
  second_table?: string;
  /** Optional dimension / reference table */
  dimension_table?: string;
  /** Prefix for layered outputs, e.g. silver / gold */
  layer_prefix?: string;
  join_key?: string;
  id_column?: string;
};

export type LakeStarterBuildResult = {
  starter_id: string;
  title: string;
  source_table: string;
  components: AiPipelineComponentInput[];
  graph_edits: CanvasGraphEditAction[];
  messages: string[];
};

function layerTable(ctx: LakeStarterContext, layer: string, suffix?: string): string {
  const base = ctx.layer_prefix?.trim() || "marts";
  const src = ctx.source_table.includes(".")
    ? ctx.source_table.split(".").pop()!
    : ctx.source_table;
  const name = suffix ? `${src}_${suffix}` : `${src}_${layer}`;
  return `${base}.${name}`;
}

export const LAKE_PIPELINE_STARTERS: LakePipelineStarter[] = [
  {
    id: "single_lake_medallion",
    title: "Single source → medallion layers",
    description: "Clean, dedupe, and roll up one ingested table into a gold mart on the same lake.",
    triggers: [
      "single lake",
      "one source",
      "medallion",
      "bronze silver gold",
      "lakehouse layers",
      "one ingested table",
    ],
    sourceCount: 1,
    components: (ctx) => [
      {
        component_id: "data_cleansing",
        label: "Silver cleanse",
        config: {
          table: ctx.source_table,
          drop_null_rows: true,
          output_table: layerTable(ctx, "silver", "cleansed"),
        },
      },
      {
        component_id: "drop_duplicates",
        label: "Silver dedupe",
        config: {
          table: layerTable(ctx, "silver", "cleansed"),
          subset: [ctx.id_column ?? "id"],
          output_table: layerTable(ctx, "silver", "deduped"),
        },
      },
      {
        component_id: "group_aggregate",
        label: "Gold rollup",
        config: {
          table: layerTable(ctx, "silver", "deduped"),
          group_by: ["date"],
          aggregations: '{"amount":"sum","id":"count"}',
          output_table: layerTable(ctx, "gold", "metrics"),
        },
      },
    ],
    graphEdits: [
      { op: "connect", source: "dest", target: "cleanse" },
      { op: "connect", source: "cleanse", target: "dedupe" },
      { op: "connect", source: "dedupe", target: "rollup" },
    ],
  },
  {
    id: "single_source_to_mart",
    title: "Single source → curated mart",
    description: "Project columns, filter valid rows, aggregate to a mart table — great first pipeline.",
    triggers: [
      "source to mart",
      "curated mart",
      "build a mart",
      "transform one table",
      "fun pipeline",
      "quick transform",
    ],
    sourceCount: 1,
    components: (ctx) => [
      {
        component_id: "select_columns",
        label: "Project fields",
        config: {
          table: ctx.source_table,
          columns: ["id", "created_at", "amount", "status"],
          output_table: layerTable(ctx, "silver", "projected"),
        },
      },
      {
        component_id: "filter_rows",
        label: "Valid rows",
        config: {
          table: layerTable(ctx, "silver", "projected"),
          condition: "status = 'active'",
          output_table: layerTable(ctx, "silver", "filtered"),
        },
      },
      {
        component_id: "group_aggregate",
        label: "Mart metrics",
        config: {
          table: layerTable(ctx, "silver", "filtered"),
          group_by: ["created_at"],
          aggregations: '{"amount":"sum","id":"count"}',
          output_table: layerTable(ctx, "gold", "daily"),
        },
      },
    ],
    graphEdits: [
      { op: "connect", source: "dest", target: "project" },
      { op: "connect", source: "project", target: "filter" },
      { op: "connect", source: "filter", target: "mart" },
    ],
  },
  {
    id: "single_source_enrich",
    title: "Enrich one fact with a dimension",
    description: "Left-join a dimension table after load, then run a quality gate.",
    triggers: ["enrich one source", "join dimension", "lookup after load", "star schema one fact"],
    sourceCount: 1,
    components: (ctx) => [
      {
        component_id: "join_tables",
        label: "Dimension enrich",
        config: {
          left_table: ctx.source_table,
          right_table: ctx.dimension_table ?? "dimensions.entity",
          how: "left",
          on: [ctx.join_key ?? "entity_id"],
          output_table: layerTable(ctx, "silver", "enriched"),
        },
      },
      {
        component_id: "dq_check",
        label: "Key DQ",
        config: {
          table: layerTable(ctx, "silver", "enriched"),
          not_null: [ctx.id_column ?? "id"],
        },
      },
    ],
    graphEdits: [
      { op: "connect", source: "dest", target: "enrich" },
      { op: "connect", source: "enrich", target: "dq" },
    ],
  },
  {
    id: "multi_source_union_rollup",
    title: "Union sources → combined mart",
    description: "Stack two ingested tables on one lake, dedupe, and aggregate.",
    triggers: ["union sources", "combine tables", "multiple ingests", "two sources one lake"],
    sourceCount: 2,
    components: (ctx) => [
      {
        component_id: "union_tables",
        label: "Union sources",
        config: {
          tables: [ctx.source_table, ctx.second_table ?? "staging.source_b"],
          output_table: layerTable(ctx, "silver", "unioned"),
        },
      },
      {
        component_id: "drop_duplicates",
        label: "Dedupe union",
        config: {
          table: layerTable(ctx, "silver", "unioned"),
          subset: [ctx.id_column ?? "id"],
          output_table: layerTable(ctx, "silver", "deduped"),
        },
      },
      {
        component_id: "group_aggregate",
        label: "Combined metrics",
        config: {
          table: layerTable(ctx, "silver", "deduped"),
          group_by: ["source_system", "date"],
          aggregations: '{"amount":"sum","id":"count"}',
          output_table: layerTable(ctx, "gold", "combined"),
        },
      },
    ],
    graphEdits: [
      { op: "connect", source: "dest", target: "union" },
      { op: "connect", source: "union", target: "dedupe" },
      { op: "connect", source: "dedupe", target: "rollup" },
    ],
  },
  {
    id: "entity_360_profile",
    title: "Entity 360 profile (agnostic CDP pattern)",
    description:
      "Join events to an entity dimension and roll up metrics — works for customers, accounts, devices, or any entity.",
    triggers: [
      "entity 360",
      "unified profile",
      "customer 360",
      "customer360",
      "cdp",
      "audience foundation",
    ],
    sourceCount: 1,
    components: (ctx) => [
      {
        component_id: "join_tables",
        label: "Enrich events",
        config: {
          left_table: ctx.source_table,
          right_table: ctx.dimension_table ?? "dimensions.entities",
          how: "left",
          on: [ctx.join_key ?? "entity_id"],
          output_table: layerTable(ctx, "silver", "enriched"),
        },
      },
      {
        component_id: "group_aggregate",
        label: "Entity metrics",
        config: {
          table: layerTable(ctx, "silver", "enriched"),
          group_by: [ctx.join_key ?? "entity_id"],
          aggregations: '{"amount":"sum","event_id":"count"}',
          output_table: layerTable(ctx, "gold", "entity_360"),
        },
      },
    ],
    graphEdits: [
      { op: "connect", source: "dest", target: "enrich" },
      { op: "connect", source: "enrich", target: "rollup" },
    ],
  },
];

export function matchLakeStarter(query: string): LakePipelineStarter | null {
  const q = query.toLowerCase();
  for (const s of LAKE_PIPELINE_STARTERS) {
    if (s.triggers.some((t) => q.includes(t))) return s;
    if (q.includes(s.id.replace(/_/g, " "))) return s;
  }
  return null;
}

export function listLakeStartersForPrompt(): string {
  return LAKE_PIPELINE_STARTERS.map(
    (s) =>
      `- **${s.id}** (${s.sourceCount} source${s.sourceCount === 1 ? "" : "s"}): ${s.title} — ${s.description}`
  ).join("\n");
}

export function buildLakePipeline(input: {
  starter_id: string;
  source_table: string;
  second_table?: string;
  dimension_table?: string;
  layer_prefix?: string;
  join_key?: string;
  id_column?: string;
}): LakeStarterBuildResult {
  const starter = LAKE_PIPELINE_STARTERS.find((s) => s.id === input.starter_id);
  const sourceTable = String(input.source_table ?? "").trim();
  if (!starter) {
    return {
      starter_id: input.starter_id,
      title: "",
      source_table: sourceTable,
      components: [],
      graph_edits: [],
      messages: [`Unknown lake starter: ${input.starter_id}`],
    };
  }
  if (!sourceTable) {
    return {
      starter_id: starter.id,
      title: starter.title,
      source_table: "",
      components: [],
      graph_edits: [],
      messages: ["source_table is required (loaded warehouse table, e.g. staging.events)"],
    };
  }

  const ctx: LakeStarterContext = {
    source_table: sourceTable,
    second_table: input.second_table,
    dimension_table: input.dimension_table,
    layer_prefix: input.layer_prefix ?? "marts",
    join_key: input.join_key,
    id_column: input.id_column,
  };

  const components = starter.components(ctx).map((c) => ({
    ...c,
    config: {
      ...(c.config ?? {}),
      execution: (c.config as Record<string, unknown> | undefined)?.execution ?? "warehouse",
      template_id: c.component_id,
    },
  }));
  return {
    starter_id: starter.id,
    title: starter.title,
    source_table: sourceTable,
    components,
    graph_edits: starter.graphEdits ?? [],
    messages: [
      `${starter.title}: ${components.length} transform step(s) wired after load on ${sourceTable}.`,
      "All steps use warehouse SQL push-down by default (execution=warehouse).",
    ],
  };
}

/** Build a React Flow graph from a lake starter (for canvas UI). */
export function lakeStarterCanvasGraph(input: {
  starter_id: string;
  source_table: string;
  second_table?: string;
  dimension_table?: string;
  layer_prefix?: string;
  join_key?: string;
  id_column?: string;
  existingCanvas?: PipelineCanvasGraph | null;
}): LakeStarterBuildResult & { nodes: Node[]; edges: Edge[] } {
  const built = buildLakePipeline(input);
  if (!built.components.length) {
    return { ...built, nodes: [], edges: [] };
  }
  const { nodes, edges } = buildPipelineCanvasFromComponents({
    components: built.components,
    existingCanvas: input.existingCanvas ?? null,
  });
  return { ...built, nodes, edges };
}
