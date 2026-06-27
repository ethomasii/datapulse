import { normalizeComponentCategory } from "@/lib/elt/component-canvas-io";

/**
 * Categories on the visual canvas operator rail.
 * Ingestion → EL source/dest; monitors → orchestration; checks → not graph operators (no table output).
 */
export const CANVAS_OPERATOR_CATEGORIES = new Set(["transformation", "ai"]);

/** Dagster asset-check templates — terminal, no materialized output table. */
export const CANVAS_OPERATOR_EXCLUDED_IDS = new Set([
  "great_expectations_check",
  "soda_check",
  "dq_check",
  "unique_check",
]);

export function isCanvasOperatorCategory(category: string): boolean {
  return CANVAS_OPERATOR_CATEGORIES.has(normalizeComponentCategory(category));
}

export function isCanvasOperatorComponent(item: {
  id: string;
  category: string;
  compileTarget?: string;
}): boolean {
  if (CANVAS_OPERATOR_EXCLUDED_IDS.has(item.id)) return false;
  if (normalizeComponentCategory(item.category) === "check") return false;
  if (item.compileTarget === "quality") return false;
  return isCanvasOperatorCategory(item.category);
}

export function filterCanvasOperatorComponents<
  T extends { id: string; category: string; compileTarget?: string },
>(items: T[]): T[] {
  return items.filter(isCanvasOperatorComponent);
}
