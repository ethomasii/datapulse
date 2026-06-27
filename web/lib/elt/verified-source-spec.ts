/**
 * dlt verified-source package metadata for pipeline codegen + managed worker staging.
 * Module names match `dlt init <slug> duckdb` output folders.
 */

import type { SourceResourceNormalizer } from "./source-resource-mappings";
import {
  normalizeHubspotResources,
  normalizeJiraResources,
  normalizeSalesforceResources,
  normalizeShopifyResources,
  normalizeSlackResources,
  normalizeZendeskResources,
} from "./source-resource-mappings";

export type VerifiedCredentialSpec = {
  /** Factory kwarg name */
  param: string;
  /** Env vars to try (first non-empty wins) */
  envKeys: string[];
};

export type VerifiedCredentialStyle =
  | "flat"
  | "zendesk_token"
  | "salesforce_security_token"
  | "shopify"
  | "jira_api"
  | "slack"
  | "asana_secrets"
  | "workable";

export type VerifiedSourceSpec = {
  module: string;
  factory: string;
  credentials: VerifiedCredentialSpec[];
  credentialStyle?: VerifiedCredentialStyle;
  /** Config keys copied into factory kwargs when present */
  configKeys?: string[];
  /** Optional partition_key → factory kwarg for incremental runs */
  partitionKwarg?: string;
  /** Optional end bound kwarg for day slices (e.g. end_date). */
  partitionEndKwarg?: string;
  /** How partition_key is applied when the factory has no single start_date arg. */
  partitionSliceMode?: "jira_jql" | "asana_tasks" | "salesforce_incremental";
  /** Config key holding selected resource ids */
  resourceConfigKey?: string;
  alternateResourceConfigKeys?: string[];
  defaultResources?: string[];
  normalizeResources?: SourceResourceNormalizer;
};

/** Slugs handled by dedicated golden-path generators (not generic verified template). */
export const VERIFIED_GOLDEN_SLUGS = new Set(["github", "stripe", "stripe_analytics"]);

/** Core dlt sources — use rest_api / sql_database / generic generators instead. */
export const VERIFIED_SKIP_SLUGS = new Set([
  "rest_api",
  "sql_database",
  "postgresql",
  "postgres",
  "filesystem",
  "s3",
  "gcs",
  "azure_blob",
  "csv",
  "json",
  "parquet",
  "iceberg",
  "intercom",
  "mixpanel",
  "segment",
  "mongodb",
  "pg_replication",
  "kafka",
  "kinesis",
]);

/** Catalog slug → verified package folder (e.g. shopify → shopify_dlt). */
export const VERIFIED_SLUG_ALIASES: Record<string, string> = {
  shopify: "shopify_dlt",
  asana: "asana_dlt",
};

const SHOPIFY_SPEC: VerifiedSourceSpec = {
  module: "shopify_dlt",
  factory: "shopify_source",
  credentialStyle: "shopify",
  credentials: [{ param: "private_app_password", envKeys: ["SHOPIFY_PRIVATE_APP_PASSWORD", "SHOPIFY_ACCESS_TOKEN"] }],
  configKeys: ["store_url", "start_date"],
  partitionKwarg: "start_date",
  partitionEndKwarg: "end_date",
  resourceConfigKey: "resources",
  defaultResources: ["orders", "customers", "products"],
  normalizeResources: normalizeShopifyResources,
};

