/** Shared with diagram nodes and the canvas side inspector. */
export const TRANSFORM_TOOLS = [
  { value: "", label: "Not set" },
  { value: "dbt", label: "dbt" },
  { value: "sql", label: "SQL / warehouse models" },
  { value: "python", label: "Python" },
  { value: "other", label: "Other" },
] as const;
