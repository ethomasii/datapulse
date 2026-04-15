import type { PipelineRequest } from "./types";
import { escapePyString } from "./escape-py";
import { dltDbtRunnerBeforeReturn } from "./generate-dlt-dbt-append";

// SWC/webpack misparses Python triple-quotes inside JS template literals.
const PY3Q = '"""';

function destinationParts(request: PipelineRequest): { destination: string; destinationComment: string } {
  if (request.destinationInstance) {
    const destination = `${request.destinationType}__${request.destinationInstance}`;
    const destinationComment = `# Named destination: ${destination} (uses ${request.destinationType.toUpperCase()}_${request.destinationInstance.toUpperCase()}_* env vars)`;
    return { destination, destinationComment };
  }
  return { destination: request.destinationType, destinationComment: "" };
}

/** dlt `rest_api` source — simple mode (matches Python `_generate_rest_api_pipeline`). */
export function generateRestApiPipeline(request: PipelineRequest): string {
  const config = request.sourceConfiguration;
  const baseUrl = String(config.base_url ?? "https://api.example.com");
  const resourceName = String(config.resource_name ?? "data");
  const endpoint = String(config.endpoint ?? "/data");
  const httpMethod = String(config.http_method ?? "GET");
  const paginationType = String(config.pagination_type ?? "auto");
  const dataSelector = String(config.data_selector ?? "");

  const datasetName =
    request.schemaOverride || `${resourceName.replace(/[^a-zA-Z0-9_]/g, "_")}_data`;

  const { destination, destinationComment } = destinationParts(request);

  let paginatorCode: string;
  if (paginationType === "none") {
    paginatorCode = '"paginator": None';
  } else if (paginationType === "offset") {
    paginatorCode = `"paginator": dlt.sources.helpers.rest_client.paginators.OffsetPaginator(
        limit=100,
        offset_param="offset",
        limit_param="limit"
    )`;
  } else if (paginationType === "cursor" || paginationType === "json_link") {
    paginatorCode = `"paginator": dlt.sources.helpers.rest_client.paginators.JSONLinkPaginator(
        next_url_path="next"
    )`;
  } else {
    paginatorCode = '"paginator": "auto"';
  }

  const dataSelectorCode = dataSelector
    ? `"data_selector": "${escapePyString(dataSelector)}"`
    : '"data_selector": None';

  let incrementalBlock = "";
  if (request.incrementalEnabled && request.cursorField) {
    const iv = request.cursorInitialValue
      ? `"${escapePyString(request.cursorInitialValue)}"`
      : "None";
    incrementalBlock = `
                "incremental": {
                    "cursor_path": "${escapePyString(request.cursorField)}",
                    "initial_value": ${iv},
                },`;
  }

  const desc =
    request.description || `Load data from REST API to ${request.destinationType}`;

  const incNote = request.incrementalEnabled
    ? "\n\nThis pipeline uses incremental loading with partition-style runs (cursor / time windows)."
    : "";

  return `${PY3Q}dlt pipeline: ${escapePyString(request.name)}

${escapePyString(desc)}${incNote}
${PY3Q}

import dlt
from dlt.sources.rest_api import rest_api_source

def run(partition_key: str = None):
    # partition_key: optional slice value passed by the scheduler or backfill launcher.
    # It is injected as a query parameter below -- adapt the param name to match your API
    # (common names: since, from, start_date, cursor, date, customer_id, region).

    # Configure the pipeline
    ${destinationComment}
    pipeline = dlt.pipeline(
        pipeline_name="${escapePyString(request.name)}",
        destination="${escapePyString(destination)}",
        dataset_name="${escapePyString(datasetName)}",
    )

    # Build endpoint params -- inject partition_key when present
    endpoint_params = {}
    if partition_key:
        # TODO: rename "since" to whatever query param your API uses for date/key filtering
        endpoint_params["since"] = partition_key

    # Configure REST API source
    source = rest_api_source({
        "client": {
            "base_url": "${escapePyString(baseUrl)}",
        },
        "resources": [
            {
                "name": "${escapePyString(resourceName)}",
                "endpoint": {
                    "path": "${escapePyString(endpoint)}",
                    "method": "${escapePyString(httpMethod)}",
                    "params": endpoint_params,
                },${incrementalBlock}
                ${paginatorCode},
                ${dataSelectorCode}
            }
        ]
    })

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

/** Advanced mode: `advanced_config` JSON embedded via base64 decode (robust vs quoting). */
export function generateRestApiAdvanced(request: PipelineRequest): string {
  const config = request.sourceConfiguration;
  let advanced: Record<string, unknown>;
  try {
    const raw = config.advanced_config;
    if (typeof raw === "string") {
      advanced = JSON.parse(raw) as Record<string, unknown>;
    } else if (raw && typeof raw === "object") {
      advanced = raw as Record<string, unknown>;
    } else {
      return generateRestApiPipeline(request);
    }
  } catch {
    return generateRestApiPipeline(request);
  }

  const resourceName =
    (Array.isArray(advanced.resources) && advanced.resources[0] && typeof advanced.resources[0] === "object"
      ? (advanced.resources[0] as { name?: string }).name
      : undefined) ||
    String(config.resource_name ?? "data");

  const datasetName = request.schemaOverride || `${String(resourceName).replace(/[^a-zA-Z0-9_]/g, "_")}_data`;
  const { destination, destinationComment } = destinationParts(request);

  const desc = request.description || `Load data from REST API to ${request.destinationType}`;
  const payload = JSON.stringify(advanced);
  const b64 = Buffer.from(payload, "utf8").toString("base64");

  return `${PY3Q}dlt pipeline: ${escapePyString(request.name)}

${escapePyString(desc)}
${PY3Q}

import base64
import json
import dlt
from dlt.sources.rest_api import rest_api_source

def run(partition_key: str = None):
    # partition_key: optional slice value (date, key, etc.) injected by the scheduler or backfill.
    # The advanced config is loaded from base64 below -- add your own param injection after
    # decoding if you need to pass partition_key into the API request.

    # Configure the pipeline
    ${destinationComment}
    pipeline = dlt.pipeline(
        pipeline_name="${escapePyString(request.name)}",
        destination="${escapePyString(destination)}",
        dataset_name="${escapePyString(datasetName)}",
    )

    # REST API configuration (advanced mode) -- decoded from eltPulse UI JSON
    config = json.loads(base64.b64decode("${b64}").decode("utf-8"))

    # TODO: if you want partition_key to filter the request, inject it here, e.g.:
    # if partition_key and config.get("resources"):
    #     config["resources"][0].setdefault("endpoint", {}).setdefault("params", {})["since"] = partition_key

    source = rest_api_source(config)

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
