/** Sensible default sync metadata merged into new pipeline sourceConfiguration. */
export function defaultSyncModeForSource(sourceType: string): Record<string, unknown> {
  const slug = sourceType.toLowerCase();

  const incrementalSaas = new Set([
    "stripe",
    "stripe_analytics",
    "hubspot",
    "salesforce",
    "pipedrive",
    "shopify",
    "shopify_dlt",
    "slack",
    "zendesk",
    "freshdesk",
    "jira",
    "asana",
    "asana_dlt",
    "workable",
    "google_analytics",
    "matomo",
    "facebook_ads",
    "google_ads",
    "intercom",
    "mixpanel",
    "notion",
    "airtable",
    "personio",
    "strapi",
  ]);

  if (incrementalSaas.has(slug)) {
    return {
      write_disposition: "append",
      incremental: true,
      incremental_field: "updated_at",
    };
  }

  if (["github", "gitlab"].includes(slug)) {
    return {
      write_disposition: "append",
      incremental: true,
      incremental_field: "updated_at",
    };
  }

  if (["postgres", "mysql", "mssql", "mongodb"].includes(slug)) {
    return {
      write_disposition: "append",
      incremental: true,
    };
  }

  if (["s3", "gcs", "azure_blob", "iceberg", "csv", "json", "parquet"].includes(slug)) {
    return {
      write_disposition: "append",
      incremental: true,
    };
  }

  return { write_disposition: "replace" };
}

export const SYNC_MODE_OPTIONS = [
  {
    id: "incremental",
    label: "Incremental",
    description: "Append new/changed rows — best for SaaS APIs and CDC-friendly databases.",
  },
  {
    id: "full",
    label: "Full refresh",
    description: "Replace destination tables on each run — simplest for small datasets.",
  },
] as const;
