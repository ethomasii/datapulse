/**
 * Which run-slice strategies the product should expose per source type.
 *
 * Date/key slices create separate runs (`triggeredBy: backfill:partition:...`). They only reduce
 * data moved when the generated pipeline or gateway **uses** that value to filter the load — which
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
const NONE_ONLY_SOURCES = new Set<string>(["github", "rest_api"]);

const DATE_AND_KEY_DEFAULT: RunSliceCapability = {
  mode: "date_and_key",
  label: "Date & key slices available",
  detail:
    "Backfills create one run per slice; your gateway or customized Python must apply the slice (e.g. from triggeredBy) to filter loads — the app only records runs.",
};

const NONE_ONLY_GITHUB: RunSliceCapability = {
  mode: "none_only",
  label: "Full runs only (stock pipeline)",
  detail:
    "The stock GitHub dlt pipeline does not apply partition keys to `github_reactions` — run slices would only " +
    "create labeled runs unless you customize the Python to filter by slice. Use “None”, or switch to a database, " +
    "file, or object-storage source if you need first-class date/key backfills without custom code.",
};

const NONE_ONLY_REST: RunSliceCapability = {
  mode: "none_only",
  label: "Full runs only (stock pipeline)",
  detail:
    "The stock REST `rest_api_source` template does not pass the partition key into the API request. Run slices " +
    "would only create separate run records unless you extend the generated code. Use “None”, or customize the " +
    "pipeline to honor `partition_key` / run metadata.",
};

export function getRunSliceCapability(sourceType: string): RunSliceCapability {
  const s = sourceType.toLowerCase().trim();
  if (!NONE_ONLY_SOURCES.has(s)) return DATE_AND_KEY_DEFAULT;
  if (s === "github") return NONE_ONLY_GITHUB;
  return NONE_ONLY_REST;
}

export function runSlicesAllowed(sourceType: string): boolean {
  return getRunSliceCapability(sourceType).mode === "date_and_key";
}
