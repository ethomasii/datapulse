import type { PipelineRequest } from "./types";
import { escapePyString } from "./escape-py";
import { dltDbtRunnerBeforeReturn } from "./generate-dlt-dbt-append";
import { eltpulseReportLoadInfoPython } from "./generate-eltpulse-run-reporting";
import { postTransformBeforeReturn } from "./generate-post-transform";
import { eltpulsePythonModuleHeader } from "./codegen-branding";

const CONTEXT_REST_SLUGS = new Set(["intercom", "mixpanel", "segment"]);

export function isContextRestSource(sourceType: string): boolean {
  return CONTEXT_REST_SLUGS.has(sourceType.toLowerCase().trim());
}

function destinationBlock(request: PipelineRequest) {
  let destination: string;
  let destinationComment: string;
  if (request.destinationInstance) {
    destination = `${request.destinationType}__${request.destinationInstance}`;
    destinationComment = `# Named destination: ${destination}`;
  } else {
    destination = request.destinationType;
    destinationComment = "";
  }
  const datasetName =
    request.schemaOverride || `${request.sourceType}_data`.replace(/[^a-zA-Z0-9_]/g, "_");
  return { destination, destinationComment, datasetName };
}

/** Override REST incremental bounds when partition_key is a day slice. */
function partitionOverrideBlock(): string {
  return `
    if partition_key:
        from datetime import date, timedelta
        pk = partition_key.strip()
        end_val = None
        if len(pk) >= 10 and pk[4:5] == "-" and pk[7:8] == "-":
            try:
                _day = date.fromisoformat(pk[:10])
                end_val = (_day + timedelta(days=1)).isoformat()
            except ValueError:
                pass
        for res in config.get("resources") or []:
            if not isinstance(res, dict):
                continue
            endpoint = res.setdefault("endpoint", {})
            inc = endpoint.get("incremental")
            if isinstance(inc, dict):
                inc["initial_value"] = pk if "T" in pk else f"{pk[:10]}T00:00:00Z"
                if end_val:
                    inc["end_value"] = f"{end_val}T00:00:00Z" if "T" not in end_val else end_val`;
}

function intercomBody(request: PipelineRequest): string {
  const config = request.sourceConfiguration;
  const region = String(config.region ?? "us").toLowerCase();
  const baseUrl =
    region === "eu"
      ? "https://api.eu.intercom.io"
      : region === "au"
        ? "https://api.au.intercom.io"
        : "https://api.intercom.io";

  return `
    access_token = (
        os.environ.get("INTERCOM_ACCESS_TOKEN")
        or os.environ.get("SOURCES__INTERCOM__ACCESS_TOKEN")
    )
    if not access_token:
        raise RuntimeError("Missing INTERCOM_ACCESS_TOKEN for Intercom source.")

    config = {
        "client": {
            "base_url": "${escapePyString(baseUrl)}",
            "auth": {"type": "bearer", "token": access_token},
        },
        "resource_defaults": {
            "primary_key": "id",
            "write_disposition": "merge",
        },
        "resources": [
            {
                "name": "contacts",
                "endpoint": {
                    "path": "contacts",
                    "params": {"per_page": 150},
                    "incremental": {
                        "cursor_path": "updated_at",
                        "initial_value": "2020-01-01T00:00:00Z",
                    },
                },
            },
            {
                "name": "conversations",
                "endpoint": {
                    "path": "conversations",
                    "params": {"per_page": 150},
                    "incremental": {
                        "cursor_path": "updated_at",
                        "initial_value": "2020-01-01T00:00:00Z",
                    },
                },
            },
        ],
    }
${partitionOverrideBlock()}
    source = rest_api_source(config)`;
}

