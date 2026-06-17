/** Simple Icons slug per connector — https://simpleicons.org */
const ICON_SLUGS: Record<string, string> = {
  github: "github",
  stripe: "stripe",
  stripe_analytics: "stripe",
  shopify: "shopify",
  shopify_dlt: "shopify",
  hubspot: "hubspot",
  salesforce: "salesforce",
  postgres: "postgresql",
  postgresql: "postgresql",
  mysql: "mysql",
  snowflake: "snowflake",
  bigquery: "googlecloud",
  redshift: "amazonredshift",
  databricks: "databricks",
  duckdb: "duckdb",
  s3: "amazonaws",
  gcs: "googlecloud",
  azure_blob: "microsoftazure",
  notion: "notion",
  zendesk: "zendesk",
  intercom: "intercom",
  slack: "slack",
  jira: "jira",
  asana: "asana",
  airtable: "airtable",
  mixpanel: "mixpanel",
  segment: "segment",
  kafka: "apachekafka",
  mongodb: "mongodb",
  clickhouse: "clickhouse",
  mssql: "microsoftsqlserver",
  oracle: "oracle",
  sqlite: "sqlite",
  google_ads: "googleads",
  facebook_ads: "meta",
  google_analytics: "googleanalytics",
  rest_api: "openapiinitiative",
};

const BRAND_COLORS: Record<string, string> = {
  github: "181717",
  stripe: "635BFF",
  shopify: "7AB55C",
  hubspot: "FF7A59",
  salesforce: "00A1E0",
  postgresql: "4169E1",
  snowflake: "29B5E8",
  googlecloud: "4285F4",
  duckdb: "FFF000",
  amazonaws: "232F3E",
  notion: "000000",
  zendesk: "03363D",
  intercom: "6AFDEF",
  googleads: "4285F4",
  apachekafka: "231F20",
  databricks: "FF3621",
  amazonredshift: "8C4FFF",
};

export function getConnectorIconSlug(slug: string): string | null {
  const key = slug.toLowerCase();
  return ICON_SLUGS[key] ?? null;
}

export function getConnectorIconUrl(slug: string, size = 24): string | null {
  const icon = getConnectorIconSlug(slug);
  if (!icon) return null;
  const color = BRAND_COLORS[icon];
  const base = `https://cdn.simpleicons.org/${icon}`;
  if (color) return `${base}/${color}`;
  return base;
}

export function hasConnectorIcon(slug: string): boolean {
  return getConnectorIconSlug(slug) !== null;
}
