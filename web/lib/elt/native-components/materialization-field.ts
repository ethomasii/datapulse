import type { NativeComponentField } from "./types";

export const MATERIALIZATION_OPTIONS = ["ephemeral", "table", "view"] as const;
export type MaterializationMode = (typeof MATERIALIZATION_OPTIONS)[number];

export const MATERIALIZATION_FIELD: NativeComponentField = {
  key: "materialization",
  label: "Materialization",
  description:
    "Ephemeral (default) fuses into upstream SQL with no extra table. Table persists this step's output. View creates a view (breakpoint for fusion).",
  type: "select",
  options: [...MATERIALIZATION_OPTIONS],
  default: "ephemeral",
};

const WAREHOUSE_MATERIALIZATION_TARGETS = new Set(["warehouse", "sql"]);

export function isWarehouseMaterializationEligible(compileTarget: string | undefined): boolean {
  if (!compileTarget) return false;
  return WAREHOUSE_MATERIALIZATION_TARGETS.has(compileTarget.toLowerCase());
}

export function appendMaterializationField(fields: NativeComponentField[]): NativeComponentField[] {
  if (fields.some((f) => f.key === "materialization")) return fields;
  return [...fields, MATERIALIZATION_FIELD];
}

export function materializationLabel(mode: string | undefined): string {
  const m = (mode ?? "ephemeral").toLowerCase();
  if (m === "table") return "Table (persist)";
  if (m === "view") return "View (breakpoint)";
  return "Ephemeral (fused)";
}
