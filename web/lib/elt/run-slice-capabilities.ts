/**
 * Per-source slice capability registry.
 *
 * Parity with Dagster's dlt and sling integrations:
 * - dlt:   context.partition_key is passed into the dlt source function.
 *          The source decides how to use it (since=, start_date=, prefix=, etc.)
 *          See: https://docs.dagster.io/integrations/libraries/dlt/dlt-pythonic#using-partitions-in-your-dlt-assets
 * - sling: partitions_def on @sling_assets; partition_key maps to update_key /
 *          primary_key ranges in the replication YAML.
 *          See: https://docs.dagster.io/integrations/libraries/sling/dagster-sling
 *
 * Every source supports partitioning. The difference is only HOW the partition
 * key is wired -- that detail is documented per source below.
 */

export type RunSliceCapabilityMode = "date_and_key" | "none_only";

export type RunSliceCapability = {
  mode: RunSliceCapabilityMode;
  /** Short badge label. */
  label: string;
  /** User-facing explanation shown in the builder and run-slices page. */
  detail: string;
  /** The exact parameter / mechanism used in generated code. */
  mechanism: string;
};

// ── dlt SaaS sources ──────────────────────────────────────────────────────────
// Pattern: partition_key passed as start_date / since / updated_after into
// the dlt verified source. Same as context.partition_key in Dagster dlt assets.

const DLT_SINCE: RunSliceCapability = {
  mode: "date_and_key",
  label: "Date slice via since / start_date",
  detail: "partition_key is passed as a start_date or since parameter into the dlt source, " +
    "matching the Dagster dlt pattern (context.partition_key -> source function arg).",
  mechanism: "source(start_date=partition_key)",
};

const DLT_DATE_RANGE: RunSliceCapability = {
  mode: "date_and_key",
  label: "Date slice via date range",
  detail: "partition_key sets the start of a date range passed into the dlt source. " +
    "Matches the Dagster dlt pattern: context.partition_key -> source function arg.",
  mechanism: "source(start_date=partition_key, end_date=next_day)",
};

const DLT_PREFIX: RunSliceCapability = {
  mode: "date_and_key",
  label: "Date & key slice via path prefix",
  detail: "partition_key is used as a path prefix filter (e.g. events/2024-01-01/ or tenant=acme/). " +
    "Matches Hive-style partitioned storage layouts.",
  mechanism: "filesystem(bucket_url=f'{base}/{partition_key}/')",
};

const DLT_QUERY: RunSliceCapability = {
  mode: "date_and_key",
  label: "Date & key slice via query param",
  detail: "partition_key is injected as a query parameter on the REST endpoint " +
    "(rename 'since' to match your API: from, start_date, cursor, date, etc.). " +
    "Matches the Dagster dlt pattern: context.partition_key -> source function arg.",
  mechanism: "endpoint params['since'] = partition_key",
};

// ── sling database sources ─────────────────────────────────────────────────────
// Pattern: update_key + primary_key in replication YAML; partition_key maps to
// the incremental range. Same as partitions_def on @sling_assets in Dagster.

const SLING_INCREMENTAL: RunSliceCapability = {
  mode: "date_and_key",
  label: "Date & key slice via update_key",
  detail: "Sling uses update_key (the timestamp/id column) and primary_key for incremental mode. " +
    "partition_key maps to the incremental range -- matching Dagster's sling_assets partitions_def pattern.",
  mechanism: "stream update_key: {col}, mode: incremental",
};

// ── Per-source registry ───────────────────────────────────────────────────────

