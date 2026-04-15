import type { CreatePipelineBody } from "./types";

/** Merge ELT metadata fields into `sourceConfiguration` for persistence (tests, sensors, schedule hints). */
export function mergeEltMetadataIntoSourceConfig(body: CreatePipelineBody): Record<string, unknown> {
  const base = { ...(body.sourceConfiguration ?? {}) } as Record<string, unknown>;

  if (body.tests !== undefined) {
    const lines = body.tests.trim()
      ? body.tests.split("\n").map((l) => l.trim()).filter(Boolean)
      : [];
    if (lines.length) base.elt_tests = lines;
    else delete base.elt_tests;
  }

  if (body.sensors !== undefined) {
    const lines = body.sensors.trim()
      ? body.sensors.split("\n").map((l) => l.trim()).filter(Boolean)
      : [];
    if (lines.length) base.elt_sensors = lines;
    else delete base.elt_sensors;
  }

  if (body.sliceIntent !== undefined) {
    if (body.sliceIntent === "full" || body.sliceIntent === "sliced") base.elt_slice_intent = body.sliceIntent;
    else delete base.elt_slice_intent;
  }

  if (body.partitionsNote !== undefined) {
    if (body.partitionsNote.trim()) base.elt_partitions_note = body.partitionsNote.trim();
    else delete base.elt_partitions_note;
  }

  if (body.otherNotes !== undefined) {
    if (body.otherNotes.trim()) base.elt_other_notes = body.otherNotes.trim();
    else delete base.elt_other_notes;
  }

  if (body.scheduleEnabled !== undefined) {
    base.schedule_enabled = body.scheduleEnabled;
  }

  if (body.scheduleCron !== undefined) {
    if (body.scheduleCron.trim()) base.cron_schedule = body.scheduleCron.trim();
    else delete base.cron_schedule;
  }

  if (body.scheduleTimezone !== undefined) {
    if (body.scheduleTimezone.trim()) base.schedule_timezone = body.scheduleTimezone.trim();
    else delete base.schedule_timezone;
  }

  return base;
}
