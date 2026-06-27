/**
 * Per-source slice capability registry for generated dlt / Sling pipelines.
 * Describes how `partition_key` (slice value) is passed into sources — used in UI copy only.
 */

import { getDltHubSource } from "./dlt-hub-registry";
import { hasVerifiedSliceWiring, resolveVerifiedSourceSpec } from "./verified-source-spec";
import { getIncrementalEnvConfig } from "./verified-incremental-env";

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
    "The slice value is passed as a start_date or since parameter into the connector so each run pulls a bounded window.",
  mechanism: "source(start_date=partition_key)",
};

const DLT_DATE_RANGE: RunSliceCapability = {
  mode: "date_and_key",
  label: "Date slice via date range",
  detail:
    "The slice value sets the start of a date range passed into the connector so incremental loads align with that window.",
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
    "Database replication uses update_key (timestamp/id column) and primary_key for incremental mode; the slice value scopes the incremental range for that run.",
  mechanism: "stream update_key: {col}, mode: incremental",
};

/** Verified sources with replace disposition and no partition wiring in codegen. */
const FULL_REPLACE: RunSliceCapability = {
  mode: "none_only",
  label: "Full replace load only",
  detail:
    "This source loads with replace disposition and has no date or slice filter parameter in generated code.",
  mechanism: "full replace — partition_key ignored",
};

/** Verified sources where partition_key is not wired yet (incremental upstream may exist). */
const SLICE_NOT_WIRED: RunSliceCapability = {
  mode: "none_only",
  label: "No slice filter wired",
  detail:
    "The verified source does not expose start_date / since for run slices in codegen yet; partition_key is ignored.",
  mechanism: "partition_key ignored in generated pipeline",
};

// ── Per-source registry ───────────────────────────────────────────────────────

const CAPABILITIES: Record<string, RunSliceCapability> = {
  github: {
    ...DLT_SINCE,
    mechanism: "github_reactions(since=partition_key, until=next_day for YYYY-MM-DD slices)",
  },
  stripe: { ...DLT_SINCE, mechanism: "stripe_source(start_date=partition_key)" },
  shopify: { ...DLT_SINCE, mechanism: "shopify_source(start_date=partition_key)" },
  pipedrive: {
    ...DLT_SINCE,
    mechanism: "pipedrive_source(since_timestamp=partition_key)",
  },
  hubspot: {
    ...DLT_SINCE,
    mechanism: "hubspot(since=partition_key, until=next_day) via CRM search API",
  },
  salesforce: {
    ...DLT_SINCE,
    mechanism: "salesforce incremental env bounds on merge resources (account, opportunity, …)",
  },
  google_analytics: { ...DLT_DATE_RANGE, mechanism: "google_analytics(start_date=partition_key)" },
  matomo: {
    ...DLT_SINCE,
    mechanism: "matomo_visits visits.serverTimestamp incremental env bounds",
  },
  facebook_ads: {
    ...DLT_SINCE,
    mechanism: "facebook_insights_source date_start incremental env bounds",
  },
  google_ads: { ...DLT_DATE_RANGE, mechanism: "google_ads(start_date=partition_key)" },
  slack: { ...DLT_SINCE, mechanism: "slack_source(start_date=partition_key)" },
  notion: {
    ...DLT_SINCE,
    mechanism: "notion_databases(since=partition_key, until=next_day) filters last_edited_time",
  },
  airtable: {
    ...DLT_SINCE,
    mechanism: "airtable_source(since/until) via LAST_MODIFIED_TIME() formula filter",
  },
  jira: { ...DLT_SINCE, mechanism: "jira_search JQL updated range for day slices" },
  zendesk: { ...DLT_SINCE, mechanism: "zendesk_support(start_date=partition_key)" },
  intercom: {
    ...DLT_SINCE,
    mechanism: "rest_api incremental on updated_at; partition_key sets initial_value / end_value",
  },
  mixpanel: {
    ...DLT_DATE_RANGE,
    mechanism: "Mixpanel export API from_date / to_date (YYYY-MM-DD day slices)",
  },
  segment: {
    mode: "none_only",
    label: "Config catalog sync",
    detail:
      "Segment Config API loads sources and destinations (full replace). Event history is not available via the write key — use a warehouse destination for event slices.",
    mechanism: "rest_api Config API — no date filter",
  },
  asana: {
    ...DLT_SINCE,
    mechanism: "asana tasks modified_at incremental bounds via partition_key",
  },
  workable: {
    ...DLT_SINCE,
    mechanism: "workable_source(start_date=partition_key)",
  },

  google_sheets: {
    ...FULL_REPLACE,
    detail:
      "Google Sheets loads named ranges with replace disposition; the API has no date filter for run slices.",
    mechanism: "google_sheets_source() — no partition_key filter",
  },
  freshdesk: {
    ...DLT_SINCE,
    mechanism: "freshdesk_source(since/until) scopes updated_at incremental per endpoint",
  },
  bing_webmaster: {
    ...FULL_REPLACE,
    detail:
      "Bing Webmaster loads site stats with replace disposition; no slice date parameter in verified codegen.",
    mechanism: "bing_webmaster_source() — no partition_key filter",
  },
  inbox: {
    ...FULL_REPLACE,
    detail: "IMAP inbox sync loads messages by mailbox; run slices do not apply to email ingestion.",
    mechanism: "inbox_source() — no partition_key filter",
  },
  mux: {
    ...FULL_REPLACE,
    detail: "Mux video analytics loads with replace disposition; no date slice parameter in codegen.",
    mechanism: "mux_source() — no partition_key filter",
  },

  rest_api: { ...DLT_QUERY },

  s3: { ...DLT_PREFIX, mechanism: "filesystem(bucket_url=f's3://{bucket}/{partition_key}/')" },
  gcs: { ...DLT_PREFIX, mechanism: "filesystem(bucket_url=f'gs://{bucket}/{partition_key}/')" },
  azure_blob: { ...DLT_PREFIX, mechanism: "filesystem(bucket_url=f'az://{container}/{partition_key}/')" },
  csv: { ...DLT_PREFIX, mechanism: "filesystem(file_glob=f'*{partition_key}*.csv')" },
  json: { ...DLT_PREFIX, mechanism: "filesystem(file_glob=f'*{partition_key}*.json')" },
  parquet: { ...DLT_PREFIX, mechanism: "filesystem(file_glob=f'*{partition_key}*')" },

  iceberg: {
    ...DLT_PREFIX,
    label: "Date slice via row filter",
    detail:
      "PyIceberg scan with optional slice_column row filter when partition_key is set. Omit slice_column for full table scans.",
    mechanism: "pyiceberg scan(row_filter=f'{slice_column} >= partition_key')",
  },

  postgres: {
    ...SLING_INCREMENTAL,
    label: "Date & key slice via update_key",
    detail:
      "Sling replication uses update_key from saved partition config. dlt sql_database runs honor partition_key via incremental env bounds when partition column is saved.",
    mechanism: "Sling: update_key; dlt: SOURCES__SQL_DATABASE__{table}__{column}__*",
  },
  mysql: { ...SLING_INCREMENTAL, mechanism: "update_key: updated_at, mode: incremental" },
  mssql: { ...SLING_INCREMENTAL, mechanism: "update_key: updated_at, mode: incremental" },
  oracle: { ...SLING_INCREMENTAL, mechanism: "update_key: updated_at, mode: incremental" },
  mongodb: { ...SLING_INCREMENTAL, mechanism: "update_key: _id, mode: incremental" },
  duckdb: { ...SLING_INCREMENTAL, mechanism: "update_key: updated_at, mode: incremental" },
  sqlite: { ...SLING_INCREMENTAL, mechanism: "update_key: updated_at, mode: incremental" },
};

