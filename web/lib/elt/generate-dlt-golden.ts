import type { PipelineRequest } from "./types";
import { escapePyString } from "./escape-py";
import { dltDbtRunnerBeforeReturn } from "./generate-dlt-dbt-append";
import { postTransformBeforeReturn } from "./generate-post-transform";
import { eltpulsePythonModuleHeader } from "./codegen-branding";

function destinationBlock(request: PipelineRequest): {
  destination: string;
  destinationComment: string;
  datasetName: string;
} {
  let destination: string;
  let destinationComment: string;
  if (request.destinationInstance) {
    destination = `${request.destinationType}__${request.destinationInstance}`;
    destinationComment = `# Named destination: ${destination}`;
  } else {
    destination = request.destinationType;
    destinationComment = "";
  }
  const dest = request.destinationType.toLowerCase();
  if (dest === "snowflake") {
    destinationComment +=
      (destinationComment ? "\n    " : "") +
      "# Set DESTINATION__SNOWFLAKE__CREDENTIALS or SNOWFLAKE_* env vars";
  } else if (dest === "bigquery") {
    destinationComment +=
      (destinationComment ? "\n    " : "") + "# Set DESTINATION__BIGQUERY__CREDENTIALS (service account JSON)";
  } else if (dest === "duckdb") {
    destinationComment +=
      (destinationComment ? "\n    " : "") + "# DuckDB file path via DESTINATION__DUCKDB__CREDENTIALS";
  }
  const datasetName =
    request.schemaOverride ||
    `${request.sourceType}_data`.replace(/[^a-zA-Z0-9_]/g, "_");
  return { destination, destinationComment, datasetName };
}

/** Golden path: Stripe → any dlt destination (verified stripe source). */
export function generateStripePipeline(request: PipelineRequest): string {
  const config = request.sourceConfiguration;
  const startDate =
    typeof config.start_date === "string" && config.start_date.trim()
      ? config.start_date.trim()
      : typeof config.cursor_initial_value === "string" && config.cursor_initial_value.trim()
        ? config.cursor_initial_value.trim()
        : "2024-01-01";
  const rawKeyEnv = String(config.stripe_secret_key_env ?? "STRIPE_SECRET_KEY").trim();
  const keyEnv = /^[A-Z][A-Z0-9_]*$/i.test(rawKeyEnv) ? rawKeyEnv.toUpperCase() : "STRIPE_SECRET_KEY";
  const { destination, destinationComment, datasetName } = destinationBlock(request);
  const desc = request.description || `Load Stripe billing data to ${request.destinationType}`;

  return `${eltpulsePythonModuleHeader(request.name, desc)}

import os
import dlt
from stripe_analytics import stripe_source

def run(partition_key: str = None):
    ${destinationComment}
    api_key = os.environ.get("${escapePyString(keyEnv)}")
    if not api_key:
        raise RuntimeError("Set ${escapePyString(keyEnv)} for Stripe API access")

    start = partition_key or "${escapePyString(startDate)}"

    pipeline = dlt.pipeline(
        pipeline_name="${escapePyString(request.name)}",
        destination="${escapePyString(destination)}",
        dataset_name="${escapePyString(datasetName)}",
    )

    source = stripe_source(start_date=start, stripe_secret_key=api_key)
    info = pipeline.run(
        source,
        write_disposition="${escapePyString(request.writeDisposition ?? "append")}",
        loader_file_format="${escapePyString(request.fileFormat ?? "parquet")}",
    )
    print(f"Pipeline completed: {info}")${dltDbtRunnerBeforeReturn(request)}${postTransformBeforeReturn(request)}
    return info

if __name__ == "__main__":
    import sys
    partition = sys.argv[1] if len(sys.argv) > 1 else None
    run(partition_key=partition)
`;
}

/** Golden path: Postgres → warehouse via dlt sql_database (when tool=dlt). */
export function generatePostgresDltPipeline(request: PipelineRequest): string {
  const config = request.sourceConfiguration;
  const schema = typeof config.schema === "string" && config.schema.trim() ? config.schema.trim() : "public";
  const tablesRaw = typeof config.tables === "string" ? config.tables : "";
  const tables = tablesRaw
    ? tablesRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : ["users"];
  const tableList = tables.map((t) => `"${escapePyString(t)}"`).join(", ");
  const { destination, destinationComment, datasetName } = destinationBlock(request);
  const desc = request.description || `Replicate Postgres (${schema}) to ${request.destinationType}`;

  return `${eltpulsePythonModuleHeader(request.name, desc)}

import os
import dlt
from dlt.sources.sql_database import sql_database

def run(partition_key: str = None):
    ${destinationComment}
    creds = os.environ.get("SOURCES__SQL_DATABASE__CREDENTIALS") or os.environ.get("DATABASE_URL")
    if not creds:
        raise RuntimeError("Set SOURCES__SQL_DATABASE__CREDENTIALS or DATABASE_URL")

    pipeline = dlt.pipeline(
        pipeline_name="${escapePyString(request.name)}",
        destination="${escapePyString(destination)}",
        dataset_name="${escapePyString(datasetName)}",
    )

    source = sql_database(
        credentials=creds,
        schema="${escapePyString(schema)}",
        table_names=[${tableList}],
    )
    if partition_key and hasattr(source, "with_resources"):
        pass  # partition_key reserved for future slice filters

    info = pipeline.run(
        source,
        write_disposition="${escapePyString(request.writeDisposition ?? "append")}",
        loader_file_format="${escapePyString(request.fileFormat ?? "parquet")}",
    )
    print(f"Pipeline completed: {info}")${dltDbtRunnerBeforeReturn(request)}${postTransformBeforeReturn(request)}
    return info

if __name__ == "__main__":
    import sys
    partition = sys.argv[1] if len(sys.argv) > 1 else None
    run(partition_key=partition)
`;
}
