/**
 * Which run-slice strategies the product should expose per source type.
 *
 * Date/key slices create separate runs (`triggeredBy: backfill:partition:...`). They only reduce
 * data moved when the generated pipeline or gateway **uses** that value to filter the load -- which
 * not every stock template does.
 */

export type RunSliceCapabilityMode = "none_only" | "date_and_key";

export type RunSliceCapability = {
  mode: RunSliceCapabilityMode;
  /** Short line for list badges / builder. */
  label: string;
  /** Longer explanation for Run slices page and builder. */
  detail: string;
};

/** Stock generators do not pass `partition_key` into the actual source load for these connectors. */
const NONE_ONLY_SOURCES = new Set<string>(["rest_api"]);

const DATE_AND_KEY_DEFAULT: RunSliceCapability = {
  mode: "date_and_key",
  label: "Date & key slices available",
  detail:
    "Backfills create one run per slice; your gateway or customized Python must apply the slice (e.g. from triggeredBy) to filter loads -- the app only records runs.",
};

const DATE_AND_KEY_GITHUB: RunSliceCapability = {
  mode: "date_and_key",
  label: "Date slices supported (since filter)",
  detail:
    "The generated GitHub pipeline passes a date partition key as `since` to `github_reactions`, filtering issues, " +
    "PRs, and reactions to items updated on or after that date -- matching how Dagster and other orchestrators backfill " +
    "by date range. Use an ISO date (e.g. 2024-01-01) as your slice key.",
};

const NONE_ONLY_REST: RunSliceCapability = {
  mode: "none_only",
  label: "Full runs only (stock pipeline)",
  detail:
    "The stock REST `rest_api_source` template does not pass the partition key into the API request. Run slices " +
    "would only create separate run records unless you extend the generated code. Use \"None\", or customize the " +
    "pipeline to honor `partition_key` / run metadata.",
};

export function getRunSliceCapability(sourceType: string): RunSliceCapability {
  const s = sourceType.toLowerCase().trim();
  if (s === "github") return DATE_AND_KEY_GITHUB;
  if (!NONE_ONLY_SOURCES.has(s)) return DATE_AND_KEY_DEFAULT;
  return NONE_ONLY_REST;
}

export function runSlicesAllowed(sourceType: string): boolean {
  return getRunSliceCapability(sourceType).mode === "date_and_key";
}
