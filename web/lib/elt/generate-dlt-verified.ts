import type { PipelineRequest } from "./types";
import { escapePyString } from "./escape-py";
import { dltDbtRunnerBeforeReturn } from "./generate-dlt-dbt-append";
import { eltpulseReportLoadInfoPython } from "./generate-eltpulse-run-reporting";
import { postTransformBeforeReturn } from "./generate-post-transform";
import { eltpulsePythonModuleHeader } from "./codegen-branding";
import { resolveVerifiedSourceSpec, type VerifiedCredentialSpec } from "./verified-source-spec";

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

function pyResolveCredential(c: VerifiedCredentialSpec, varName: string): string {
  const keys = c.envKeys.map((k) => `"${escapePyString(k)}"`).join(", ");
  return `${varName} = next((os.environ.get(k) for k in [${keys}] if os.environ.get(k)), None)`;
}

export function generateVerifiedSourcePipeline(request: PipelineRequest): string {
  const spec = resolveVerifiedSourceSpec(request.sourceType);
  if (!spec) {
    throw new Error(`No verified source spec for ${request.sourceType}`);
  }

  const config = request.sourceConfiguration;
  const { destination, destinationComment, datasetName } = destinationBlock(request);
  const desc =
    request.description || `Load ${request.sourceType} data to ${request.destinationType}`;

  const credLines: string[] = [];
  const credChecks: string[] = [];
  const kwargLines: string[] = [];

  spec.credentials.forEach((c, i) => {
    const varName = `_cred_${i}`;
    credLines.push(`    ${pyResolveCredential(c, varName)}`);
    credChecks.push(
      `    if not ${varName}:\n        raise RuntimeError("Missing credential for ${escapePyString(c.param)} — set one of: ${c.envKeys.join(", ")}")`
    );
    kwargLines.push(`        ${escapePyString(c.param)}=${varName},`);
  });

  for (const key of spec.configKeys ?? []) {
    const raw = config[key];
    if (raw === undefined || raw === null || raw === "") continue;
    if (typeof raw === "string") {
      kwargLines.push(`        ${escapePyString(key)}="${escapePyString(raw)}",`);
    } else if (typeof raw === "number" || typeof raw === "boolean") {
      kwargLines.push(`        ${escapePyString(key)}=${raw},`);
    } else if (Array.isArray(raw)) {
      const items = raw.map((x) => `"${escapePyString(String(x))}"`).join(", ");
      kwargLines.push(`        ${escapePyString(key)}=[${items}],`);
    } else {
      kwargLines.push(`        ${escapePyString(key)}=${JSON.stringify(raw)},`);
    }
  }

  let resourceBlock = "";
  if (spec.resourceConfigKey) {
    const raw = config[spec.resourceConfigKey];
    const resources = Array.isArray(raw)
      ? raw
      : typeof raw === "string"
        ? raw.split(",").map((x) => x.trim()).filter(Boolean)
        : spec.defaultResources ?? [];
    if (resources.length) {
      const resourceList = resources.map((r) => `"${escapePyString(String(r))}"`).join(", ");
      resourceBlock = `
    resources_to_load = [${resourceList}]
    source = source.with_resources(*resources_to_load)`;
    }
  }

  const partitionBlock = spec.partitionKwarg
    ? `
    if partition_key:
        source_kwargs["${escapePyString(spec.partitionKwarg)}"] = partition_key`
    : "";

  return `${eltpulsePythonModuleHeader(request.name, desc)}

import os
import dlt
from ${spec.module} import ${spec.factory}

def run(partition_key: str = None):
    ${destinationComment}
${credLines.join("\n")}
${credChecks.join("\n")}

    pipeline = dlt.pipeline(
        pipeline_name="${escapePyString(request.name)}",
        destination="${escapePyString(destination)}",
        dataset_name="${escapePyString(datasetName)}",
    )

    source_kwargs = dict(
${kwargLines.join("\n")}
    )${partitionBlock}

    source = ${spec.factory}(**source_kwargs)${resourceBlock}

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