const CAPABILITIES: Record<string, RunSliceCapability> = {
  // dlt verified sources -- all accept start_date / since
  github:           { ...DLT_SINCE,   mechanism: "github_reactions(since=partition_key)" },
  stripe:           { ...DLT_SINCE,   mechanism: "stripe_source(start_date=partition_key)" },
  shopify:          { ...DLT_SINCE,   mechanism: "shopify_source(start_date=partition_key)" },
  hubspot:          { ...DLT_SINCE,   mechanism: "hubspot_source(start_date=partition_key)" },
  salesforce:       { ...DLT_SINCE,   mechanism: "salesforce_source(start_date=partition_key)" },
  google_analytics: { ...DLT_DATE_RANGE, mechanism: "google_analytics(start_date=partition_key)" },
  facebook_ads:     { ...DLT_DATE_RANGE, mechanism: "facebook_ads_source(start_date=partition_key)" },
  google_ads:       { ...DLT_DATE_RANGE, mechanism: "google_ads(start_date=partition_key)" },
  slack:            { ...DLT_SINCE,   mechanism: "slack_source(start_date=partition_key)" },
  notion:           { ...DLT_SINCE,   mechanism: "notion_source(start_date=partition_key)" },
  airtable:         { ...DLT_SINCE,   mechanism: "airtable_source(start_date=partition_key)" },
  jira:             { ...DLT_SINCE,   mechanism: "jira_source(start_date=partition_key)" },
  zendesk:          { ...DLT_SINCE,   mechanism: "zendesk_support(start_date=partition_key)" },
  intercom:         { ...DLT_SINCE,   mechanism: "intercom_source(start_date=partition_key)" },
  mixpanel:         { ...DLT_DATE_RANGE, mechanism: "mixpanel_source(start_date=partition_key)" },
  segment:          { ...DLT_SINCE,   mechanism: "segment_source(start_date=partition_key)" },
  asana:            { ...DLT_SINCE,   mechanism: "asana_source(start_date=partition_key)" },

  // REST API -- partition_key as query param, rename to match the target API
  rest_api:         { ...DLT_QUERY },

  // Cloud storage -- partition_key as path prefix
  s3:               { ...DLT_PREFIX, mechanism: "filesystem(bucket_url=f's3://{bucket}/{partition_key}/')" },
  gcs:              { ...DLT_PREFIX, mechanism: "filesystem(bucket_url=f'gs://{bucket}/{partition_key}/')" },
  azure_blob:       { ...DLT_PREFIX, mechanism: "filesystem(bucket_url=f'az://{container}/{partition_key}/')" },
  csv:              { ...DLT_PREFIX, mechanism: "filesystem(file_glob=f'*{partition_key}*.csv')" },
  json:             { ...DLT_PREFIX, mechanism: "filesystem(file_glob=f'*{partition_key}*.json')" },
  parquet:          { ...DLT_PREFIX, mechanism: "filesystem(file_glob=f'*{partition_key}*')" },

  // Database sources -- sling incremental with update_key
  postgres:  { ...SLING_INCREMENTAL, mechanism: "update_key: updated_at, mode: incremental" },
  mysql:     { ...SLING_INCREMENTAL, mechanism: "update_key: updated_at, mode: incremental" },
  mssql:     { ...SLING_INCREMENTAL, mechanism: "update_key: updated_at, mode: incremental" },
  oracle:    { ...SLING_INCREMENTAL, mechanism: "update_key: updated_at, mode: incremental" },
  mongodb:   { ...SLING_INCREMENTAL, mechanism: "update_key: _id, mode: incremental" },
  duckdb:    { ...SLING_INCREMENTAL, mechanism: "update_key: updated_at, mode: incremental" },
  sqlite:    { ...SLING_INCREMENTAL, mechanism: "update_key: updated_at, mode: incremental" },
};

export function getRunSliceCapability(sourceType: string): RunSliceCapability {
  const s = sourceType.toLowerCase().trim();
  return CAPABILITIES[s] ?? {
    mode: "date_and_key",
    label: "Date & key slices supported",
    detail: "partition_key is passed into the pipeline run function. Wire it into your source " +
      "filter to enable incremental backfills -- same pattern as Dagster context.partition_key.",
    mechanism: "run(partition_key=partition_key)",
  };
}

export function runSlicesAllowed(sourceType: string): boolean {
  return getRunSliceCapability(sourceType).mode === "date_and_key";
}
