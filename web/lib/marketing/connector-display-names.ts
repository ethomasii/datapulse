/** Human-friendly labels for catalog slugs (marketing + nav). */
const DISPLAY_NAMES: Record<string, string> = {
  bigquery: "BigQuery",
  stripe_analytics: "Stripe",
  shopify_dlt: "Shopify",
  google_ads: "Google Ads",
  google_analytics: "Google Analytics",
  facebook_ads: "Meta Ads",
  azure_blob: "Azure Blob",
  postgresql: "PostgreSQL",
  motherduck: "MotherDuck",
  rest_api: "REST API",
};

export function connectorDisplayName(slug: string, fallback?: string): string {
  const key = slug.toLowerCase();
  if (DISPLAY_NAMES[key]) return DISPLAY_NAMES[key];
  if (fallback) return fallback;
  return slug
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
