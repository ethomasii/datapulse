import YAML from "yaml";
import { stripCanvasFromSourceConfig } from "./canvas-source-config";
import { chooseTool } from "./choose-tool";
import { applyDestinationCodegenHints } from "./destination-codegen-hints";
import { compilePipelineComponentsAsync } from "./native-components/compile-pipeline-components";
import { generateDltPipeline } from "./generate-dlt";
import { generateSlingReplication, slingReplicationToYaml } from "./generate-sling";
import { generateEltpulseWorkspaceYaml } from "./generate-eltpulse-workspace";
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

async function bodyToRequest(
  body: CreatePipelineBody,
  options?: { workspaceCatalogUrls?: string[] | null }
): Promise<PipelineRequest> {
  const c = body.sourceConfiguration ?? {};
  const { config: compiledConfig } = await compilePipelineComponentsAsync(c as Record<string, unknown>, {
    workspaceCatalogUrls: options?.workspaceCatalogUrls,
  });
  const stripped = stripCanvasFromSourceConfig(compiledConfig);
  const cCodegen = normalizeSourceConfigurationForCodegen(body.sourceType, stripped);
  const destResolved = applyDestinationCodegenHints(body.destinationType, cCodegen);
  const tests = parseEltLines(destResolved.config, "elt_tests");
  const sensors = parseEltLines(destResolved.config, "elt_sensors");
  const cronScheduleRaw = destResolved.config.cron_schedule ?? destResolved.config["cronSchedule"];
  const cron = typeof cronScheduleRaw === "string" ? cronScheduleRaw : null;
  const tzRaw = destResolved.config.schedule_timezone ?? destResolved.config.timezone;
  const tz = typeof tzRaw === "string" ? tzRaw : "UTC";
  const partitionsRaw = destResolved.config["elt_partitions_note"];
  const otherRaw = destResolved.config["elt_other_notes"];

  return {
    name: body.name,
    sourceType: body.sourceType,
    destinationType: destResolved.destinationType,
    sourceConfiguration: destResolved.config,
    description: body.description ?? null,
    groupName: body.groupName ?? null,
    writeDisposition: "append",
    fileFormat: "parquet",
    timezone: tz,
    retries: 2,
    retryDelay: 30,
    schemaOverride: typeof destResolved.config.schema_override === "string" ? destResolved.config.schema_override : null,
    destinationInstance:
      typeof destResolved.config.destination_instance === "string"
        ? destResolved.config.destination_instance
        : null,
    incrementalEnabled: Boolean(destResolved.config.incremental_enabled),
    cursorField: typeof destResolved.config.cursor_field === "string" ? destResolved.config.cursor_field : undefined,
    cursorInitialValue:
      typeof destResolved.config.cursor_initial_value === "string"
        ? destResolved.config.cursor_initial_value
        : undefined,
    scheduleEnabled: Boolean(destResolved.config.schedule_enabled ?? destResolved.config["scheduleEnabled"]),
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

export async function generatePipelineArtifacts(
  body: CreatePipelineBody,
  options?: { workspaceCatalogUrls?: string[] | null }
) {
  const tool = resolveTool(body);
  const req = await bodyToRequest(body, options);

  if (tool === "dlt") {
    const pipelineCode = generateDltPipeline(req);
    const configData: Record<string, unknown> = {
      source_type: req.sourceType,
      destination_type: req.destinationType,
      tool: "dlt",
      configuration: req.sourceConfiguration,
    };
    const configYaml = YAML.stringify(configData);
    const workspaceYaml = generateEltpulseWorkspaceYaml(req);
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
  const workspaceYaml = generateEltpulseWorkspaceYaml(req);
  return { tool: "sling" as const, pipelineCode, configYaml, workspaceYaml };
}
