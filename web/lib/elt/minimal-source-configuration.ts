/**
 * Starter `sourceConfiguration` when creating a pipeline from the visual canvas or builder.
 * Field defaults mirror `embedded_elt_builder/web/credentials_config.py` (`SOURCE_CONFIGURATIONS`).
 *
 * Optional post-load dbt for **dlt** pipelines (codegen appends dlt dbt runner when enabled). The canvas
 * inspector syncs into `dlt_dbt`:
 * `{ enabled, package_path, dataset_name?, package_repository_branch?, run_scope: "all"|"selection", selector? }`.
 * Codegen passes slice context into dbt via dlt `additional_vars` (default var names `elt_partition_value` / `elt_partition_column`; override with `slice_value_var` / `slice_column_var` on `dlt_dbt`).
 * @see https://dlthub.com/docs/dlt-ecosystem/transformations/dbt
 */

import { getSourceConfigurationFields } from "./credentials-catalog";

export function minimalSourceConfigurationForNewPipeline(sourceType: string): Record<string, unknown> {
  const fields = getSourceConfigurationFields(sourceType);
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.default !== undefined) {
      out[f.key] = f.default;
    }
  }

  const t = sourceType.toLowerCase();
  if (t === "github") {
    if (!out.repos) {
      out.repos = "your-org/your-repo";
    }
    if (!Array.isArray(out.resources) || out.resources.length === 0) {
      out.resources = ["issues", "pull_requests"];
    }
    out.github_token_env = "GITHUB_TOKEN";
    out.items_per_page = 100;
    const first = String(out.repos).split(",")[0]?.trim() ?? "";
    const [o, n] = first.split("/").map((x) => x.trim());
    if (o && n) {
      out.repo_owner = o;
      out.repo_name = n;
    }
  }
  if (t === "rest_api") {
    if (!out.base_url) out.base_url = "https://api.example.com";
    if (!out.resource_name) out.resource_name = "data";
    if (!out.endpoint) out.endpoint = "/data";
    if (!out.http_method) out.http_method = "GET";
    if (!out.pagination_type) out.pagination_type = "auto";
  }
  return out;
}
