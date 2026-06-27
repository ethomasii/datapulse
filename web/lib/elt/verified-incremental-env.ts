/**
 * dlt incremental env bounds for verified sources whose factories lack since/start_date
 * kwargs but expose per-resource incremental cursors (Personio, Salesforce, etc.).
 *
 * Env pattern: SOURCES__{SOURCE}__{RESOURCE}__{CURSOR}__INITIAL_VALUE|END_VALUE
 *
 * Populated from managed-worker-service/scripts/scan-incremental-env.py (vendored sources).
 */

export type IncrementalEnvResource = {
  /** dlt resource name (uppercased in env keys) */
  name: string;
  cursorField: string;
  /** Also set START_DATE / END_DATE resource config for day slices */
  dateRangeParams?: boolean;
};

export type IncrementalEnvConfig = {
  /** dlt source section name (@dlt.source name=...) */
  dltSourceName: string;
  resources: IncrementalEnvResource[];
};

/** Catalog slug → VERIFIED_INCREMENTAL_ENV key (e.g. asana → asana_dlt). */
const INCREMENTAL_ENV_SLUG_ALIASES: Record<string, string> = {
  asana: "asana_dlt",
};

export const VERIFIED_INCREMENTAL_ENV: Record<string, IncrementalEnvConfig> = {
  personio: {
    dltSourceName: "personio",
    resources: [
      { name: "employees", cursorField: "last_modified_at" },
      { name: "absences", cursorField: "updated_at" },
      { name: "attendances", cursorField: "updated_at", dateRangeParams: true },
    ],
  },
  salesforce: {
    dltSourceName: "salesforce",
    resources: [
      { name: "account", cursorField: "LastModifiedDate" },
      { name: "opportunity", cursorField: "SystemModstamp" },
      { name: "opportunity_line_item", cursorField: "SystemModstamp" },
      { name: "opportunity_contact_role", cursorField: "SystemModstamp" },
      { name: "campaign_member", cursorField: "SystemModstamp" },
      { name: "task", cursorField: "SystemModstamp" },
      { name: "event", cursorField: "SystemModstamp" },
    ],
  },
  asana_dlt: {
    dltSourceName: "asana_dlt",
    resources: [{ name: "tasks", cursorField: "modified_at" }],
  },
  matomo: {
    dltSourceName: "matomo_visits",
    resources: [{ name: "visits", cursorField: "serverTimestamp" }],
  },
  facebook_ads: {
    dltSourceName: "facebook_ads",
    resources: [{ name: "facebook_insights", cursorField: "date_start" }],
  },
};

export function resolveIncrementalEnvSlug(slug: string): string {
  const key = slug.toLowerCase().trim();
  return INCREMENTAL_ENV_SLUG_ALIASES[key] ?? key;
}

export function getIncrementalEnvConfig(slug: string): IncrementalEnvConfig | null {
  const resolved = resolveIncrementalEnvSlug(slug);
  return VERIFIED_INCREMENTAL_ENV[resolved] ?? null;
}

export function slugsWithIncrementalEnv(): string[] {
  return Object.keys(VERIFIED_INCREMENTAL_ENV);
}
