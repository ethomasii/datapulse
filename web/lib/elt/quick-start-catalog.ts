/** Quick start picker options — shared with marketing scenario deep links. */

export type QuickStartOption = { slug: string; label: string; hint: string };

export const QUICK_START_DESTINATIONS: QuickStartOption[] = [
  { slug: "duckdb", label: "DuckDB", hint: "Local file — great for trying eltPulse" },
  { slug: "postgres", label: "PostgreSQL", hint: "Self-hosted or Neon" },
  { slug: "snowflake", label: "Snowflake", hint: "Cloud warehouse" },
  { slug: "bigquery", label: "BigQuery", hint: "Google Cloud" },
  { slug: "redshift", label: "Redshift", hint: "AWS warehouse" },
];

export const QUICK_START_SOURCES: QuickStartOption[] = [
  { slug: "github", label: "GitHub", hint: "Issues, PRs, repos" },
  { slug: "stripe", label: "Stripe", hint: "Customers, charges, subscriptions" },
  { slug: "postgres", label: "PostgreSQL", hint: "Database replication" },
  { slug: "hubspot", label: "HubSpot", hint: "CRM contacts & deals" },
  { slug: "salesforce", label: "Salesforce", hint: "Enterprise CRM" },
  { slug: "shopify", label: "Shopify", hint: "Orders & inventory" },
  { slug: "zendesk", label: "Zendesk", hint: "Support tickets" },
  { slug: "google_ads", label: "Google Ads", hint: "Campaign performance" },
  { slug: "notion", label: "Notion", hint: "Databases & pages" },
  { slug: "s3", label: "Amazon S3", hint: "Files in object storage" },
  { slug: "mysql", label: "MySQL", hint: "App database replication" },
  { slug: "intercom", label: "Intercom", hint: "Users & conversations" },
  { slug: "rest_api", label: "REST API", hint: "Any HTTP JSON API" },
];

/** Map marketing / catalog slugs to quick-start internal slugs. */
const TO_QUICK_START: Record<string, string> = {
  stripe_analytics: "stripe",
  shopify_dlt: "shopify",
  postgresql: "postgres",
};

const QUICK_START_SLUGS = new Set([
  ...QUICK_START_SOURCES.map((s) => s.slug),
  ...QUICK_START_DESTINATIONS.map((d) => d.slug),
]);

export function normalizeQuickStartSource(slug: string): string {
  const key = slug.toLowerCase().trim();
  return TO_QUICK_START[key] ?? key;
}

export function normalizeQuickStartDestination(slug: string): string {
  const key = slug.toLowerCase().trim();
  return TO_QUICK_START[key] ?? key;
}

export function isQuickStartSource(slug: string): boolean {
  return QUICK_START_SLUGS.has(normalizeQuickStartSource(slug));
}

export function isQuickStartDestination(slug: string): boolean {
  return QUICK_START_SLUGS.has(normalizeQuickStartDestination(slug));
}

export function quickStartUrl(params: {
  source?: string;
  destination?: string;
  scenario?: string;
}): string {
  const q = new URLSearchParams();
  if (params.source) q.set("source", normalizeQuickStartSource(params.source));
  if (params.destination) q.set("destination", normalizeQuickStartDestination(params.destination));
  if (params.scenario) q.set("scenario", params.scenario);
  const s = q.toString();
  return s ? `/quick-start?${s}` : "/quick-start";
}
