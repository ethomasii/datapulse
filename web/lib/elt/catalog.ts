/** Source/destination catalog (aligned with the Python ELT Builder; generators catch up over time). */

export const SOURCE_GROUPS: Record<string, readonly string[]> = {
  "APIs & SaaS": [
    "github",
    "rest_api",
    "stripe",
    "shopify",
    "salesforce",
    "hubspot",
    "slack",
    "notion",
    "airtable",
    "jira",
    "zendesk",
    "intercom",
    "mixpanel",
    "segment",
    "google_analytics",
    "facebook_ads",
    "google_ads",
    "asana",
  ],
  "Cloud Storage": ["s3", "gcs", "azure_blob"],
  Databases: ["postgres", "mysql", "mongodb", "mssql", "oracle", "duckdb", "sqlite"],
  Files: ["csv", "json", "parquet"],
};

export const DESTINATION_GROUPS: Record<string, readonly string[]> = {
  "Cloud Warehouses": ["snowflake", "bigquery", "redshift", "databricks"],
  Databases: ["postgres", "mysql", "duckdb", "motherduck", "clickhouse", "sqlite"],
  Storage: ["filesystem"],
};

export const SOURCE_TYPES = Array.from(new Set(Object.values(SOURCE_GROUPS).flat())) as string[];

export const DESTINATION_TYPES = Array.from(new Set(Object.values(DESTINATION_GROUPS).flat())) as string[];