function inferVerifiedSliceCapability(slug: string): RunSliceCapability | null {
  const spec = resolveVerifiedSourceSpec(slug);
  if (!spec) return null;

  if (hasVerifiedSliceWiring(spec, slug)) {
    if (spec.partitionSliceMode === "dlt_incremental_env" || getIncrementalEnvConfig(slug)) {
      const envCfg = getIncrementalEnvConfig(slug);
      const resources = envCfg?.resources.map((r) => r.name).join(", ") ?? "resources";
      return {
        ...DLT_SINCE,
        mechanism: `dlt incremental env bounds on ${resources} (${envCfg?.dltSourceName ?? slug})`,
      };
    }
    if (spec.partitionSliceMode === "jira_jql") {
      return { ...DLT_SINCE, mechanism: "jira_search JQL updated range for day slices" };
    }
    const start = spec.partitionKwarg ?? "start_date";
    const end = spec.partitionEndKwarg ? `, ${spec.partitionEndKwarg}=next_day` : "";
    return {
      ...(spec.partitionEndKwarg ? DLT_DATE_RANGE : DLT_SINCE),
      mechanism: `${spec.factory}(${start}=partition_key${end})`,
    };
  }

  const hub = getDltHubSource(slug);
  if (hub && !hub.incremental) {
    return {
      ...FULL_REPLACE,
      detail: `${hub.name} loads with replace disposition; no date slice parameter in codegen.`,
      mechanism: `${spec.factory}() — no partition_key filter`,
    };
  }

  return {
    ...SLICE_NOT_WIRED,
    mechanism: `${spec.factory}() — partition_key ignored`,
  };
}

export function getRunSliceCapability(sourceType: string): RunSliceCapability {
  const s = sourceType.toLowerCase().trim();
  const explicit = CAPABILITIES[s];
  if (explicit) return explicit;

  const inferred = inferVerifiedSliceCapability(s);
  if (inferred) return inferred;

  return {
    mode: "none_only",
    label: "No slice filter wired",
    detail:
      "This source has no verified slice wiring in codegen; partition_key is ignored unless you use REST API advanced mode.",
    mechanism: "partition_key ignored",
  };
}

export function runSlicesAllowed(sourceType: string): boolean {
  return getRunSliceCapability(sourceType).mode === "date_and_key";
}
