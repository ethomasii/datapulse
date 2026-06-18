/**
 * Curated pipeline recipes for AI — high bang-for-buck component chains.
 */
import type { AiPipelineComponentInput } from "@/lib/elt/ai-pipeline-canvas-build";
import type { CanvasGraphEditAction } from "@/lib/elt/canvas-graph-edit";

export type AiPipelinePlaybook = {
  id: string;
  title: string;
  description: string;
  /** Natural-language triggers */
  triggers: string[];
  components: AiPipelineComponentInput[];
  /** Optional canvas wiring after components are placed */
  graphEdits?: CanvasGraphEditAction[];
};

export const AI_PIPELINE_PLAYBOOKS: AiPipelinePlaybook[] = [
  {
    id: "saas_ingest_dq",
    title: "SaaS → warehouse with DQ",
    description: "Load API data, filter active rows, not-null check on id.",
    triggers: ["saas", "api ingest", "quality check", "filter active"],
    components: [
      { component_id: "filter_rows", label: "Active only", config: { condition: "status == 'active'" } },
      { component_id: "dq_check", label: "DQ id", config: { not_null: ["id"] } },
    ],
    graphEdits: [
      { op: "connect", source: "dest", target: "filter" },
      { op: "connect", source: "filter", target: "dq" },
    ],
  },
  {
    id: "enrich_join",
    title: "Enrich with dimension join",
    description: "Join fact to dimension after load, write enriched table.",
    triggers: ["join customers", "enrich", "lookup dimension", "star schema"],
    components: [
      {
        component_id: "join_tables",
        label: "Enrich join",
        config: { how: "left", on: ["customer_id"] },
      },
    ],
    graphEdits: [{ op: "connect", source: "dest", target: "join" }],
  },
  {
    id: "aggregate_metrics",
    title: "Aggregate metrics",
    description: "Group by day + sum amounts after load.",
    triggers: ["aggregate", "group by", "daily metrics", "rollup"],
    components: [
      {
        component_id: "group_aggregate",
        label: "Daily rollup",
        config: { group_by: ["date"], aggregations: '{"amount":"sum","id":"count"}' },
      },
    ],
    graphEdits: [{ op: "connect", source: "dest", target: "group" }],
  },
  {
    id: "clean_and_parse",
    title: "Clean + parse dates",
    description: "Trim strings, parse date columns, dedupe.",
    triggers: ["clean data", "parse dates", "dedupe", "data cleansing"],
    components: [
      { component_id: "data_cleansing", label: "Clean strings", config: { drop_null_rows: true } },
      { component_id: "datetime_parser", label: "Parse dates", config: { columns: ["created_at"] } },
      { component_id: "drop_duplicates", label: "Dedupe", config: { subset: ["id"] } },
    ],
    graphEdits: [
      { op: "connect", source: "dest", target: "clean" },
      { op: "connect", source: "clean", target: "parse" },
      { op: "connect", source: "parse", target: "dedupe" },
    ],
  },
  {
    id: "file_sensor_ingest",
    title: "S3 sensor + file ingest",
    description: "Monitor S3 prefix and ingest files to warehouse.",
    triggers: ["s3 file", "file drop", "bucket sensor", "csv landing"],
    components: [
      { component_id: "s3_monitor", label: "S3 sensor", config: { prefix: "s3://your-bucket/incoming/" } },
      { component_id: "s3_to_database_asset", label: "S3 ingest", config: { file_glob: "**/*.csv" } },
    ],
  },
  {
    id: "dbt_after_load",
    title: "dbt after load",
    description: "Add dbt transform node after warehouse load.",
    triggers: ["dbt after load", "staging models", "el+t"],
    components: [],
    graphEdits: [
      {
        op: "add_transform",
        tool: "dbt",
        label: "dbt staging",
        after: "dest",
        package_path: "./dbt",
        selector: "staging.*",
      },
    ],
  },
  {
    id: "anti_join_exceptions",
    title: "Find orphan rows",
    description: "Anti-join to find rows missing from reference table.",
    triggers: ["orphan", "missing reference", "anti join", "exceptions"],
    components: [
      {
        component_id: "anti_join",
        label: "Orphans",
        config: { on: ["id"] },
      },
    ],
    graphEdits: [{ op: "connect", source: "dest", target: "orphan" }],
  },
];

export function matchPlaybook(query: string): AiPipelinePlaybook | null {
  const q = query.toLowerCase();
  for (const pb of AI_PIPELINE_PLAYBOOKS) {
    if (pb.triggers.some((t) => q.includes(t))) return pb;
    if (q.includes(pb.id.replace(/_/g, " "))) return pb;
  }
  return null;
}

export function listPlaybooksForPrompt(): string {
  return AI_PIPELINE_PLAYBOOKS.map(
    (p) => `- **${p.id}**: ${p.title} — ${p.description} (components: ${p.components.map((c) => c.component_id).join(", ") || "graph only"})`
  ).join("\n");
}

/** Native components prioritized for AI search hints. */
export const AI_NATIVE_COMPONENT_IDS = [
  "filter_rows",
  "join_tables",
  "lookup",
  "group_aggregate",
  "select_columns",
  "drop_duplicates",
  "data_cleansing",
  "datetime_parser",
  "pivot",
  "anti_join",
  "cross_join",
  "sql_transform",
  "dq_check",
  "freshness_check",
  "s3_monitor",
  "s3_to_database_asset",
  "rest_api_fetcher",
] as const;
