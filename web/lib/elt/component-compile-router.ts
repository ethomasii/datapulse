/**
 * Routes dagster-component-templates categories to eltPulse compile targets.
 * Templates are discovery + config UX — execution stays dlt/sling/dbt/monitors/Python.
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
    hint: "Compile to dlt filesystem/S3 source → workspace destination",
  },
  sqs_to_database_asset: { target: "dlt", badge: "native", hint: "dlt REST/queue ingest pattern" },
  kafka_to_database_asset: { target: "dlt", badge: "native", hint: "dlt or custom Python queue consumer" },
  sql_to_database_asset: { target: "sling", badge: "native", hint: "Sling database replication" },
  rest_api_fetcher: { target: "dlt", badge: "native", hint: "dlt rest_api source" },
  csv_file_ingestion: { target: "dlt", badge: "native", hint: "dlt filesystem source" },
  s3_monitor: {
    target: "monitor",
    badge: "native",
    hint: "EltMonitor S3 prefix — triggers paired ingestion pipeline on new objects",
  },
  sqs_monitor: { target: "monitor", badge: "native", hint: "EltMonitor SQS depth / message age" },
  kafka_monitor: { target: "monitor", badge: "native", hint: "EltMonitor Kafka lag" },
  great_expectations_check: {
    target: "quality",
    badge: "native",
    hint: "Maps to declarative quality block + data contracts",
  },
  soda_check: { target: "quality", badge: "native", hint: "Quality step in pipeline spec" },
  dq_check: { target: "quality", badge: "native", hint: "Simple SQL/not_null checks" },
  freshness_check: { target: "quality", badge: "native", hint: "Asset freshness SLA + observability alert" },
  dbt_docs_enriched_project: { target: "dbt", badge: "native", hint: "Link DbtProject + catalog enrichment" },
  filter_rows: { target: "python", badge: "python", hint: "Post-load Python transform step on worker" },
  join_tables: { target: "python", badge: "python", hint: "Pandas transform — Python component step" },
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
  gcs_to_database_asset: { target: "dlt", badge: "native", hint: "GCS filesystem → warehouse" },
  summarize: { target: "python", badge: "native", hint: "Group by + aggregations" },
  melt: { target: "python", badge: "native", hint: "Alias for unpivot" },
  hl7_v2_parser: { target: "python", badge: "native", hint: "HL7 v2 segment parser (healthcare)" },
  fix_message_parser: { target: "python", badge: "native", hint: "FIX trading message parser" },
  email_parser: { target: "python", badge: "native", hint: "RFC 2822 email field extraction" },
  regex_parser: { target: "python", badge: "native", hint: "Regex extract/match/replace/split" },
  html_parser: { target: "python", badge: "native", hint: "HTML strip/extract (beautifulsoup4)" },
  group_aggregate: { target: "python", badge: "native", hint: "Group by + aggregations" },
  litellm_inference_asset: { target: "dagster", badge: "dagster", hint: "Requires Dagster runtime or custom Python" },
  terraform_asset: { target: "dagster", badge: "dagster", hint: "Infrastructure — optional Dagster executor" },
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
  ingestion: { target: "dlt", badge: "native", hint: "Prefer dlt/Sling codegen over reimplementing ingest" },
  source: { target: "dlt", badge: "native", hint: "dlt source connector" },
  sink: { target: "dlt", badge: "native", hint: "dlt destination write" },
  check: { target: "quality", badge: "native", hint: "Declarative quality + contracts" },
  sensor: { target: "monitor", badge: "native", hint: "EltMonitor YAML" },
  observation: { target: "monitor", badge: "native", hint: "Freshness / health monitor" },
  dbt: { target: "dbt", badge: "native", hint: "DbtProject or in-pipeline dlt_dbt" },
  external: { target: "catalog_external", badge: "native", hint: "Catalog external asset" },
  transformation: { target: "python", badge: "python", hint: "Python post-transform on managed worker" },
  analytics: { target: "python", badge: "python", hint: "Python analytics step (pandas/sklearn)" },
  ai: { target: "python", badge: "python", hint: "Python LLM enrichment step" },
  infrastructure: { target: "dagster", badge: "dagster", hint: "Dagster or manual ops" },
  integration: { target: "dagster", badge: "dagster", hint: "Platform integration — Dagster optional" },
  resource: { target: "skip", hint: "Connection profile — use eltPulse Connections" },
};

export function routeComponent(componentId: string, category: string): ComponentRoute {
  const explicit = TOP_COMPONENT_ROUTES[componentId];
  if (explicit) return explicit;

  const cat = category.trim().toLowerCase();
  if (CATEGORY_DEFAULTS[cat]) return CATEGORY_DEFAULTS[cat];

  return { target: "dagster", badge: "dagster", hint: "No native compiler — use Dagster or Python step" };
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
