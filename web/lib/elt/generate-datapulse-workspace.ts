import YAML from "yaml";
import type { PipelineRequest } from "./types";
import { DATAPULSE_REPO, pipelineModuleSegment } from "./datapulse-repo-layout";

/**
 * YAML fragment stored alongside generated pipeline code — DataPulse workspace metadata only.
 */
export function generateDatapulseWorkspaceYaml(request: PipelineRequest): string {
  const mod = pipelineModuleSegment(request.name);
  const relPath = `${DATAPULSE_REPO.pipelinesDir}/${request.name}/`;

  const metadata: Record<string, unknown> = {
    pipeline_name: request.name,
  };
  if (request.description) metadata.description = request.description;
  if (request.groupName) metadata.group = request.groupName;
  if (request.owners?.length) metadata.owners = request.owners;
  if (request.tags && Object.keys(request.tags).length) metadata.tags = request.tags;
  if (request.kinds?.length) metadata.kinds = request.kinds;

  const scheduling: Record<string, unknown> = {
    enabled: Boolean(request.scheduleEnabled && request.cronSchedule),
  };
  if (request.scheduleEnabled && request.cronSchedule) {
    scheduling.cron_schedule = request.cronSchedule;
    scheduling.timezone = request.timezone ?? "UTC";
  }

  const quality: Record<string, unknown> = {};
  if (request.tests?.length) {
    quality.tests = request.tests;
  }

  const triggers: Record<string, unknown> = {};
  if (request.sensors?.length) triggers.sensors = request.sensors;
  if (request.partitionsNote) triggers.partitions_note = request.partitionsNote;
  if (request.otherNotes) triggers.other_notes = request.otherNotes;

  const doc: Record<string, unknown> = {
    datapulse_version: 1,
    kind: "workspace_fragment",
    orchestration: {
      engine: "datapulse",
    },
    metadata,
    definitions: {
      code_location: {
        type: "python_module",
        module: `datapulse.pipelines.${mod}`,
        entrypoint: "run",
        relative_path: relPath,
      },
    },
    scheduling,
    ...(Object.keys(quality).length ? { quality } : {}),
    ...(Object.keys(triggers).length ? { triggers } : {}),
    resilience: {
      max_retries: request.retries ?? 2,
      delay_seconds: request.retryDelay ?? 30,
    },
    resources: {},
  };

  const header =
    "# DataPulse workspace manifest (v1)\n" +
    "# Describes how this pipeline fits in a managed DataPulse repository layout.\n\n";

  return header + YAML.stringify(doc);
}
