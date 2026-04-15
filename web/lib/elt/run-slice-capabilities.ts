/**
 * Per-source slice capability registry for generated dlt / Sling pipelines.
 * Describes how `partition_key` (slice value) is passed into sources — used in UI copy only.
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
// Pattern: partition_key passed as start_date / since / updated_after into the dlt source.

const DLT_SINCE: RunSliceCapability = {
  mode: "date_and_key",
  label: "Date slice via since / start_date",
  detail:
    "The slice value is passed as a start_date or since parameter into the dlt source so each run pulls a bounded window.",
  mechanism: "source(start_date=partition_key)",
};

const DLT_DATE_RANGE: RunSliceCapability = {
  mode: "date_and_key",
  label: "Date slice via date range",
  detail:
    "The slice value sets the start of a date range passed into the dlt source so incremental loads align with that window.",
  mechanism: "source(start_date=partition_key, end_date=next_day)",
};

const DLT_PREFIX: RunSliceCapability = {
  mode: "date_and_key",
  label: "Date & key slice via path prefix",
  detail:
    "The slice value is used as a path prefix filter (e.g. events/2024-01-01/ or tenant=acme/) for Hive-style layouts.",
  mechanism: "filesystem(bucket_url=f'{base}/{partition_key}/')",
};

const DLT_QUERY: RunSliceCapability = {
  mode: "date_and_key",
  label: "Date & key slice via query param",
  detail:
    "The slice value is injected as a query parameter on the REST endpoint (rename since to from, start_date, cursor, etc. to match your API).",
  mechanism: "endpoint params['since'] = partition_key",
};

// ── sling database sources ─────────────────────────────────────────────────────
// Pattern: update_key + primary_key in replication YAML; partition_key maps to the incremental range.

const SLING_INCREMENTAL: RunSliceCapability = {
  mode: "date_and_key",
  label: "Date & key slice via update_key",
  detail:
    "Sling uses update_key (timestamp/id column) and primary_key for incremental mode; the slice value scopes the incremental range for that run.",
  mechanism: "stream update_key: {col}, mode: incremental",
};

// ── Per-source registry ───────────────────────────────────────────────────────

const CAPABILITIES: Record<string, RunSliceCapability> = {
  github: { ...DLT_SINCE, mechanism: "github_reactions(since=partition_key)" },
  stripe: { ...DLT_SINCE, mechanism: "stripe_source(start_date=partition_key)" },
  shopify: { ...DLT_SINCE, mechanism: "shopify_source(start_date=partition_key)" },
  hubspot: { ...DLT_SINCE, mechanism: "hubspot_source(start_date=partition_key)" },
  salesforce: { ...DLT_SINCE, mechanism: "salesforce_source(start_date=partition_key)" },
  google_analytics: { ...DLT_DATE_RANGE, mechanism: "google_analytics(start_date=partition_key)" },
  facebook_ads: { ...DLT_DATE_RANGE, mechanism: "facebook_ads_source(start_date=partition_key)" },
  google_ads: { ...DLT_DATE_RANGE, mechanism: "google_ads(start_date=partition_key)" },
  slack: { ...DLT_SINCE, mechanism: "slack_source(start_date=partition_key)" },
  notion: { ...DLT_SINCE, mechanism: "notion_source(start_date=partition_key)" },
  airtable: { ...DLT_SINCE, mechanism: "airtable_source(start_date=partition_key)" },
  jira: { ...DLT_SINCE, mechanism: "jira_source(start_date=partition_key)" },
  zendesk: { ...DLT_SINCE, mechanism: "zendesk_support(start_date=partition_key)" },
  intercom: { ...DLT_SINCE, mechanism: "intercom_source(start_date=partition_key)" },
  mixpanel: { ...DLT_DATE_RANGE, mechanism: "mixpanel_source(start_date=partition_key)" },
  segment: { ...DLT_SINCE, mechanism: "segment_source(start_date=partition_key)" },
  asana: { ...DLT_SINCE, mechanism: "asana_source(start_date=partition_key)" },

  rest_api: { ...DLT_QUERY },

  s3: { ...DLT_PREFIX, mechanism: "filesystem(bucket_url=f's3://{bucket}/{partition_key}/')" },
  gcs: { ...DLT_PREFIX, mechanism: "filesystem(bucket_url=f'gs://{bucket}/{partition_key}/')" },
  azure_blob: { ...DLT_PREFIX, mechanism: "filesystem(bucket_url=f'az://{container}/{partition_key}/')" },
  csv: { ...DLT_PREFIX, mechanism: "filesystem(file_glob=f'*{partition_key}*.csv')" },
  json: { ...DLT_PREFIX, mechanism: "filesystem(file_glob=f'*{partition_key}*.json')" },
  parquet: { ...DLT_PREFIX, mechanism: "filesystem(file_glob=f'*{partition_key}*')" },

  postgres: { ...SLING_INCREMENTAL, mechanism: "update_key: updated_at, mode: incremental" },
  mysql: { ...SLING_INCREMENTAL, mechanism: "update_key: updated_at, mode: incremental" },
  mssql: { ...SLING_INCREMENTAL, mechanism: "update_key: updated_at, mode: incremental" },
  oracle: { ...SLING_INCREMENTAL, mechanism: "update_key: updated_at, mode: incremental" },
  mongodb: { ...SLING_INCREMENTAL, mechanism: "update_key: _id, mode: incremental" },
  duckdb: { ...SLING_INCREMENTAL, mechanism: "update_key: updated_at, mode: incremental" },
  sqlite: { ...SLING_INCREMENTAL, mechanism: "update_key: updated_at, mode: incremental" },
};

export function getRunSliceCapability(sourceType: string): RunSliceCapability {
  const s = sourceType.toLowerCase().trim();
  return (
    CAPABILITIES[s] ?? {
      mode: "date_and_key",
      label: "Date & key slices supported",
      detail:
        "The slice value is passed into the generated run entrypoint; wire it into your source filter for incremental backfills.",
      mechanism: "run(partition_key=partition_key)",
    }
  );
}

export function runSlicesAllowed(sourceType: string): boolean {
  return getRunSliceCapability(sourceType).mode === "date_and_key";
}