export const VERIFIED_SOURCE_SPECS: Record<string, VerifiedSourceSpec> = {
  shopify_dlt: SHOPIFY_SPEC,
  hubspot: {
    module: "hubspot",
    factory: "hubspot",
    credentials: [{ param: "api_key", envKeys: ["HUBSPOT_API_KEY", "HUBSPOT_ACCESS_TOKEN"] }],
    partitionKwarg: "since",
    partitionEndKwarg: "until",
    resourceConfigKey: "resources",
    defaultResources: ["contacts", "companies", "deals"],
    normalizeResources: normalizeHubspotResources,
  },
  salesforce: {
    module: "salesforce",
    factory: "salesforce_source",
    credentialStyle: "salesforce_security_token",
    partitionSliceMode: "salesforce_incremental",
    credentials: [
      { param: "user_name", envKeys: ["SALESFORCE_USER", "SALESFORCE_USERNAME"] },
      { param: "password", envKeys: ["SALESFORCE_PASSWORD"] },
      { param: "security_token", envKeys: ["SALESFORCE_SECURITY_TOKEN", "SALESFORCE_TOKEN"] },
    ],
    resourceConfigKey: "standard_objects",
    alternateResourceConfigKeys: ["resources"],
    defaultResources: ["account", "contact", "lead"],
    normalizeResources: normalizeSalesforceResources,
  },
  pipedrive: {
    module: "pipedrive",
    factory: "pipedrive_source",
    credentials: [{ param: "pipedrive_api_key", envKeys: ["PIPEDRIVE_API_KEY", "PIPEDRIVE_API_TOKEN"] }],
    partitionKwarg: "since_timestamp",
  },
  freshdesk: {
    module: "freshdesk",
    factory: "freshdesk_source",
    credentials: [
      { param: "api_secret_key", envKeys: ["FRESHDESK_API_KEY"] },
      { param: "domain", envKeys: ["FRESHDESK_DOMAIN"] },
    ],
    partitionKwarg: "since",
    partitionEndKwarg: "until",
    resourceConfigKey: "endpoints",
    defaultResources: ["tickets", "contacts", "agents", "companies"],
  },
  zendesk: {
    module: "zendesk",
    factory: "zendesk_support",
    credentialStyle: "zendesk_token",
    credentials: [
      { param: "subdomain", envKeys: ["ZENDESK_SUBDOMAIN"] },
      { param: "email", envKeys: ["ZENDESK_EMAIL"] },
      { param: "token", envKeys: ["ZENDESK_TOKEN", "ZENDESK_API_TOKEN"] },
    ],
    configKeys: ["start_date"],
    partitionKwarg: "start_date",
    partitionEndKwarg: "end_date",
    resourceConfigKey: "resources",
    defaultResources: ["tickets", "users"],
    normalizeResources: normalizeZendeskResources,
  },
  jira: {
    module: "jira",
    factory: "jira",
    credentialStyle: "jira_api",
    partitionSliceMode: "jira_jql",
    credentials: [
      { param: "subdomain", envKeys: ["JIRA_SUBDOMAIN", "JIRA_DOMAIN"] },
      { param: "email", envKeys: ["JIRA_EMAIL"] },
      { param: "api_token", envKeys: ["JIRA_API_TOKEN"] },
    ],
    resourceConfigKey: "resources",
    defaultResources: ["issues", "projects"],
    normalizeResources: normalizeJiraResources,
  },
  asana_dlt: {
    module: "asana_dlt",
    factory: "asana_source",
    credentialStyle: "asana_secrets",
    partitionSliceMode: "asana_tasks",
    credentials: [{ param: "access_token", envKeys: ["ASANA_ACCESS_TOKEN", "ASANA_DLT_ACCESS_TOKEN"] }],
  },
  workable: {
    module: "workable",
    factory: "workable_source",
    credentialStyle: "workable",
    credentials: [{ param: "access_token", envKeys: ["WORKABLE_ACCESS_TOKEN", "WORKABLE_API_TOKEN"] }],
    configKeys: ["start_date"],
    partitionKwarg: "start_date",
  },
  slack: {
    module: "slack",
    factory: "slack_source",
    credentialStyle: "slack",
    credentials: [{ param: "access_token", envKeys: ["SLACK_ACCESS_TOKEN", "SLACK_BOT_TOKEN"] }],
    configKeys: ["start_date"],
    partitionKwarg: "start_date",
    partitionEndKwarg: "end_date",
    alternateResourceConfigKeys: ["resources"],
    defaultResources: ["channels", "users"],
    normalizeResources: normalizeSlackResources,
  },
  notion: {
    module: "notion",
    factory: "notion_databases",
    credentials: [{ param: "api_key", envKeys: ["NOTION_API_KEY", "NOTION_TOKEN"] }],
    configKeys: ["database_ids"],
    partitionKwarg: "since",
    partitionEndKwarg: "until",
  },
  airtable: {
    module: "airtable",
    factory: "airtable_source",
    credentials: [{ param: "access_token", envKeys: ["AIRTABLE_ACCESS_TOKEN", "AIRTABLE_API_KEY"] }],
    configKeys: ["base_id", "table_names"],
    partitionKwarg: "since",
    partitionEndKwarg: "until",
  },
  google_sheets: {
    module: "google_sheets",
    factory: "google_sheets_source",
    credentials: [{ param: "credentials", envKeys: ["GOOGLE_SHEETS_CREDENTIALS", "GCP_CREDENTIALS"] }],
    configKeys: ["spreadsheet_url", "range_names"],
  },
  google_analytics: {
    module: "google_analytics",
    factory: "google_analytics_source",
    credentials: [{ param: "credentials", envKeys: ["GOOGLE_ANALYTICS_CREDENTIALS", "GCP_CREDENTIALS"] }],
    configKeys: ["property_id", "start_date"],
    partitionKwarg: "start_date",
    partitionEndKwarg: "end_date",
  },
  facebook_ads: {
    module: "facebook_ads",
    factory: "facebook_ads_source",
    credentials: [
      { param: "access_token", envKeys: ["FACEBOOK_ADS_ACCESS_TOKEN", "FACEBOOK_ACCESS_TOKEN"] },
      { param: "account_id", envKeys: ["FACEBOOK_ADS_ACCOUNT_ID", "FACEBOOK_ACCOUNT_ID"] },
    ],
    configKeys: ["start_date"],
    partitionKwarg: "start_date",
    partitionEndKwarg: "end_date",
  },
  google_ads: {
    module: "google_ads",
    factory: "google_ads_source",
    credentials: [
      { param: "developer_token", envKeys: ["GOOGLE_ADS_DEVELOPER_TOKEN"] },
      { param: "credentials", envKeys: ["GOOGLE_ADS_CREDENTIALS", "GCP_CREDENTIALS"] },
    ],
    configKeys: ["customer_id", "start_date"],
    partitionKwarg: "start_date",
    partitionEndKwarg: "end_date",
  },
  bing_webmaster: {
    module: "bing_webmaster",
    factory: "bing_webmaster_source",
    credentials: [{ param: "api_key", envKeys: ["BING_WEBMASTER_API_KEY"] }],
  },
  matomo: {
    module: "matomo",
    factory: "matomo_source",
    credentials: [
      { param: "token_auth", envKeys: ["MATOMO_TOKEN_AUTH"] },
      { param: "url", envKeys: ["MATOMO_URL"] },
    ],
    configKeys: ["site_id", "start_date"],
    partitionKwarg: "start_date",
    partitionEndKwarg: "end_date",
  },
  inbox: {
    module: "inbox",
    factory: "inbox_source",
    credentials: [
      { param: "host", envKeys: ["INBOX_HOST", "IMAP_HOST"] },
      { param: "email_account", envKeys: ["INBOX_EMAIL", "IMAP_EMAIL"] },
      { param: "password", envKeys: ["INBOX_PASSWORD", "IMAP_PASSWORD"] },
    ],
  },
  personio: {
    module: "personio",
    factory: "personio_source",
    credentials: [
      { param: "client_id", envKeys: ["PERSONIO_CLIENT_ID"] },
      { param: "client_secret", envKeys: ["PERSONIO_CLIENT_SECRET"] },
    ],
  },
  mux: {
    module: "mux",
    factory: "mux_source",
    credentials: [
      { param: "token_id", envKeys: ["MUX_TOKEN_ID"] },
      { param: "token_secret", envKeys: ["MUX_TOKEN_SECRET"] },
    ],
  },
  strapi: {
    module: "strapi",
    factory: "strapi_source",
    credentials: [
      { param: "api_secret_key", envKeys: ["STRAPI_API_SECRET_KEY", "STRAPI_API_TOKEN"] },
      { param: "domain", envKeys: ["STRAPI_DOMAIN", "STRAPI_BASE_URL"] },
    ],
  },
};

export function resolveVerifiedSourceSpec(slug: string): VerifiedSourceSpec | null {
  const raw = slug.toLowerCase().trim();
  if (VERIFIED_GOLDEN_SLUGS.has(raw) || VERIFIED_SKIP_SLUGS.has(raw)) return null;
  const key = VERIFIED_SLUG_ALIASES[raw] ?? raw;
  const explicit = VERIFIED_SOURCE_SPECS[key];
  if (explicit) return explicit;
  // Heuristic for verified packages without an explicit row yet.
  const importModule = key;
  const factory = key.includes(".") ? key : `${key.replace(/_dlt$/, "")}_source`;
  const prefix = key.toUpperCase().replace(/-/g, "_");
  return {
    module: importModule,
    factory,
    credentials: [{ param: "api_key", envKeys: [`${prefix}_API_KEY`, `${prefix}_ACCESS_TOKEN`, "API_KEY"] }],
  };
}

export function isVerifiedPackageSource(slug: string): boolean {
  const key = slug.toLowerCase().trim();
  if (VERIFIED_GOLDEN_SLUGS.has(key) || VERIFIED_SKIP_SLUGS.has(key)) return false;
  return Boolean(resolveVerifiedSourceSpec(key));
}
