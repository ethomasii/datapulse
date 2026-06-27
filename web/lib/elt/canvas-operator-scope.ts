import { normalizeComponentCategory } from "@/lib/elt/component-canvas-io";

/**
 * Categories on the visual canvas operator rail.
 * Ingestion belongs on EL source/destination nodes; monitors live in eltPulse orchestration.
 */
export const CANVAS_OPERATOR_CATEGORIES = new Set(["transformation", "check", "ai"]);

export function isCanvasOperatorCategory(category: string): boolean {
  return CANVAS_OPERATOR_CATEGORIES.has(normalizeComponentCategory(category));
}

export function filterCanvasOperatorComponents<T extends { category: string }>(items: T[]): T[] {
  return items.filter((c) => isCanvasOperatorCategory(c.category));
}
