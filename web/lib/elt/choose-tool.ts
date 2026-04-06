/** Same rules as Python `choose_tool` in pipeline_generator.py */
export function chooseTool(sourceType: string, destinationType: string): "dlt" | "sling" {
  const s = sourceType.toLowerCase();
  const apiSources = new Set([
    "github",
    "stripe",
    "shopify",
    "hubspot",
    "salesforce",
    "google_analytics",
    "facebook_ads",
    "google_ads",
    "slack",
    "notion",
    "airtable",
    "asana",
    "jira",
    "zendesk",
    "intercom",
    "mixpanel",
    "segment",
    "rest_api",
  ]);

  if (apiSources.has(s)) return "dlt";

  const dbSources = new Set(["postgres", "mysql", "mongodb", "mssql", "oracle"]);
  const storageSources = new Set(["s3", "gcs", "azure_blob", "csv", "json", "parquet"]);

  if (storageSources.has(s)) return "dlt";
  if (dbSources.has(s)) return "sling";

  void destinationType;
  return "dlt";
}
