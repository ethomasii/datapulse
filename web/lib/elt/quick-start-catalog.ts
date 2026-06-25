/** Quick start picker options — shared with marketing scenario deep links. */

import { ALL_DLT_SOURCES, getDltHubSource } from "@/lib/elt/dlt-hub-registry";
import {
  DESTINATION_CONNECTOR_OPTIONS,
  SOURCE_CONNECTOR_OPTIONS,
  SOURCE_CONNECTOR_SLUGS,
  DESTINATION_CONNECTOR_SLUGS,
  connectorLabel,
} from "@/lib/elt/connectors-registry";
import { pipelineSourceTypeFromCatalogSlug, saasDiscoverConnector } from "@/lib/elt/catalog-wizard-saas";

export type QuickStartOption = { slug: string; label: string; hint: string };

export const QUICK_START_DESTINATIONS: QuickStartOption[] = [
  { slug: "motherduck", label: "MotherDuck", hint: "Hosted DuckDB — easiest cloud warehouse" },
  { slug: "postgres", label: "PostgreSQL", hint: "Self-hosted or Neon" },
  { slug: "duckdb", label: "DuckDB", hint: "Object storage URI or managed internal file" },
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

const FEATURED_SOURCE_SLUGS = new Set(QUICK_START_SOURCES.map((s) => s.slug));

function registrySourceSlugs(): Set<string> {
  return new Set([
    ...SOURCE_CONNECTOR_SLUGS.map((s) => s.toLowerCase()),
    ...ALL_DLT_SOURCES.map((s) => s.slug.toLowerCase()),
    ...QUICK_START_SOURCES.map((s) => s.slug.toLowerCase()),
    ...Object.values(TO_QUICK_START).map((s) => s.toLowerCase()),
    ...Object.keys(TO_QUICK_START).map((s) => s.toLowerCase()),
  ]);
}

const ALL_VALID_SOURCE_SLUGS = registrySourceSlugs();

const ALL_VALID_DEST_SLUGS = new Set([
  ...DESTINATION_CONNECTOR_SLUGS.map((s) => s.toLowerCase()),
  ...QUICK_START_DESTINATIONS.map((d) => d.slug.toLowerCase()),
  ...Object.values(TO_QUICK_START).map((s) => s.toLowerCase()),
]);

export function normalizeQuickStartSource(slug: string): string {
  const key = slug.toLowerCase().trim();
  return TO_QUICK_START[key] ?? key;
}

export function normalizeQuickStartDestination(slug: string): string {
  const key = slug.toLowerCase().trim();
  return TO_QUICK_START[key] ?? key;
}

/** Pipeline sourceType for API save (handles stripe → stripe_analytics, etc.). */
export function quickStartPipelineSourceType(slug: string): string {
  return pipelineSourceTypeFromCatalogSlug(normalizeQuickStartSource(slug));
}

/** Connector slug passed to discover / connection test APIs. */
export function quickStartDiscoverConnector(slug: string): string {
  const pipelineType = quickStartPipelineSourceType(slug);
  const hub = getDltHubSource(pipelineType);
  if (hub) return saasDiscoverConnector(hub);
  return normalizeQuickStartSource(slug);
}

/** Saved connection `connector` field for quick-start inline credentials. */
export function quickStartConnectionConnector(slug: string): string {
  return normalizeQuickStartSource(slug);
}

export function isQuickStartSource(slug: string): boolean {
  const key = slug.toLowerCase().trim();
  const normalized = normalizeQuickStartSource(key);
  return ALL_VALID_SOURCE_SLUGS.has(key) || ALL_VALID_SOURCE_SLUGS.has(normalized);
}

export function isQuickStartDestination(slug: string): boolean {
  const key = slug.toLowerCase().trim();
  const normalized = normalizeQuickStartDestination(key);
  return ALL_VALID_DEST_SLUGS.has(key) || ALL_VALID_DEST_SLUGS.has(normalized);
}

/** Full searchable source list — featured picks first, then registry + dlt hub. */
export function allQuickStartSourceOptions(): QuickStartOption[] {
  const seen = new Set<string>();
  const out: QuickStartOption[] = [];

  function add(slug: string, label: string, hint: string) {
    const key = slug.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ slug: key, label, hint });
  }

  for (const s of QUICK_START_SOURCES) {
    add(s.slug, s.label, s.hint);
  }

  for (const s of ALL_DLT_SOURCES) {
    add(s.slug, s.name, s.description.length > 96 ? `${s.description.slice(0, 93)}…` : s.description);
  }

  for (const c of SOURCE_CONNECTOR_OPTIONS) {
    add(c.slug, c.label, c.category);
  }

  return out;
}

/** ConnectorCombobox options for all sources. */
export function allQuickStartSourceComboboxOptions(): {
  slug: string;
  label: string;
  category: string;
}[] {
  return allQuickStartSourceOptions().map((s) => {
    const hub = getDltHubSource(s.slug);
    const reg = SOURCE_CONNECTOR_OPTIONS.find((c) => c.slug === s.slug);
    return {
      slug: s.slug,
      label: s.label,
      category: hub?.category ?? reg?.category ?? "Other",
    };
  });
}

export function allQuickStartDestinationComboboxOptions(): {
  slug: string;
  label: string;
  category: string;
}[] {
  const seen = new Set<string>();
  const out: { slug: string; label: string; category: string }[] = [];
  for (const d of QUICK_START_DESTINATIONS) {
    if (seen.has(d.slug)) continue;
    seen.add(d.slug);
    out.push({ slug: d.slug, label: d.label, category: "Popular" });
  }
  for (const c of DESTINATION_CONNECTOR_OPTIONS) {
    if (seen.has(c.slug)) continue;
    seen.add(c.slug);
    out.push({ slug: c.slug, label: c.label, category: c.category });
  }
  return out;
}

export function isFeaturedQuickStartSource(slug: string): boolean {
  return FEATURED_SOURCE_SLUGS.has(normalizeQuickStartSource(slug));
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
