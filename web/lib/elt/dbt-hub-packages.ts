/** Curated dbt Hub staging packages — shared by API, /dbt hub, and package picker. */

export function dbtHubPackageDisplayName(packageId: string): string {
  return packageId.replace(/^dlt-hub\//, "");
}

export type DbtHubPackage = {
  sourceKey: string;
  sourceSlugs: string[];
  package: string;
  version: string;
  description: string;
  models: string[];
  docsUrl: string;
};

export const DBT_HUB_PACKAGES: DbtHubPackage[] = [
  {
    sourceKey: "stripe",
    sourceSlugs: ["stripe", "stripe_analytics"],
    package: "dlt-hub/stripe_source",
    version: ">=0.1.0",
    description: "Staging models for Stripe customers, charges, and subscriptions.",
    models: ["stg_stripe__customers", "stg_stripe__charges"],
    docsUrl: "https://hub.getdbt.com/dlt-hub/stripe_source",
  },
  {
    sourceKey: "github",
    sourceSlugs: ["github"],
    package: "dlt-hub/github_source",
    version: ">=0.1.0",
    description: "Staging models for GitHub issues, PRs, and reactions.",
    models: ["stg_github__issues", "stg_github__pull_requests"],
    docsUrl: "https://hub.getdbt.com/dlt-hub/github_source",
  },
  {
    sourceKey: "hubspot",
    sourceSlugs: ["hubspot"],
    package: "dlt-hub/hubspot_source",
    version: ">=0.1.0",
    description: "Staging models for HubSpot contacts, companies, and deals.",
    models: ["stg_hubspot__contacts", "stg_hubspot__deals"],
    docsUrl: "https://hub.getdbt.com/dlt-hub/hubspot_source",
  },
  {
    sourceKey: "salesforce",
    sourceSlugs: ["salesforce"],
    package: "dlt-hub/salesforce_source",
    version: ">=0.1.0",
    description: "Staging models for Salesforce accounts and opportunities.",
    models: ["stg_salesforce__accounts", "stg_salesforce__opportunities"],
    docsUrl: "https://hub.getdbt.com/dlt-hub/salesforce_source",
  },
  {
    sourceKey: "shopify",
    sourceSlugs: ["shopify", "shopify_dlt"],
    package: "dlt-hub/shopify_source",
    version: ">=0.1.0",
    description: "Staging models for Shopify orders and products.",
    models: ["stg_shopify__orders", "stg_shopify__products"],
    docsUrl: "https://hub.getdbt.com/dlt-hub/shopify_source",
  },
  {
    sourceKey: "google_ads",
    sourceSlugs: ["google_ads"],
    package: "dlt-hub/google_ads_source",
    version: ">=0.1.0",
    description: "Staging models for Google Ads campaigns and performance.",
    models: ["stg_google_ads__campaigns"],
    docsUrl: "https://hub.getdbt.com/dlt-hub/google_ads_source",
  },
  {
    sourceKey: "google_analytics",
    sourceSlugs: ["google_analytics"],
    package: "dlt-hub/google_analytics_source",
    version: ">=0.1.0",
    description: "Staging models for GA4 events and properties.",
    models: ["stg_ga__events"],
    docsUrl: "https://hub.getdbt.com/dlt-hub/google_analytics_source",
  },
  {
    sourceKey: "facebook_ads",
    sourceSlugs: ["facebook_ads"],
    package: "dlt-hub/facebook_ads_source",
    version: ">=0.1.0",
    description: "Staging models for Meta/Facebook Ads campaigns.",
    models: ["stg_facebook_ads__campaigns"],
    docsUrl: "https://hub.getdbt.com/dlt-hub/facebook_ads_source",
  },
];

const BY_SOURCE_KEY = Object.fromEntries(DBT_HUB_PACKAGES.map((p) => [p.sourceKey, p]));

function normalizeSourceLookup(raw: string): string {
  return raw.toLowerCase().replace(/-/g, "_").replace(/_analytics$/, "").replace(/_dlt$/, "");
}

export function resolveDbtHubPackage(sourceSlug: string): DbtHubPackage | null {
  const norm = normalizeSourceLookup(sourceSlug);
  for (const pkg of DBT_HUB_PACKAGES) {
    if (pkg.sourceKey === norm) return pkg;
    if (pkg.sourceSlugs.some((s) => normalizeSourceLookup(s) === norm)) return pkg;
  }
  return null;
}

export function listDbtHubPackages(sourceSlug?: string | null): DbtHubPackage[] {
  if (!sourceSlug?.trim()) return DBT_HUB_PACKAGES;
  const match = resolveDbtHubPackage(sourceSlug);
  return match ? [match] : [];
}

export function dbtHubPackageByKey(key: string): DbtHubPackage | undefined {
  return BY_SOURCE_KEY[key];
}
