import type { PipelineRequest } from "./types";
import { escapePyString } from "./escape-py";

function dbtDestination(request: PipelineRequest): string {
  if (request.destinationInstance) {
    return `${request.destinationType}__${request.destinationInstance}`;
  }
  return request.destinationType;
}

/**
 * Optional post-load dbt step using the dlt dbt runner.
 * @see https://dlthub.com/docs/dlt-ecosystem/transformations/dbt
 *
 * Enable via `source_configuration.dlt_dbt`:
 * `{ "enabled": true, "package_path": "path/to/dbt_project", "dataset_name": "optional_output_dataset" }`
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

  return `
    # Post-load dbt (dlt dbt runner) — https://dlthub.com/docs/dlt-ecosystem/transformations/dbt
    _dbt_pipeline = dlt.pipeline(
        pipeline_name="${escapePyString(request.name)}",
        destination="${escapePyString(destination)}",
        dataset_name="${escapePyString(dbtDataset)}",
    )
    _dbt_venv = dlt.dbt.get_venv(_dbt_pipeline)
    _dbt_runner = dlt.dbt.package(_dbt_pipeline, r"${escapePyString(packagePath)}", venv=_dbt_venv)
    _dbt_runner.run_all()
`;
}
