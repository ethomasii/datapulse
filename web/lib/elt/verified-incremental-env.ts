/**
 * dlt incremental env bounds for verified sources whose factories lack since/start_date
 * kwargs but expose per-resource incremental cursors (Personio, etc.).
 *
 * Env pattern: SOURCES__{SOURCE}__{RESOURCE}__{CURSOR}__INITIAL_VALUE|END_VALUE
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

export const VERIFIED_INCREMENTAL_ENV: Record<string, IncrementalEnvConfig> = {
  personio: {
    dltSourceName: "personio",
    resources: [
      { name: "employees", cursorField: "last_modified_at" },
      { name: "absences", cursorField: "updated_at" },
      { name: "attendances", cursorField: "updated_at", dateRangeParams: true },
    ],
  },
};

export function getIncrementalEnvConfig(slug: string): IncrementalEnvConfig | null {
  const key = slug.toLowerCase().trim();
  return VERIFIED_INCREMENTAL_ENV[key] ?? null;
}
