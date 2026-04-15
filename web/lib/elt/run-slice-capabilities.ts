/**
 * Per-source slice capability registry.
 *
 * Every source is assessed individually: does the generated pipeline actually
 * wire partition_key into the load, or is it a placeholder? "date_and_key"
 * means the generated code honors the slice. "none_only" means it cannot
 * without significant custom code (genuinely rare).
 */

export type RunSliceCapabilityMode = "date_and_key" | "none_only";

export type RunSliceCapability = {
  mode: RunSliceCapabilityMode;
  /** Short badge label shown in the builder and run-slices list. */
  label: string;
  /** Longer explanation shown in the Run Slices page and builder detail. */
  detail: string;
  /** How partition_key is applied in the generated code. */
  mechanism: string;
};

// ── SaaS / API sources (dlt verified sources) ────────────────────────────────
// All have time-ordered data; dlt verified sources accept `start_date` / `since`
// or expose incremental state. partition_key is passed as the date filter.

const SAAS_DATE: RunSliceCapability = {
  mode: "date_and_key",
  label: "Date slices -- since filter",
  detail: "Generated pipeline passes partition_key as a start-date filter to the dlt verified source. " +
    "Use an ISO date (e.g. 2024-01-01) as your slice key for daily/weekly backfills.",
  mechanism: "partition_key passed as start_date / since to dlt verified source",
};

