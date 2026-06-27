/**
 * dlt verified sources vendored into managed-worker-service/verified_sources/.
 * Keep in sync with scripts/vendor-verified-sources.py DEFAULT_SOURCES.
 */
export const VENDORED_VERIFIED_SOURCES = [
  "github",
  "stripe_analytics",
  "hubspot",
  "shopify_dlt",
  "pipedrive",
  "salesforce",
  "zendesk",
  "jira",
  "slack",
  "workable",
  "matomo",
  "asana_dlt",
  "google_analytics",
  "facebook_ads",
  "google_ads",
  "notion",
  "airtable",
  "freshdesk",
  "personio",
  "strapi",
  "inbox",
  "mux",
  "bing_webmaster",
  "google_sheets",
] as const;

export type VendoredVerifiedSource = (typeof VENDORED_VERIFIED_SOURCES)[number];

export function isVendoredVerifiedSource(slug: string): boolean {
  const key = slug.toLowerCase().trim();
  const aliased = key === "shopify" ? "shopify_dlt" : key === "stripe" ? "stripe_analytics" : key === "asana" ? "asana_dlt" : key;
  return (VENDORED_VERIFIED_SOURCES as readonly string[]).includes(aliased);
}
