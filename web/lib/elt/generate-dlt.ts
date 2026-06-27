import type { PipelineRequest } from "./types";
import { escapePyString } from "./escape-py";
import { dltDbtRunnerBeforeReturn } from "./generate-dlt-dbt-append";
import { eltpulseReportLoadInfoPython } from "./generate-eltpulse-run-reporting";
import { postTransformBeforeReturn } from "./generate-post-transform";
import { generateRestApiAdvanced, generateRestApiPipeline } from "./generate-dlt-rest";
import { generatePostgresDltPipeline, generateStripePipeline } from "./generate-dlt-golden";
import { generateVerifiedSourcePipeline } from "./generate-dlt-verified";
import { isVerifiedPackageSource } from "./verified-source-spec";
import { eltpulsePythonModuleHeader, ELTPULSE_PIPELINES_DOCS } from "./codegen-branding";
import {
  normalizeGithubResources,
  partitionGithubResources,
  resolveGithubMaxItems,
} from "./github-dlt-resources";

// SWC/webpack misparses Python triple-quotes inside JS template literals.
// Use this constant so the parser never sees `"""` as a literal in source.
const PY3Q = '"""';

export function generateDltPipeline(request: PipelineRequest): string {
  const { sourceType } = request;
  if (sourceType === "github") return generateGithubPipeline(request);
  if (sourceType === "stripe" || sourceType === "stripe_analytics") return generateStripePipeline(request);
  if (sourceType === "postgres" || sourceType === "postgresql") return generatePostgresDltPipeline(request);
  if (isVerifiedPackageSource(sourceType)) return generateVerifiedSourcePipeline(request);
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
  const resources = normalizeGithubResources(config.resources);
  const { reactions, repoEvents, stargazers } = partitionGithubResources(resources);
  const reactionsList = reactions.map((r) => `"${escapePyString(r)}"`).join(", ");
  const rawTokenEnv = String(config.github_token_env ?? "GITHUB_TOKEN").trim() || "GITHUB_TOKEN";
  const tokenEnv = /^[A-Z][A-Z0-9_]*$/i.test(rawTokenEnv) ? rawTokenEnv.toUpperCase() : "GITHUB_TOKEN";
  const itemsPerPage =
    typeof config.items_per_page === "number" && config.items_per_page > 0
      ? Math.min(100, Math.floor(config.items_per_page))
      : 100;
  const maxItems = resolveGithubMaxItems(config);
  const maxItemsPy = maxItems > 0 ? String(maxItems) : "None";
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

  const runBlocks: string[] = [];
  if (reactions.length > 0) {
    runBlocks.push(`    reactions_resources = [${reactionsList}]
    if reactions_resources:
        source = github_reactions(**source_kwargs).with_resources(*reactions_resources)
        last_info = pipeline.run(source, **run_kwargs)`);
  }
  if (repoEvents) {
    runBlocks.push(`    source = github_repo_events(
        owner="${escapePyString(repoOwner)}",
        name="${escapePyString(repoName)}",
        access_token=github_token,
    )
    last_info = pipeline.run(source, **run_kwargs)`);
  }
  if (stargazers) {
    runBlocks.push(`    source = github_stargazers(**source_kwargs)
    last_info = pipeline.run(source, **run_kwargs)`);
  }

  return `${eltpulsePythonModuleHeader(request.name, desc)}

import os
import dlt
from github import github_reactions, github_repo_events, github_stargazers

def run(partition_key: str = None):
    # partition_key: optional ISO date string, e.g. 2024-01-01
    # When provided it is passed as the 'since' arg to github_reactions so only items
    # updated on or after that date are fetched (date-based incremental load).

    # Resolve the GitHub PAT from the linked source connection (GITHUB_TOKEN env var)
    github_token = (
        os.environ.get("${escapePyString(tokenEnv)}")
        or os.environ.get("GITHUB_TOKEN")
        or os.environ.get("SOURCES__GITHUB__ACCESS_TOKEN")
    )
    if not github_token:
        raise RuntimeError(
            "Missing GitHub token. Link a GitHub source connection with GITHUB_TOKEN in the builder."
        )

    # Configure the pipeline
    ${destinationComment}
    pipeline = dlt.pipeline(
        pipeline_name="${escapePyString(request.name)}",
        destination="${escapePyString(destination)}",
        dataset_name="${escapePyString(datasetName)}",
    )

    # Shared kwargs for GraphQL-based verified sources
    source_kwargs = dict(
        owner="${escapePyString(repoOwner)}",
        name="${escapePyString(repoName)}",
        items_per_page=${itemsPerPage},
        max_items=${maxItemsPy},  # None = unlimited; default cap avoids GraphQL 403 on large repos
        access_token=github_token,
    )

    run_kwargs = dict(
        write_disposition="${escapePyString(request.writeDisposition ?? "append")}",
        loader_file_format="${escapePyString(request.fileFormat ?? "parquet")}",
    )

    last_info = None
${runBlocks.join("\n\n")}

    if last_info is None:
        raise RuntimeError("No GitHub resources selected for load.")

    print(f"Pipeline completed: {last_info}")${eltpulseReportLoadInfoPython("last_info")}${dltDbtRunnerBeforeReturn(request)}${postTransformBeforeReturn(request)}
    return last_info

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

  return `${eltpulsePythonModuleHeader(request.name, desc)}

import dlt

def run(partition_key: str = None):
    ${PY3Q}Run the pipeline. partition_key is reserved for incremental / scheduled runs.${PY3Q}
    ${destinationComment}
    pipeline = dlt.pipeline(
        pipeline_name="${escapePyString(request.name)}",
        destination="${escapePyString(destination)}",
        dataset_name="${escapePyString(datasetName)}",
    )

    # TODO: Configure your ${escapePyString(request.sourceType)} source
    # See eltPulse connector docs: ${ELTPULSE_PIPELINES_DOCS}
    # Configuration (JSON): ${escapePyString(cfgJson)}

    # Example placeholder
    data = [{"id": 1, "partition": partition_key, "source": "${escapePyString(request.sourceType)}"}]

    print("[eltpulse] phase:extract", flush=True)
    print("[eltpulse] phase:load", flush=True)
    info = pipeline.run(
        data,
        table_name="${escapePyString(request.sourceType)}_data",
        write_disposition="${escapePyString(request.writeDisposition ?? "append")}",
        loader_file_format="${escapePyString(request.fileFormat ?? "parquet")}"  # File format for file-based destinations
    )

    print(f"Pipeline completed: {info}")${eltpulseReportLoadInfoPython("info")}${dltDbtRunnerBeforeReturn(request)}${postTransformBeforeReturn(request)}
    return info

if __name__ == "__main__":
    import sys
    partition = sys.argv[1] if len(sys.argv) > 1 else None
    run(partition_key=partition)
`;
}
