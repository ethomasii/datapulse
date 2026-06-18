import type { NativeComponentField, NativeComponentFieldType } from "./types";

/** Dagster component schema.json `attributes` entry (subset). */
type DagsterFieldDescriptor = {
  type?: string;
  label?: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  enum?: string[];
  "ui:widget"?: string;
  items?: { type?: string };
};

const DAGSTER_SKIP_FIELDS = new Set([
  "asset_name",
  "group_name",
  "partition_type",
  "partition_start",
  "partition_date_column",
  "partition_values",
  "partition_static_dim",
  "partition_static_column",
  "owners",
  "asset_tags",
  "kinds",
  "freshness_max_lag_minutes",
  "freshness_cron",
  "column_lineage",
  "include_preview_metadata",
  "preview_rows",
  "description",
  "deps",
  "retry_policy_max_retries",
  "retry_policy_delay_seconds",
  "retry_policy_backoff",
  "dynamic_partition_name",
  "partition_dimensions",
  "left_asset_key",
  "right_asset_key",
]);

function mapDagsterType(desc: DagsterFieldDescriptor): NativeComponentFieldType {
  const widget = desc["ui:widget"];
  if (widget === "list" || desc.type === "array") return "string_list";
  if (desc.enum?.length || widget === "select") return "select";
  if (desc.type === "integer" || desc.type === "number") return "number";
  if (desc.type === "boolean") return "boolean";
  if (desc.type === "object") return "text";
  return "string";
}

/** Convert Dagster schema.json attributes → eltPulse form fields (for UI + docs). */
export function dagsterAttributesToFields(
  attributes: Record<string, DagsterFieldDescriptor> | undefined,
  extraSkip?: string[]
): NativeComponentField[] {
  if (!attributes) return [];
  const skip = new Set([...Array.from(DAGSTER_SKIP_FIELDS), ...(extraSkip ?? [])]);
  const fields: NativeComponentField[] = [];

  for (const [key, desc] of Object.entries(attributes)) {
    if (skip.has(key)) continue;
    if (desc.type === "object" && desc["ui:widget"] !== "key-value") continue;

    fields.push({
      key,
      label: desc.label ?? key.replace(/_/g, " "),
      description: desc.description,
      type: mapDagsterType(desc),
      required: desc.required === true,
      default: desc.default ?? undefined,
      options: desc.enum,
    });
  }

  return fields;
}

/** Map Dagster field keys to native compiler keys where they differ. */
export function normalizeConfigForNative(
  componentId: string,
  config: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...config, template_id: config.template_id ?? componentId };

  if (componentId === "dataframe_join" || componentId === "join_tables") {
    if (!next["left_table"] && next["left_asset_key"]) next["left_table"] = next["left_asset_key"];
    if (!next["right_table"] && next["right_asset_key"]) next["right_table"] = next["right_asset_key"];
    if (!next["output_table"] && next["asset_name"]) next["output_table"] = next["asset_name"];
  }

  return next;
}
