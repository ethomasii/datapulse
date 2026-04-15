import { z } from "zod";
import { TELEMETRY_SAMPLES_MAX } from "./run-telemetry";

export const runStatusSchema = z.enum(["pending", "running", "succeeded", "failed", "cancelled"]);

const logEntrySchema = z.object({
  at: z.string(),
  level: z.enum(["info", "warn", "error"]),
  message: z.string().max(4000),
});

/** Partial rollup for list views + live progress (merge into existing summary on PATCH). */
export const telemetrySummaryPatchSchema = z
  .object({
    rowsLoaded: z.number().finite().nonnegative().optional(),
    bytesLoaded: z.number().finite().nonnegative().optional(),
    progress: z.number().finite().min(0).max(100).optional(),
    currentPhase: z.string().max(256).optional(),
    currentResource: z.string().max(512).optional(),
    updatedAt: z.string().max(64).optional(),
  })
  .strict();

/** One time-series point (append or replace batch). Prefer frequent PATCH while running. */
export const telemetrySampleSchema = z
  .object({
    at: z.string().max(64).optional(),
    rows: z.number().finite().nonnegative().optional(),
    bytes: z.number().finite().nonnegative().optional(),
    rowsDelta: z.number().finite().optional(),
    bytesDelta: z.number().finite().optional(),
    progress: z.number().finite().min(0).max(100).optional(),
    phase: z.string().max(128).optional(),
    resource: z.string().max(512).optional(),
  })
  .strict();

export const createRunBodySchema = z.object({
  pipelineId: z.string().min(1),
  environment: z.string().max(64).optional().default("default"),
  correlationId: z.string().max(128).optional(),
  triggeredBy: z.string().max(256).optional(),
  status: runStatusSchema.optional().default("running"),
  /** Named gateway (`AgentToken` id). Omit for pipeline default, then single-gateway auto-pin if applicable; null = any gateway. */
  targetAgentTokenId: z.string().min(1).nullable().optional(),
});

export const patchRunBodySchema = z.object({
  status: runStatusSchema.optional(),
  logEntries: z.array(logEntrySchema).max(500).optional(),
  errorSummary: z.string().max(8000).nullable().optional(),
  finishedAt: z.string().datetime().nullable().optional(),
  /** Append one structured line (merged into existing logs with current timestamp). */
  appendLog: z
    .object({
      level: z.enum(["info", "warn", "error"]),
      message: z.string().max(4000),
    })
    .optional(),
  /** Shallow-merge into `telemetry.summary` (rows/bytes/progress/phase). Sets `updatedAt` server-side. */
  telemetrySummary: telemetrySummaryPatchSchema.optional(),
  /** Append one `{ at, rows?, bytes?, ... }` sample (capped). Live ingestion should call every few seconds while running. */
  appendTelemetrySample: telemetrySampleSchema.optional(),
  /** Replace entire samples array (e.g. backfill after run). Max length enforced server-side. */
  telemetrySamples: z.array(telemetrySampleSchema).max(TELEMETRY_SAMPLES_MAX).optional(),
});

export type LogEntry = z.infer<typeof logEntrySchema>;
export type PatchRunBody = z.infer<typeof patchRunBodySchema>;
