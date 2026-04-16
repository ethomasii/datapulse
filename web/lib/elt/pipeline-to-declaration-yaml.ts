import YAML from "yaml";
import type { EltPipeline } from "@prisma/client";
import { createPipelineBodySchema, type CreatePipelineBody } from "@/lib/elt/types";

function linesFromEltField(v: unknown): string | undefined {
  if (Array.isArray(v)) {
    const s = v.map((x) => String(x)).join("\n").trim();
    return s || undefined;
  }
  if (typeof v === "string" && v.trim()) return v.trim();
  return undefined;
}

/**
 * Reconstruct a {@link CreatePipelineBody} from a persisted pipeline row for GitOps YAML export.
 * Hoists merge-elt metadata out of `sourceConfiguration` so the file matches declarative examples.
 */
export function eltPipelineRowToCreateBody(row: EltPipeline): CreatePipelineBody {
  const src = { ...(row.sourceConfiguration as Record<string, unknown>) };

  const tests = linesFromEltField(src.elt_tests);
  delete src.elt_tests;

  const sensors = linesFromEltField(src.elt_sensors);
  delete src.elt_sensors;

  const sliceRaw = src.elt_slice_intent;
  delete src.elt_slice_intent;
  const sliceIntent = sliceRaw === "full" || sliceRaw === "sliced" ? sliceRaw : undefined;

  const partitionsNote = typeof src.elt_partitions_note === "string" ? src.elt_partitions_note : undefined;
  delete src.elt_partitions_note;

  const otherNotes = typeof src.elt_other_notes === "string" ? src.elt_other_notes : undefined;
  delete src.elt_other_notes;

  const scheduleEnabled = typeof src.schedule_enabled === "boolean" ? src.schedule_enabled : undefined;
  delete src.schedule_enabled;

  const scheduleCron = typeof src.cron_schedule === "string" ? src.cron_schedule : undefined;
  delete src.cron_schedule;
  delete src.cronSchedule;

  const scheduleTimezone = typeof src.schedule_timezone === "string" ? src.schedule_timezone : undefined;
  delete src.schedule_timezone;

  const raw: Record<string, unknown> = {
    name: row.name,
    sourceType: row.sourceType,
    destinationType: row.destinationType,
    tool: "auto",
    sourceConfiguration: src,
  };

  if (row.description) raw.description = row.description;
  if (row.groupName) raw.groupName = row.groupName;
  if (tests !== undefined) raw.tests = tests;
  if (sensors !== undefined) raw.sensors = sensors;
  if (sliceIntent !== undefined) raw.sliceIntent = sliceIntent;
  if (partitionsNote !== undefined) raw.partitionsNote = partitionsNote;
  if (otherNotes !== undefined) raw.otherNotes = otherNotes;
  if (scheduleEnabled !== undefined) raw.scheduleEnabled = scheduleEnabled;
  if (scheduleCron !== undefined) raw.scheduleCron = scheduleCron;
  if (scheduleTimezone !== undefined) raw.scheduleTimezone = scheduleTimezone;
  if (row.runsWebhookUrl) raw.runsWebhookUrl = row.runsWebhookUrl;
  if (row.defaultTargetAgentTokenId !== null && row.defaultTargetAgentTokenId !== undefined) {
    raw.defaultTargetAgentTokenId = row.defaultTargetAgentTokenId;
  }
  raw.executionHost = row.executionHost;
  if (row.sourceConnectionId !== null && row.sourceConnectionId !== undefined) {
    raw.sourceConnectionId = row.sourceConnectionId;
  }
  if (row.destinationConnectionId !== null && row.destinationConnectionId !== undefined) {
    raw.destinationConnectionId = row.destinationConnectionId;
  }

  return createPipelineBodySchema.parse(raw);
}

/** Serialized pipeline declaration for `eltpulse/pipelines/<name>.yaml` (upsert-friendly). */
export function eltPipelineToDeclarationYamlString(row: EltPipeline): string {
  const body = eltPipelineRowToCreateBody(row);
  const doc: Record<string, unknown> = {
    eltpulse_pipeline_declaration: 1,
    upsert: true,
    name: body.name,
    sourceType: body.sourceType,
    destinationType: body.destinationType,
    tool: body.tool,
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.groupName !== undefined ? { groupName: body.groupName } : {}),
    sourceConfiguration: body.sourceConfiguration ?? {},
    ...(body.tests !== undefined ? { tests: body.tests } : {}),
    ...(body.sensors !== undefined ? { sensors: body.sensors } : {}),
    ...(body.sliceIntent !== undefined ? { sliceIntent: body.sliceIntent } : {}),
    ...(body.partitionsNote !== undefined ? { partitionsNote: body.partitionsNote } : {}),
    ...(body.otherNotes !== undefined ? { otherNotes: body.otherNotes } : {}),
    ...(body.scheduleEnabled !== undefined ? { scheduleEnabled: body.scheduleEnabled } : {}),
    ...(body.scheduleCron !== undefined ? { scheduleCron: body.scheduleCron } : {}),
    ...(body.scheduleTimezone !== undefined ? { scheduleTimezone: body.scheduleTimezone } : {}),
    ...(body.runsWebhookUrl !== undefined ? { runsWebhookUrl: body.runsWebhookUrl } : {}),
    ...(body.defaultTargetAgentTokenId !== undefined ? { defaultTargetAgentTokenId: body.defaultTargetAgentTokenId } : {}),
    ...(body.executionHost !== undefined ? { executionHost: body.executionHost } : {}),
    ...(body.sourceConnectionId !== undefined ? { sourceConnectionId: body.sourceConnectionId } : {}),
    ...(body.destinationConnectionId !== undefined ? { destinationConnectionId: body.destinationConnectionId } : {}),
  };
  return YAML.stringify(doc, { lineWidth: 0 }).trimEnd() + "\n";
}
