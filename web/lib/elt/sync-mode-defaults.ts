/** Sensible default sync metadata merged into new pipeline sourceConfiguration. */
export function defaultSyncModeForSource(sourceType: string): Record<string, unknown> {
  const slug = sourceType.toLowerCase();
  if (["stripe", "stripe_analytics", "hubspot", "salesforce", "pipedrive"].includes(slug)) {
    return {
      write_disposition: "append",
      incremental: true,
      incremental_field: "created",
    };
  }
  if (["github", "gitlab", "jira"].includes(slug)) {
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
