import YAML from "yaml";
import { stripCanvasFromSourceConfig } from "./canvas-source-config";
import { chooseTool } from "./choose-tool";
import { generateDltPipeline } from "./generate-dlt";
import { generateSlingReplication, slingReplicationToYaml } from "./generate-sling";
import { generateDatapulseWorkspaceYaml } from "./generate-datapulse-workspace";
import { normalizeSourceConfigurationForCodegen } from "./normalize-source-configuration";
import type { CreatePipelineBody, PipelineRequest } from "./types";

function parseEltLines(c: Record<string, unknown>, key: string): string[] {
  const v = c[key];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v.split("\n").map((l) => l.trim()).filter(Boolean);
  }
  return [];
}

function bodyToRequest(body: CreatePipelineBody): PipelineRequest {
  const c = body.sourceConfiguration ?? {};
  const stripped = stripCanvasFromSourceConfig(c as Record<string, unknown>);
  const cCodegen = normalizeSourceConfigurationForCodegen(body.sourceType, stripped);
  const tests = parseEltLines(cCodegen, "elt_tests");
  const sensors = parseEltLines(cCodegen, "elt_sensors");
  const cronScheduleRaw = cCodegen.cron_schedule ?? cCodegen["cronSchedule"];
  const cron = typeof cronScheduleRaw === "string" ? cronScheduleRaw : null;
  const tzRaw = cCodegen.schedule_timezone ?? cCodegen.timezone;
  const tz = typeof tzRaw === "string" ? tzRaw : "UTC";
  const partitionsRaw = cCodegen["elt_partitions_note"];
  const otherRaw = cCodegen["elt_other_notes"];

  return {
    name: body.name,
    sourceType: body.sourceType,
    destinationType: body.destinationType,
    sourceConfiguration: cCodegen,
    description: body.description ?? null,
    groupName: body.groupName ?? null,
    writeDisposition: "append",
    fileFormat: "parquet",
    timezone: tz,
    retries: 2,
    retryDelay: 30,
    schemaOverride: typeof cCodegen.schema_override === "string" ? cCodegen.schema_override : null,
    destinationInstance: typeof cCodegen.destination_instance === "string" ? cCodegen.destination_instance : null,
    incrementalEnabled: Boolean(cCodegen.incremental_enabled),
    cursorField: typeof cCodegen.cursor_field === "string" ? cCodegen.cursor_field : undefined,
    cursorInitialValue: typeof cCodegen.cursor_initial_value === "string" ? cCodegen.cursor_initial_value : undefined,
    scheduleEnabled: Boolean(cCodegen.schedule_enabled ?? cCodegen["scheduleEnabled"]),
    cronSchedule: cron,
    tests: tests.length ? tests : undefined,
    sensors: sensors.length ? sensors : undefined,
    partitionsNote:
      typeof partitionsRaw === "string" && partitionsRaw.trim() ? partitionsRaw.trim() : null,
    otherNotes: typeof otherRaw === "string" && otherRaw.trim() ? otherRaw.trim() : null,
  };
}

export function resolveTool(body: CreatePipelineBody): "dlt" | "sling" {
  if (body.tool === "dlt" || body.tool === "sling") return body.tool;
  return chooseTool(body.sourceType, body.destinationType);
}

export function generatePipelineArtifacts(body: CreatePipelineBody) {
  const tool = resolveTool(body);
  const req = bodyToRequest(body);

  if (tool === "dlt") {
    const pipelineCode = generateDltPipeline(req);
    const configData: Record<string, unknown> = {
      source_type: req.sourceType,
      destination_type: req.destinationType,
      tool: "dlt",
      configuration: req.sourceConfiguration,
    };
    const configYaml = YAML.stringify(configData);
    const workspaceYaml = generateDatapulseWorkspaceYaml(req);
    return { tool: "dlt" as const, pipelineCode, configYaml, workspaceYaml };
  }

  const replication = generateSlingReplication(req);
  const pipelineCode = slingReplicationToYaml(replication);
  const configData: Record<string, unknown> = {
    source_type: req.sourceType,
    destination_type: req.destinationType,
    tool: "sling",
    configuration: req.sourceConfiguration,
  };
  const configYaml = YAML.stringify(configData);
  const workspaceYaml = generateDatapulseWorkspaceYaml(req);
  return { tool: "sling" as const, pipelineCode, configYaml, workspaceYaml };
}
