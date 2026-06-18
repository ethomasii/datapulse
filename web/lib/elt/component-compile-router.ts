/**
 * Routes pipeline component catalog categories to eltPulse compile targets.
 * Templates are discovery + config UX — execution stays ingest/replicate/transform/monitors/Python.
 */

import { companionIngestionForSensor, companionSensorForIngestion } from "@/lib/elt/component-sensor-pairs";

export type ComponentCompileTarget =
  | "dlt"
  | "sling"
  | "quality"
  | "monitor"
  | "dbt"
  | "python"
  | "dagster"
  | "catalog_external"
  | "skip";

export type ComponentRoute = {
  target: ComponentCompileTarget;
  badge?: "dagster" | "python" | "native";
  hint: string;
};

/** Top templates with explicit eltPulse routing (curated from manifest). */
export const TOP_COMPONENT_ROUTES: Record<string, ComponentRoute> = {
  s3_to_database_asset: {
    target: "dlt",
    badge: "native",
    hint: "Filesystem or object storage ingest → workspace destination",
  },
  sqs_to_database_asset: { target: "dlt", badge: "native", hint: "Queue ingest pattern" },
  kafka_to_database_asset: { target: "dlt", badge: "native", hint: "Streaming queue consumer ingest" },
  sql_to_database_asset: { target: "sling", badge: "native", hint: "Database replication between systems" },
  rest_api_fetcher: { target: "dlt", badge: "native", hint: "REST API source ingest" },
  csv_file_ingestion: { target: "dlt", badge: "native", hint: "File-based ingest from storage" },
  s3_monitor: {
    target: "monitor",
    badge: "native",
    hint: "Object storage prefix monitor — triggers paired ingestion pipeline on new objects",
  },
  sqs_monitor: { target: "monitor", badge: "native", hint: "Queue depth / message age monitor" },
  kafka_monitor: { target: "monitor", badge: "native", hint: "Streaming lag monitor" },
  great_expectations_check: {
    target: "quality",
    badge: "native",
    hint: "Declarative quality block + data contracts",
  },
  soda_check: { target: "quality", badge: "native", hint: "Quality step in pipeline spec" },
  dq_check: { target: "quality", badge: "native", hint: "Simple SQL/not_null checks" },
  freshness_check: { target: "quality", badge: "native", hint: "Asset freshness SLA + observability alert" },
  dbt_docs_enriched_project: { target: "dbt", badge: "native", hint: "Linked transform project + catalog enrichment" },
  filter_rows: { target: "dbt", badge: "native", hint: "Warehouse SQL filter (CTAS) — dataframe optional" },
  join_tables: { target: "dbt", badge: "native", hint: "Warehouse SQL join — dataframe optional" },
  lookup: { target: "python", badge: "native", hint: "Left join lookup against reference table" },
  pivot: { target: "python", badge: "native", hint: "Pivot long → wide with pandas" },
  cross_join: { target: "python", badge: "native", hint: "Cartesian product of two tables" },
  anti_join: { target: "python", badge: "native", hint: "Rows in left not in right" },
  data_cleansing: { target: "python", badge: "native", hint: "Trim, lowercase, drop null rows" },
  datetime_parser: { target: "python", badge: "native", hint: "Parse string columns to datetime" },
  unpivot: { target: "python", badge: "native", hint: "Unpivot wide → long (melt)" },
  rank: { target: "python", badge: "native", hint: "Rank rows by column" },
  running_total: { target: "python", badge: "native", hint: "Cumulative sum per group" },
  semi_join: { target: "python", badge: "native", hint: "Rows in left with match in right" },
  gcs_to_database_asset: { target: "dlt", badge: "native", hint: "Cloud storage → warehouse ingest" },
  summarize: { target: "python", badge: "native", hint: "Group by + aggregations" },
  melt: { target: "python", badge: "native", hint: "Alias for unpivot" },
  hl7_v2_parser: { target: "python", badge: "native", hint: "HL7 v2 segment parser (healthcare)" },
  fix_message_parser: { target: "python", badge: "native", hint: "FIX trading message parser" },
  email_parser: { target: "python", badge: "native", hint: "RFC 2822 email field extraction" },
  regex_parser: { target: "python", badge: "native", hint: "Regex extract/match/replace/split" },
  html_parser: { target: "python", badge: "native", hint: "HTML strip/extract (beautifulsoup4)" },
  group_aggregate: { target: "dbt", badge: "native", hint: "Warehouse SQL group-by — dataframe optional" },
  litellm_inference_asset: { target: "dagster", badge: "dagster", hint: "Requires custom Python or external orchestration" },
  terraform_asset: { target: "dagster", badge: "dagster", hint: "Infrastructure — manual ops or custom step" },
  external_snowflake_table: {
    target: "catalog_external",
    badge: "native",
    hint: "Declare external catalog asset + warehouse introspect",
  },
  warehouse_schema_assets: {
    target: "catalog_external",
    badge: "native",
    hint: "Catalog sync from warehouse schema discovery",
  },
};

const CATEGORY_DEFAULTS: Record<string, ComponentRoute> = {
  ingestion: { target: "dlt", badge: "native", hint: "Prefer built-in ingest codegen over custom reimplementation" },
  source: { target: "dlt", badge: "native", hint: "Source connector ingest" },
  sink: { target: "dlt", badge: "native", hint: "Destination write step" },
  check: { target: "quality", badge: "native", hint: "Declarative quality + contracts" },
  sensor: { target: "monitor", badge: "native", hint: "EltMonitor trigger" },
  observation: { target: "monitor", badge: "native", hint: "Freshness / health monitor" },
  dbt: { target: "dbt", badge: "native", hint: "Linked transform project or in-pipeline SQL models" },
  external: { target: "catalog_external", badge: "native", hint: "Catalog external asset" },
  transformation: { target: "dbt", badge: "native", hint: "Warehouse SQL or dataframe transform after load" },
  analytics: { target: "python", badge: "python", hint: "Python analytics step (pandas/sklearn)" },
  ai: { target: "python", badge: "python", hint: "Python LLM enrichment step" },
  infrastructure: { target: "dagster", badge: "dagster", hint: "Platform ops — not runnable as a pipeline step" },
  integration: { target: "dagster", badge: "dagster", hint: "Platform integration — custom step or manual setup" },
  resource: { target: "skip", hint: "Connection profile — use eltPulse Connections" },
};

export function routeComponent(componentId: string, category: string): ComponentRoute {
  const explicit = TOP_COMPONENT_ROUTES[componentId];
  if (explicit) return explicit;

  const cat = category.trim().toLowerCase();
  if (CATEGORY_DEFAULTS[cat]) return CATEGORY_DEFAULTS[cat];

  return { target: "dagster", badge: "dagster", hint: "No native compiler — add a Python step or pick a native component" };
}

export function suggestMonitorPipelinePair(componentId: string): {
  monitorId: string;
  pipelineComponentId: string;
  label: string;
} | null {
  const asSensor = companionIngestionForSensor(componentId);
  if (asSensor) {
    return {
      monitorId: asSensor.sensorId,
      pipelineComponentId: asSensor.ingestionId,
      label: asSensor.label,
    };
  }
  const asIngest = companionSensorForIngestion(componentId);
  if (asIngest) {
    return {
      monitorId: asIngest.sensorId,
      pipelineComponentId: asIngest.ingestionId,
      label: asIngest.label,
    };
  }
  return null;
}
