import type { PipelineRequest } from "./types";
import { escapePyString } from "./escape-py";
import { dltDbtRunnerBeforeReturn } from "./generate-dlt-dbt-append";
import { eltpulseReportLoadInfoPython } from "./generate-eltpulse-run-reporting";
import { postTransformBeforeReturn } from "./generate-post-transform";
import { eltpulsePythonModuleHeader } from "./codegen-branding";

const STORAGE_SLUGS = new Set(["s3", "gcs", "azure_blob", "csv", "json", "parquet"]);

export function isFilesystemSource(sourceType: string): boolean {
  return STORAGE_SLUGS.has(sourceType.toLowerCase().trim());
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

function readerForFormat(format: string): string {
  const f = format.toLowerCase().trim();
  if (f === "json" || f === "jsonl") return "read_jsonl";
  if (f === "parquet") return "read_parquet";
  return "read_csv";
}

function globForFormat(format: string): string {
  const f = format.toLowerCase().trim();
  if (f === "json" || f === "jsonl") return "**/*.json";
  if (f === "parquet") return "**/*.parquet";
  return "**/*.csv";
}

/** dlt filesystem source for object storage and local file paths. */
export function generateFilesystemPipeline(request: PipelineRequest): string {
  const config = request.sourceConfiguration;
  const sourceType = request.sourceType.toLowerCase().trim();
  const { destination, destinationComment, datasetName } = destinationBlock(request);
  const desc =
    request.description || `Load ${sourceType} files to ${request.destinationType}`;

  const fileFormat = String(config.file_format ?? config.format ?? "csv").trim() || "csv";
  const readerFn = readerForFormat(fileFormat);
  const defaultGlob = globForFormat(fileFormat);

  let locationSetup: string;
  if (sourceType === "s3") {
    const bucket = String(config.bucket ?? "YOUR_BUCKET");
    const prefix = String(config.prefix ?? config.path ?? "").replace(/^\/+|\/+$/g, "");
    locationSetup = `    bucket = "${escapePyString(bucket)}"
    prefix = "${escapePyString(prefix)}"
    base = "s3://" + bucket + "/" + (prefix + "/" if prefix else "")
    bucket_url = base.rstrip("/") + "/" + partition_key.strip() + "/" if partition_key else base
    file_glob = "${escapePyString(defaultGlob)}"`;
  } else if (sourceType === "gcs") {
    const bucket = String(config.bucket ?? "YOUR_BUCKET");
    const prefix = String(config.prefix ?? config.path ?? "").replace(/^\/+|\/+$/g, "");
    locationSetup = `    bucket = "${escapePyString(bucket)}"
    prefix = "${escapePyString(prefix)}"
    base = "gs://" + bucket + "/" + (prefix + "/" if prefix else "")
    bucket_url = base.rstrip("/") + "/" + partition_key.strip() + "/" if partition_key else base
    file_glob = "${escapePyString(defaultGlob)}"`;
  } else if (sourceType === "azure_blob") {
    const container = String(config.container ?? config.bucket ?? "YOUR_CONTAINER");
    const prefix = String(config.prefix ?? config.path ?? "").replace(/^\/+|\/+$/g, "");
    locationSetup = `    container = "${escapePyString(container)}"
    prefix = "${escapePyString(prefix)}"
    base = "az://" + container + "/" + (prefix + "/" if prefix else "")
    bucket_url = base.rstrip("/") + "/" + partition_key.strip() + "/" if partition_key else base
    file_glob = "${escapePyString(defaultGlob)}"`;
  } else if (sourceType === "csv") {
    const filePath = String(config.file_path ?? "/path/to/data.csv");
    const dir = filePath.replace(/\\/g, "/").replace(/\/[^/]+$/, "") || ".";
    const baseName = filePath.split(/[/\\]/).pop() ?? "*.csv";
    locationSetup = `    bucket_url = "${escapePyString(dir)}"
    file_glob = ("*" + partition_key.strip() + "*.csv") if partition_key else "${escapePyString(baseName)}"`;
  } else if (sourceType === "json") {
    const filePath = String(config.file_path ?? "/path/to/data.json");
    const dir = filePath.replace(/\\/g, "/").replace(/\/[^/]+$/, "") || ".";
    const baseName = filePath.split(/[/\\]/).pop() ?? "*.json";
    locationSetup = `    bucket_url = "${escapePyString(dir)}"
    file_glob = ("*" + partition_key.strip() + "*.json") if partition_key else "${escapePyString(baseName)}"`;
  } else {
    const filePath = String(config.file_path ?? "/path/to/data.parquet");
    const dir = filePath.replace(/\\/g, "/").replace(/\/[^/]+$/, "") || ".";
    const baseName = filePath.split(/[/\\]/).pop() ?? "*.parquet";
    locationSetup = `    bucket_url = "${escapePyString(dir)}"
    file_glob = ("*" + partition_key.strip() + "*") if partition_key else "${escapePyString(baseName)}"`;
  }

  return `${eltpulsePythonModuleHeader(request.name, desc)}

import dlt
from dlt.sources.filesystem import filesystem, ${readerFn}

def run(partition_key: str = None):
    # partition_key: path prefix (S3/GCS/azure) or filename glob segment (local csv/json/parquet).
    ${destinationComment}
    pipeline = dlt.pipeline(
        pipeline_name="${escapePyString(request.name)}",
        destination="${escapePyString(destination)}",
        dataset_name="${escapePyString(datasetName)}",
    )

${locationSetup}

    files = filesystem(bucket_url=bucket_url, file_glob=file_glob)
    source = ${readerFn}(files)

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
