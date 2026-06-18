import type { ComponentCompileTarget } from "@/lib/elt/component-compile-router";

/** User-facing label for internal compile target ids (no third-party product names). */
export function compileTargetLabel(target: string): string {
  switch (target as ComponentCompileTarget) {
    case "dlt":
      return "Ingest";
    case "sling":
      return "Replicate";
    case "dbt":
      return "Transform";
    case "quality":
      return "Quality";
    case "monitor":
      return "Monitor";
    case "python":
      return "Python";
    case "dagster":
      return "Platform";
    case "catalog_external":
      return "Catalog";
    case "skip":
      return "Connection";
    default:
      return target;
  }
}
