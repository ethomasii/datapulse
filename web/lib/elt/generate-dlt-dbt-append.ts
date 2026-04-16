import type { PipelineRequest } from "./types";
import { escapePyString } from "./escape-py";

function dbtDestination(request: PipelineRequest): string {
  if (request.destinationInstance) {
    return `${request.destinationType}__${request.destinationInstance}`;
  }
  return request.destinationType;
}

/** Python tuple literal; single element must end with a comma or it is not a tuple. */
function pyStrTuple(parts: string[]): string {
  const inner = parts.map((p) => `"${escapePyString(p)}"`).join(", ");
  return `(${inner}${parts.length === 1 ? "," : ""})`;
}

/**
 * When the pipeline has a date/key partition column saved in `_partitionConfig`, expose it to dbt
 * as `var("elt_partition_column")` alongside `var("elt_partition_value")` (the `partition_key` arg to `run()`).
 */
export function partitionColumnForDbtVars(request: PipelineRequest): string | null {
  const raw = request.sourceConfiguration?._partitionConfig;
  if (!raw || typeof raw !== "object") return null;
  const pc = raw as { type?: unknown; column?: unknown };
  const t = pc.type;
  if (t !== "date" && t !== "key") return null;
  const col = String(pc.column ?? "").trim();
  return col || null;
}

/**
 * Optional post-load dbt step using the dlt dbt runner.
 * @see https://dlthub.com/docs/dlt-ecosystem/transformations/dbt
 *
 * Enable via `source_configuration.dlt_dbt`:
 * `{ "enabled": true, "package_path": "path/or/git/url", "dataset_name"?, "package_repository_branch"?, "run_scope": "all"|"selection", "selector"? }`
 *
 * Slice runs: when `run(partition_key=...)` is used, the dbt step receives dlt `additional_vars`
 * `elt_partition_value` (same string as `partition_key`) and, if `_partitionConfig` has type `date`/`key` and a column,
 * `elt_partition_column` (warehouse column name for the slice). Use in dbt as `var("elt_partition_value", none)` etc.
 */
export function dltDbtRunnerBeforeReturn(request: PipelineRequest): string {
  const raw = request.sourceConfiguration?.dlt_dbt;
  if (!raw || typeof raw !== "object") return "";
  const d = raw as Record<string, unknown>;
  if (!Boolean(d.enabled)) return "";
  const packagePath = String(d.package_path ?? "").trim();
  if (!packagePath) return "";

  const destination = dbtDestination(request);
  const defaultDataset = `${request.name}_dbt`.replace(/[^a-zA-Z0-9_]/g, "_");
  const dbtDatasetRaw =
    typeof d.dataset_name === "string" && d.dataset_name.trim() ? d.dataset_name.trim() : defaultDataset;
  const dbtDataset = dbtDatasetRaw.replace(/[^a-zA-Z0-9_]/g, "_");

  const branch = typeof d.package_repository_branch === "string" ? d.package_repository_branch.trim() : "";
  const runScope = d.run_scope === "selection" ? "selection" : "all";
  const selector = typeof d.selector === "string" ? d.selector.trim() : "";

  const packageKw = branch
    ? `package_repository_branch="${escapePyString(branch)}", `
    : "";

  const runParamsExpr =
    runScope === "selection" && selector
      ? pyStrTuple(["--fail-fast", "--select", selector])
      : pyStrTuple(["--fail-fast"]);

  const partitionCol = partitionColumnForDbtVars(request);
  const partitionColumnLine = partitionCol
    ? `    _elt_dbt_vars["elt_partition_column"] = "${escapePyString(partitionCol)}"\n`
    : "";

  return `
    # Post-load dbt (dlt dbt runner) — https://dlthub.com/docs/dlt-ecosystem/transformations/dbt
    _dbt_pipeline = dlt.pipeline(
        pipeline_name="${escapePyString(request.name)}",
        destination="${escapePyString(destination)}",
        dataset_name="${escapePyString(dbtDataset)}",
    )
    _dbt_venv = dlt.dbt.get_venv(_dbt_pipeline)
    _dbt_runner = dlt.dbt.package(_dbt_pipeline, r"${escapePyString(packagePath)}", ${packageKw}venv=_dbt_venv)
    _elt_dbt_vars = {}
${partitionColumnLine}    if partition_key:
        _elt_dbt_vars["elt_partition_value"] = partition_key
    _dbt_run_params = ${runParamsExpr}
    _dbt_runner.run_all(_dbt_run_params, additional_vars=(_elt_dbt_vars if _elt_dbt_vars else None))
`;
}
