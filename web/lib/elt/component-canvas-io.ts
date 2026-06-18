/**
 * Canvas port rules from dagster-component-templates schema-spec.json.
 * Maps component category → left/right connection ports for the visual pipeline canvas.
 */

import schemaSpec from "@/lib/elt/data/component-schema-spec.json";

export type ComponentCanvasPorts = {
  left: boolean;
  right: boolean;
  note?: string;
};

export type ComponentCategory =
  | "transformation"
  | "source"
  | "sink"
  | "ingestion"
  | "analytics"
  | "ai"
  | "infrastructure"
  | "dbt"
  | "sensor"
  | "external"
  | "observation"
  | "check"
  | "integration"
  | "resource";

const byCategory = (schemaSpec as { connectors?: { byCategory?: Record<string, ComponentCanvasPorts> } })
  .connectors?.byCategory ?? {};

/** Normalized category slug from manifest (may use singular/plural variants). */
export function normalizeComponentCategory(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (s === "transformations" || s === "transform") return "transformation";
  if (s === "sources") return "source";
  if (s === "sinks") return "sink";
  if (s === "checks") return "check";
  if (s === "sensors") return "sensor";
  if (s === "observations") return "observation";
  return s;
}

export function canvasPortsForCategory(category: string): ComponentCanvasPorts {
  const key = normalizeComponentCategory(category);
  const ports = byCategory[key];
  if (ports) return ports;
  return { left: false, right: false, note: "Unknown category" };
}

/** Whether an edge from category A → category B is valid on the component canvas. */
export function isValidComponentEdge(sourceCategory: string, targetCategory: string): boolean {
  const src = canvasPortsForCategory(sourceCategory);
  const tgt = canvasPortsForCategory(targetCategory);
  return src.right && tgt.left;
}
