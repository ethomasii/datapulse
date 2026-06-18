/** Map Dagster catalog attribute names to eltPulse table fields. */
export function inputTable(config: Record<string, unknown>): string {
  return String(
    config.table ?? config.upstream_asset_key ?? config.input_table ?? config.source_table ?? ""
  ).trim();
}

export function outputTable(config: Record<string, unknown>, fallback = ""): string {
  return String(config.output_table ?? config.asset_name ?? fallback).trim();
}

export function joinHowFromTemplate(config: Record<string, unknown>, defaultHow = "inner"): string {
  const explicit = String(config.how ?? config.join_type ?? "").trim();
  if (explicit) return explicit;
  const tid = String(config.template_id ?? config.component_id ?? "").trim().toLowerCase();
  const map: Record<string, string> = {
    left_join: "left",
    right_join: "right",
    outer_join: "outer",
    full_outer_join: "outer",
    inner_join: "inner",
    warehouse_join: "left",
  };
  return map[tid] ?? defaultHow;
}
