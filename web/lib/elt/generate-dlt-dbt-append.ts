import type { PipelineRequest } from "./types";
import { escapePyString } from "./escape-py";
import { partitionColumnFromSourceConfiguration } from "./run-partition-resolution";

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

const DBT_VAR_KEY_FALLBACK_VALUE = "elt_partition_value";
const DBT_VAR_KEY_FALLBACK_COLUMN = "elt_partition_column";
const DBT_VAR_KEY_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Safe dbt `var()` name for use as a Python dict key (alphanumeric + underscore). */
export function sanitizeDbtVarKey(raw: unknown, fallback: string): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s || s.length > 64 || !DBT_VAR_KEY_RE.test(s)) return fallback;
  return s;
}

function dbtSliceVarKeys(d: Record<string, unknown>): { valueKey: string; columnKey: string } {
  let valueKey = sanitizeDbtVarKey(d.slice_value_var, DBT_VAR_KEY_FALLBACK_VALUE);
  let columnKey = sanitizeDbtVarKey(d.slice_column_var, DBT_VAR_KEY_FALLBACK_COLUMN);
  if (valueKey === columnKey) columnKey = DBT_VAR_KEY_FALLBACK_COLUMN;
  return { valueKey, columnKey };
}

/**
 * When the pipeline has a date/key partition column saved in `_partitionConfig`, expose it to dbt
 * under `slice_column_var` (default `elt_partition_column`) alongside the slice string under
 * `slice_value_var` (default `elt_partition_value`) — same string as the `partition_key` arg to `run()`.
 */
export function partitionColumnForDbtVars(request: PipelineRequest): string | null {
  return partitionColumnFromSourceConfiguration(request.sourceConfiguration);
}

/**
 * Optional post-load dbt step using the dlt dbt runner.
 * @see https://dlthub.com/docs/dlt-ecosystem/transformations/dbt
 *
 * Enable via `source_configuration.dlt_dbt`:
 * `{ "enabled": true, "package_path": "...", "slice_value_var"?, "slice_column_var"?, ... }`
 *
 * Slice runs: when `run(partition_key=...)` is used, the dbt step receives dlt `additional_vars` using the
 * dbt var **names** from `slice_value_var` / `slice_column_var` (defaults `elt_partition_value`, `elt_partition_column`).
 * Map to an existing project by setting those to the names your models already call `var(...)`.
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

  const { valueKey, columnKey } = dbtSliceVarKeys(d);
  const partitionCol = partitionColumnForDbtVars(request);
  const partitionColumnLine = partitionCol
    ? `    _elt_dbt_vars["${escapePyString(columnKey)}"] = "${escapePyString(partitionCol)}"\n`
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
        _elt_dbt_vars["${escapePyString(valueKey)}"] = partition_key
    _dbt_run_params = ${runParamsExpr}
    _dbt_runner.run_all(_dbt_run_params, additional_vars=(_elt_dbt_vars if _elt_dbt_vars else None))
`;
}