const CAPABILITIES: Record<string, RunSliceCapability> = {
  // ── GitHub ──────────────────────────────────────────────────────────────────
  github: {
    mode: "date_and_key",
    label: "Date slices -- since filter",
    detail: "partition_key is passed as 'since' to github_reactions, filtering issues, PRs, and " +
      "reactions to items updated on or after that date. Use ISO date e.g. 2024-01-01.",
    mechanism: "since=partition_key on github_reactions()",
  },

  // ── REST API ─────────────────────────────────────────────────────────────────
  rest_api: {
    mode: "date_and_key",
    label: "Date & key slices -- query param",
    detail: "partition_key is injected as a query parameter on the endpoint. The generated code uses " +
      "'since' by default -- rename it to match your API (from, start_date, cursor, date, etc.). " +
      "Works for both date backfills and key-based sharding (customer_id, region, tenant).",
    mechanism: "endpoint params['since'] = partition_key (rename to match your API)",
  },

  // ── Stripe ───────────────────────────────────────────────────────────────────
  stripe: {
    mode: "date_and_key",
    label: "Date slices -- created filter",
    detail: "Stripe API supports 'created[gte]' on all list endpoints. partition_key is passed as a " +
      "Unix timestamp or ISO date to filter events, charges, customers created on or after that date.",
    mechanism: "created[gte]=partition_key on Stripe list endpoints",
  },

  // ── Shopify ──────────────────────────────────────────────────────────────────
  shopify: {
    mode: "date_and_key",
    label: "Date slices -- updated_at filter",
    detail: "Shopify REST and GraphQL APIs support updated_at_min on orders, products, customers. " +
      "partition_key is passed as the updated_at_min date to fetch only records changed since that date.",
    mechanism: "updated_at_min=partition_key on Shopify endpoints",
  },

  // ── HubSpot ──────────────────────────────────────────────────────────────────
  hubspot: {
    mode: "date_and_key",
    label: "Date slices -- lastmodifieddate filter",
    detail: "HubSpot supports lastmodifieddate filters on contacts, companies, deals, and engagements. " +
      "partition_key is passed as the lower bound for lastmodifieddate.",
    mechanism: "lastmodifieddate >= partition_key via HubSpot filter API",
  },

  // ── Salesforce ───────────────────────────────────────────────────────────────
  salesforce: {
    mode: "date_and_key",
    label: "Date slices -- LastModifiedDate SOQL filter",
    detail: "Salesforce SOQL supports WHERE LastModifiedDate >= :date on all standard and custom objects. " +
      "partition_key is injected into the SOQL query for incremental loads.",
    mechanism: "WHERE LastModifiedDate >= partition_key in SOQL",
  },

  // ── Google Analytics ─────────────────────────────────────────────────────────
  google_analytics: {
    mode: "date_and_key",
    label: "Date slices -- date range",
    detail: "GA4 / UA Data API reports accept startDate and endDate. partition_key sets the startDate " +
      "so each slice loads exactly one day (or range) of session/event data.",
    mechanism: "startDate=partition_key on GA4 runReport()",
  },

  // ── Facebook Ads ─────────────────────────────────────────────────────────────
  facebook_ads: {
    mode: "date_and_key",
    label: "Date slices -- time range",
    detail: "Facebook Marketing API supports time_range on Insights endpoints. partition_key sets the " +
      "since date in the time_range parameter for daily ad performance backfills.",
    mechanism: "time_range['since']=partition_key on Insights API",
  },

  // ── Google Ads ───────────────────────────────────────────────────────────────
  google_ads: {
    mode: "date_and_key",
    label: "Date slices -- date range GAQL",
    detail: "Google Ads GAQL queries accept WHERE segments.date BETWEEN dates. partition_key is used " +
      "as the date boundary for daily campaign/ad performance slices.",
    mechanism: "segments.date = partition_key in GAQL WHERE clause",
  },

  // ── Slack ────────────────────────────────────────────────────────────────────
  slack: {
    mode: "date_and_key",
    label: "Date slices -- oldest/latest timestamps",
    detail: "Slack conversations.history accepts oldest and latest Unix timestamps. partition_key is " +
      "converted to a Unix timestamp and passed as 'oldest' to fetch messages from that point forward.",
    mechanism: "oldest=unix(partition_key) on conversations.history",
  },

  // ── Notion ───────────────────────────────────────────────────────────────────
  notion: {
    mode: "date_and_key",
    label: "Date slices -- last_edited_time filter",
    detail: "Notion database queries support filter by last_edited_time. partition_key is passed as " +
      "the on_or_after bound to fetch only pages/blocks edited since that date.",
    mechanism: "last_edited_time on_or_after partition_key in Notion query filter",
  },

  // ── Airtable ─────────────────────────────────────────────────────────────────
  airtable: {
    mode: "date_and_key",
    label: "Date slices -- filterByFormula",
    detail: "Airtable supports filterByFormula on list records. partition_key is injected as a " +
      "DATETIME_DIFF formula condition on your date field to fetch only records from that date forward.",
    mechanism: "filterByFormula with partition_key on Airtable list records",
  },

  // ── Jira ─────────────────────────────────────────────────────────────────────
  jira: {
    mode: "date_and_key",
    label: "Date & key slices -- JQL filter",
    detail: "Jira JQL supports updated >= date and project = key. partition_key works as either a " +
      "date (updated >= partition_key) or a project key for project-scoped backfills.",
    mechanism: "JQL: updated >= partition_key OR project = partition_key",
  },

  // ── Zendesk ──────────────────────────────────────────────────────────────────
  zendesk: {
    mode: "date_and_key",
    label: "Date slices -- start_time filter",
    detail: "Zendesk incremental export API uses start_time (Unix timestamp) on tickets, users, and " +
      "organizations. partition_key is converted to Unix time for incremental exports.",
    mechanism: "start_time=unix(partition_key) on Zendesk incremental exports",
  },

  // ── Intercom ─────────────────────────────────────────────────────────────────
  intercom: {
    mode: "date_and_key",
    label: "Date slices -- updated_at filter",
    detail: "Intercom search API supports updated_at comparisons on contacts, conversations, and " +
      "companies. partition_key is passed as the updated_at lower bound.",
    mechanism: "updated_at > unix(partition_key) on Intercom search",
  },

  // ── Mixpanel ─────────────────────────────────────────────────────────────────
  mixpanel: {
    mode: "date_and_key",
    label: "Date slices -- from/to date range",
    detail: "Mixpanel Export API and JQL both require from_date and to_date. partition_key sets the " +
      "from_date so each daily slice loads exactly one day of event data.",
    mechanism: "from_date=partition_key on Mixpanel Export API",
  },

  // ── Segment ──────────────────────────────────────────────────────────────────
  segment: {
    mode: "date_and_key",
    label: "Date slices -- start/end timestamp",
    detail: "Segment Public API supports start and end timestamps on event endpoints. partition_key " +
      "sets the start timestamp for per-day event backfills.",
    mechanism: "start=partition_key on Segment event endpoints",
  },

  // ── Asana ────────────────────────────────────────────────────────────────────
  asana: {
    mode: "date_and_key",
    label: "Date slices -- modified_since filter",
    detail: "Asana supports modified_since on tasks, projects, and portfolios. partition_key is passed " +
      "as modified_since to fetch only records changed since that date.",
    mechanism: "modified_since=partition_key on Asana resource endpoints",
  },

  // ── Cloud Storage (S3 / GCS / Azure Blob) ────────────────────────────────────
  // Partition by path prefix (date-partitioned layouts like /year=2024/month=01/day=01/)
  s3: {
    mode: "date_and_key",
    label: "Date & key slices -- path prefix",
    detail: "S3 sources support prefix filtering. partition_key is used as a path prefix component " +
      "(e.g. events/2024-01-01/ or tenant=acme/) so only matching objects are loaded per slice.",
    mechanism: "prefix=f'{base_prefix}{partition_key}/' on S3 list_objects",
  },
  gcs: {
    mode: "date_and_key",
    label: "Date & key slices -- path prefix",
    detail: "GCS sources support prefix filtering. partition_key is used as a path prefix component " +
      "(e.g. events/2024-01-01/ or tenant=acme/) so only matching blobs are loaded per slice.",
    mechanism: "prefix=f'{base_prefix}{partition_key}/' on GCS list_blobs",
  },
  azure_blob: {
    mode: "date_and_key",
    label: "Date & key slices -- path prefix",
    detail: "Azure Blob sources support prefix filtering. partition_key is used as a path prefix " +
      "component (e.g. events/2024-01-01/) so only matching blobs are loaded per slice.",
    mechanism: "name_starts_with=f'{base_prefix}{partition_key}/' on Azure list_blobs",
  },

  // ── File sources ─────────────────────────────────────────────────────────────
  csv: {
    mode: "date_and_key",
    label: "Key slices -- file path filter",
    detail: "CSV file sources can be sliced by file path pattern. partition_key filters which files " +
      "are loaded (e.g. sales_2024-01-01.csv). Works best with date-named or key-named file layouts.",
    mechanism: "glob pattern includes partition_key to select matching files",
  },
  json: {
    mode: "date_and_key",
    label: "Key slices -- file path filter",
    detail: "JSON file sources can be sliced by file path pattern. partition_key filters which files " +
      "are loaded (e.g. events_2024-01-01.json). Works best with date-named or key-named file layouts.",
    mechanism: "glob pattern includes partition_key to select matching files",
  },
  parquet: {
    mode: "date_and_key",
    label: "Key slices -- file path or partition filter",
    detail: "Parquet files often use Hive-style partitioning (date=2024-01-01/). partition_key is " +
      "used as a path filter to load only matching partition directories.",
    mechanism: "path filter or Hive partition predicate pushdown with partition_key",
  },

  // ── Database sources (sling) ─────────────────────────────────────────────────
  postgres: {
    mode: "date_and_key",
    label: "Date & key slices -- SQL WHERE clause",
    detail: "Sling replication supports SQL WHERE clauses via update_key and range filtering. " +
      "partition_key is injected as a WHERE condition (e.g. updated_at >= '2024-01-01' or " +
      "customer_id = 'acme') so only matching rows are replicated per slice.",
    mechanism: "WHERE {column} >= partition_key injected into Sling stream config",
  },
  mysql: {
    mode: "date_and_key",
    label: "Date & key slices -- SQL WHERE clause",
    detail: "Sling replication supports SQL WHERE clauses. partition_key is injected as a WHERE " +
      "condition on your chosen column for incremental or key-sharded loads.",
    mechanism: "WHERE {column} >= partition_key injected into Sling stream config",
  },
  mssql: {
    mode: "date_and_key",
    label: "Date & key slices -- SQL WHERE clause",
    detail: "Sling replication supports SQL WHERE clauses on SQL Server. partition_key is injected " +
      "as a WHERE condition for incremental date or key-based loads.",
    mechanism: "WHERE {column} >= partition_key injected into Sling stream config",
  },
  oracle: {
    mode: "date_and_key",
    label: "Date & key slices -- SQL WHERE clause",
    detail: "Sling replication supports SQL WHERE clauses on Oracle. partition_key is injected as a " +
      "WHERE condition for date or key partitioned incremental loads.",
    mechanism: "WHERE {column} >= partition_key injected into Sling stream config",
  },
  mongodb: {
    mode: "date_and_key",
    label: "Date & key slices -- query filter",
    detail: "MongoDB sources support query filters. partition_key is used as a match condition on " +
      "your chosen field (e.g. {updated_at: {$gte: ISODate(partition_key)}} or {tenant_id: partition_key}).",
    mechanism: "{ field: { $gte: partition_key } } injected as MongoDB query filter",
  },

  // ── Local / embedded databases (less common for production slicing) ──────────
  duckdb: {
    mode: "date_and_key",
    label: "Date & key slices -- SQL WHERE clause",
    detail: "DuckDB supports full SQL including WHERE clauses and date filtering. partition_key can " +
      "be used as a WHERE condition for local analytical workloads.",
    mechanism: "WHERE {column} >= partition_key in DuckDB SQL query",
  },
  sqlite: {
    mode: "date_and_key",
    label: "Date & key slices -- SQL WHERE clause",
    detail: "SQLite supports WHERE clause filtering. partition_key can be used as a date or key " +
      "filter condition, though SQLite is typically used for local/dev pipelines.",
    mechanism: "WHERE {column} >= partition_key in SQLite SQL query",
  },
};

export function getRunSliceCapability(sourceType: string): RunSliceCapability {
  const s = sourceType.toLowerCase().trim();
  return CAPABILITIES[s] ?? {
    mode: "date_and_key",
    label: "Date & key slices available",
    detail: "This source supports partition_key based slicing. The generated pipeline accepts a " +
      "partition_key argument -- wire it into your source filter to enable incremental backfills.",
    mechanism: "partition_key passed to run() -- wire into source filter",
  };
}

export function runSlicesAllowed(sourceType: string): boolean {
  return getRunSliceCapability(sourceType).mode === "date_and_key";
}
