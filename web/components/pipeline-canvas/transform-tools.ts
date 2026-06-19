/** Shared with diagram nodes and the canvas side inspector. */

export const TRANSFORM_TOOLS = [
  { value: "", label: "Not set" },
  { value: "dbt", label: "dbt project (recommended)" },
  { value: "sql", label: "Warehouse SQL" },
  { value: "python", label: "Legacy — Python / dataframe" },
  { value: "other", label: "Other" },
] as const;

export type TransformToolValue = (typeof TRANSFORM_TOOLS)[number]["value"];

/** User-facing label for a canvas transform node approach. */
export function transformToolLabel(tool: string): string {
  const match = TRANSFORM_TOOLS.find((t) => t.value === tool);
  if (match) return match.label;
  if (!tool.trim()) return "Not set";
  return tool;
}

/** Short badge for diagram nodes (warehouse / dbt / dataframe). */
export function transformToolBadge(tool: string): string {
  switch (tool) {
    case "sql":
      return "Warehouse SQL";
    case "dbt":
      return "dbt project";
    case "python":
      return "Legacy (dataframe)";
    default:
      return transformToolLabel(tool);
  }
}
