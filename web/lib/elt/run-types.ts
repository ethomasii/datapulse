import { z } from "zod";

export const runStatusSchema = z.enum(["pending", "running", "succeeded", "failed", "cancelled"]);

const logEntrySchema = z.object({
  at: z.string(),
  level: z.enum(["info", "warn", "error"]),
  message: z.string().max(4000),
});

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
});

export type LogEntry = z.infer<typeof logEntrySchema>;
