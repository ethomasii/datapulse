import { minimalSourceConfigurationForNewPipeline } from "./minimal-source-configuration";

/** Keys we keep when changing `sourceType` from the canvas (graph + orchestration hints). */
const PRESERVED_WHEN_CHANGING_SOURCE: readonly string[] = [
  "canvas",
  "elt_tests",
  "elt_sensors",
  "elt_partitions_note",
  "elt_other_notes",
  "schedule_enabled",
  "cron_schedule",
  "schedule_timezone",
];

/**
 * Apply starter fields for a new source type while keeping canvas and ELT metadata.
 */
export function mergeSourceConfigurationForSourceTypeChange(
  existing: Record<string, unknown>,
  newSourceType: string
): Record<string, unknown> {
  const minimal = minimalSourceConfigurationForNewPipeline(newSourceType);
  const preserved: Record<string, unknown> = {};
  for (const key of PRESERVED_WHEN_CHANGING_SOURCE) {
    if (key in existing) preserved[key] = existing[key];
  }
  return { ...minimal, ...preserved };
}
