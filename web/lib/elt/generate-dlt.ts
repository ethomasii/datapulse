import type { PipelineRequest } from "./types";
import { escapePyString } from "./escape-py";
import { dltDbtRunnerBeforeReturn } from "./generate-dlt-dbt-append";
import { generateRestApiAdvanced, generateRestApiPipeline } from "./generate-dlt-rest";

export function generateDltPipeline(request: PipelineRequest): string {
  const { sourceType } = request;
  if (sourceType === "github") return generateGithubPipeline(request);
  if (sourceType === "rest_api") {
    const c = request.sourceConfiguration;
    if (c.advanced_mode && c.advanced_config) {
      return generateRestApiAdvanced(request);
    }
    return generateRestApiPipeline(request);
  }
  return generateGenericPipeline(request);
}

function generateGithubPipeline(request: PipelineRequest): string {
  const config = request.sourceConfiguration;
  const repoOwner = String(config.repo_owner ?? "REPO_OWNER");
  const repoName = String(config.repo_name ?? "REPO_NAME");
  const resources = Array.isArray(config.resources)
    ? (config.resources as string[])
    : typeof config.resources === "string"
      ? (config.resources as string).split(",").map((x) => x.trim()).filter(Boolean)
      : ["issues", "pull_requests"];
  const resourceList = resources.map((r) => `"${escapePyString(r)}"`).join(", ");
  const rawTokenEnv = String(config.github_token_env ?? "GITHUB_TOKEN").trim() || "GITHUB_TOKEN";
  const tokenEnv = /^[A-Z][A-Z0-9_]*$/i.test(rawTokenEnv) ? rawTokenEnv.toUpperCase() : "GITHUB_TOKEN";
  const itemsPerPage =
    typeof config.items_per_page === "number" && config.items_per_page > 0
      ? Math.min(100, Math.floor(config.items_per_page))
      : 100;
  const maxItemsPy =
    typeof config.max_items === "number" && config.max_items >= 0
      ? String(Math.floor(config.max_items))
      : "None";
  const datasetName =
    request.schemaOverride || `github_${repoOwner}_${repoName}`.replace(/[^a-zA-Z0-9_]/g, "_");

  let destination: string;
  let destinationComment: string;
  if (request.destinationInstance) {
    destination = `${request.destinationType}__${request.destinationInstance}`;
    destinationComment = `# Named destination: ${destination} (uses ${request.destinationType.toUpperCase()}_${request.destinationInstance.toUpperCase()}_* env vars)`;
  } else {
    destination = request.destinationType;
    destinationComment = "";
  }

  const desc =
    request.description ||
    `Load GitHub data from ${repoOwner}/${repoName} to ${request.destinationType}`;

  return `"""dlt pipeline: ${escapePyString(request.name)}

${escapePyString(desc)}
"""

import os
import dlt
from dlt.sources.github import github_reactions

def run(partition_key: str = None):
    """Run the GitHub pipeline.

    partition_key: optional ISO date string (e.g. "2024-01-01") used as a `since` filter
    so only items updated on or after that date are fetched — enabling date-based backfills
    and incremental loads exactly as you would in Dagster or Prefect.
    """

    # Resolve the GitHub PAT from the environment
    github_token = os.environ.get("${escapePyString(tokenEnv)}")

    # Configure the pipeline
    ${destinationComment}
    pipeline = dlt.pipeline(
        pipeline_name="${escapePyString(request.name)}",
        destination="${escapePyString(destination)}",
        dataset_name="${escapePyString(datasetName)}",
    )

    # Build source kwargs — inject `since` when a partition key (date) is provided
    source_kwargs = dict(
        owner="${escapePyString(repoOwner)}",
        name="${escapePyString(repoName)}",
        items_per_page=${itemsPerPage},
        max_items=${maxItemsPy},  # None = load all (within API limits)
        access_token=github_token,
    )
    if partition_key:
        # partition_key is expected to be an ISO date, e.g. "2024-01-01"
        source_kwargs["since"] = partition_key

    source = github_reactions(**source_kwargs)

    # Select which resources to load
    resources_to_load = [${resourceList}]
    source = source.with_resources(*resources_to_load)

    # Run the pipeline with write disposition
    info = pipeline.run(
        source,
        write_disposition="${escapePyString(request.writeDisposition ?? "append")}",
        loader_file_format="${escapePyString(request.fileFormat ?? "parquet")}"
    )

    print(f"Pipeline completed: {info}")${dltDbtRunnerBeforeReturn(request)}
    return info

if __name__ == "__main__":
    import sys
    partition = sys.argv[1] if len(sys.argv) > 1 else None
    run(partition_key=partition)
`;
}

function generateGenericPipeline(request: PipelineRequest): string {
  const datasetName = request.schemaOverride || `${request.sourceType}_data`.replace(/[^a-zA-Z0-9_]/g, "_");

  let destination: string;
  let destinationComment: string;
  if (request.destinationInstance) {
    destination = `${request.destinationType}__${request.destinationInstance}`;
    destinationComment = `# Named destination: ${destination} (uses ${request.destinationType.toUpperCase()}_${request.destinationInstance.toUpperCase()}_* env vars)`;
  } else {
    destination = request.destinationType;
    destinationComment = "";
  }

  const desc =
    request.description ||
    `Load data from ${request.sourceType} to ${request.destinationType}`;

  const cfgJson = JSON.stringify(request.sourceConfiguration ?? {});

  return `"""dlt pipeline: ${escapePyString(request.name)}

${escapePyString(desc)}
"""

import dlt

def run(partition_key: str = None):
    """Run the pipeline. partition_key is reserved for incremental / scheduled runs."""
    ${destinationComment}
    pipeline = dlt.pipeline(
        pipeline_name="${escapePyString(request.name)}",
        destination="${escapePyString(destination)}",
        dataset_name="${escapePyString(datasetName)}",
    )

    # TODO: Configure your ${escapePyString(request.sourceType)} source
    # See documentation: https://dlthub.com/docs/dlt-ecosystem/verified-sources
    # Configuration (JSON): ${escapePyString(cfgJson)}

    # Example placeholder
    data = [{"id": 1, "partition": partition_key, "source": "${escapePyString(request.sourceType)}"}]

    info = pipeline.run(
        data,
        table_name="${escapePyString(request.sourceType)}_data",
        write_disposition="${escapePyString(request.writeDisposition ?? "append")}",
        loader_file_format="${escapePyString(request.fileFormat ?? "parquet")}"  # File format for file-based destinations
    )

    print(f"Pipeline completed: {info}")${dltDbtRunnerBeforeReturn(request)}
    return info

if __name__ == "__main__":
    import sys
    partition = sys.argv[1] if len(sys.argv) > 1 else None
    run(partition_key=partition)
`;
}