function mixpanelBody(request: PipelineRequest): string {
  const config = request.sourceConfiguration;
  const projectId = String(config.project_id ?? config.mixpanel_project_id ?? "").trim();

  return `
    api_secret = (
        os.environ.get("MIXPANEL_API_SECRET")
        or os.environ.get("MIXPANEL_SECRET")
        or os.environ.get("SOURCES__MIXPANEL__API_SECRET")
    )
    if not api_secret:
        raise RuntimeError("Missing MIXPANEL_API_SECRET for Mixpanel export.")

    project_id = "${escapePyString(projectId)}" or os.environ.get("MIXPANEL_PROJECT_ID")
    if not project_id:
        raise RuntimeError("Set mixpanel project_id in pipeline config or MIXPANEL_PROJECT_ID env.")

    from_date = None
    to_date = None
    if partition_key:
        pk = partition_key.strip()
        if len(pk) >= 10:
            from_date = pk[:10]
            to_date = pk[:10]

    @dlt.resource(name="events", write_disposition="append", primary_key="insert_id")
    def mixpanel_events():
        import json
        from dlt.sources.helpers import requests as dlt_requests
        params = {"project_id": project_id}
        if from_date:
            params["from_date"] = from_date
        if to_date:
            params["to_date"] = to_date
        url = "https://data.mixpanel.com/api/2.0/export/"
        with dlt_requests.get(url, params=params, auth=(api_secret, ""), stream=True) as resp:
            resp.raise_for_status()
            batch = []
            for line in resp.iter_lines(decode_unicode=True):
                if not line:
                    continue
                batch.append(json.loads(line))
                if len(batch) >= 500:
                    yield batch
                    batch = []
            if batch:
                yield batch

    source = mixpanel_events()`;
}

function segmentBody(): string {
  return `
    access_token = (
        os.environ.get("SEGMENT_ACCESS_TOKEN")
        or os.environ.get("SEGMENT_API_TOKEN")
        or os.environ.get("SOURCES__SEGMENT__ACCESS_TOKEN")
    )
    if not access_token:
        raise RuntimeError(
            "Missing SEGMENT_ACCESS_TOKEN. Segment Config API requires a workspace token "
            "(not the write key used for event ingestion)."
        )

    config = {
        "client": {
            "base_url": "https://api.segmentapis.com",
            "auth": {"type": "bearer", "token": access_token},
        },
        "resource_defaults": {
            "primary_key": "name",
            "write_disposition": "replace",
        },
        "resources": [
            {
                "name": "sources",
                "endpoint": {
                    "path": "sources",
                    "data_selector": "data.sources",
                },
            },
            {
                "name": "destinations",
                "endpoint": {
                    "path": "destinations",
                    "data_selector": "data.destinations",
                },
            },
        ],
    }
    source = rest_api_source(config)`;
}

/** dlt rest_api pipelines for catalog context sources (Intercom, Mixpanel, Segment). */
export function generateContextRestPipeline(request: PipelineRequest): string {
  const slug = request.sourceType.toLowerCase().trim();
  const { destination, destinationComment, datasetName } = destinationBlock(request);
  const desc =
    request.description || `Load ${slug} data to ${request.destinationType}`;

  let body: string;
  let imports: string;
  if (slug === "intercom") {
    imports = "from dlt.sources.rest_api import rest_api_source";
    body = intercomBody(request);
  } else if (slug === "mixpanel") {
    imports = "import dlt";
    body = mixpanelBody(request);
  } else if (slug === "segment") {
    imports = "from dlt.sources.rest_api import rest_api_source";
    body = segmentBody();
  } else {
    throw new Error(`Unknown context REST source: ${slug}`);
  }

  const partitionNote =
    slug === "mixpanel"
      ? "partition_key sets Mixpanel export from_date / to_date for day slices."
      : slug === "intercom"
        ? "partition_key scopes REST incremental initial_value / end_value on updated_at."
        : "Segment Config API sync — full catalog replace (no date slice filter).";

  return `${eltpulsePythonModuleHeader(request.name, desc)}

import os
import dlt
${imports}

def run(partition_key: str = None):
    # ${partitionNote}
    ${destinationComment}
    pipeline = dlt.pipeline(
        pipeline_name="${escapePyString(request.name)}",
        destination="${escapePyString(destination)}",
        dataset_name="${escapePyString(datasetName)}",
    )

${body}

    info = pipeline.run(
        source,
        write_disposition="${escapePyString(request.writeDisposition ?? "append")}",
        loader_file_format="${escapePyString(request.fileFormat ?? "parquet")}",
    )
    print(f"Pipeline completed: {info}")${eltpulseReportLoadInfoPython("info")}${dltDbtRunnerBeforeReturn(request)}${postTransformBeforeReturn(request)}
    return info

if __name__ == "__main__":
    import sys
    partition = sys.argv[1] if len(sys.argv) > 1 else None
    run(partition_key=partition)
`;
}
