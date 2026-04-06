import { z } from "zod";

/** Mirrors the Python PipelineRequest used by pipeline_generator (subset for web UI). */
export const createPipelineBodySchema = z.object({
  name: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Use letters, numbers, underscore; start with a letter"),
  sourceType: z.string().min(1),
  destinationType: z.string().min(1),
  tool: z.enum(["auto", "dlt", "sling"]).default("auto"),
  description: z.string().optional(),
  groupName: z.string().optional(),
  sourceConfiguration: z.record(z.string(), z.any()).optional().default({}),
  /** One assertion per line (data quality / dbt-style tests). */
  tests: z.string().max(16000).optional(),
  /** One sensor / event trigger per line. */
  sensors: z.string().max(16000).optional(),
  /** Partition strategy (time window, key, backfill notes). */
  partitionsNote: z.string().max(8000).optional(),
  /** Catch-all: SLAs, ownership, links to external orchestration. */
  otherNotes: z.string().max(8000).optional(),
  scheduleEnabled: z.boolean().optional(),
  scheduleCron: z.string().max(256).optional(),
  scheduleTimezone: z.string().max(64).optional(),
  /** Per-pipeline run webhook (optional; overrides account default for this pipeline). */
  runsWebhookUrl: z.string().max(2048).optional(),
});

export type CreatePipelineBody = z.infer<typeof createPipelineBodySchema>;

export type PipelineRequest = {
  name: string;
  sourceType: string;
  destinationType: string;
  destinationInstance?: string | null;
  sourceConfiguration: Record<string, unknown>;
  description?: string | null;
  groupName?: string | null;
  scheduleEnabled?: boolean;
  cronSchedule?: string | null;
  timezone?: string;
  owners?: string[] | null;
  tags?: Record<string, string> | null;
  kinds?: string[] | null;
  retries?: number;
  retryDelay?: number;
  writeDisposition?: string;
  fileFormat?: string;
  schemaOverride?: string | null;
  /** From `source_configuration` for REST / incremental templates */
  incrementalEnabled?: boolean;
  cursorField?: string;
  cursorInitialValue?: string;
  /** Data quality / test assertions (from builder; exported to workspace YAML). */
  tests?: string[];
  /** Sensor / event-trigger descriptions (orchestration layer). */
  sensors?: string[];
  partitionsNote?: string | null;
  otherNotes?: string | null;
};
