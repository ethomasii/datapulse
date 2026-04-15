import type { Prisma } from "@prisma/client";
import { sanitizeForRunStorage } from "@/lib/elt/run-log-sanitize";
import { mergeRunTelemetry, runTelemetryToJson } from "@/lib/elt/run-telemetry";
import type { LogEntry, PatchRunBody } from "@/lib/elt/run-types";

type RunPatchExisting = {
  status: string;
  logEntries: unknown;
  telemetry: unknown;
  finishedAt: Date | null;
};

function isTerminal(status: string): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled";
}

/** Shared PATCH merge for `/api/elt/runs/:id` and `/api/agent/runs/:id`. */
export function applyPatchRunBody(
  existing: RunPatchExisting,
  body: PatchRunBody
): {
  nextStatus: string;
  nextFinishedAt: Date | null;
  logEntries: LogEntry[];
  telemetryJson: Prisma.InputJsonValue | undefined;
  errorSummary: string | null | undefined;
  wasTerminal: boolean;
  willBeTerminal: boolean;
} {
  let logEntries: LogEntry[] = Array.isArray(existing.logEntries)
    ? (existing.logEntries as unknown as LogEntry[])
    : [];

  if (body.appendLog) {
    const line: LogEntry = {
      at: new Date().toISOString(),
      level: body.appendLog.level,
      message: sanitizeForRunStorage(body.appendLog.message, 4000),
    };
    logEntries = [...logEntries, line].slice(-500);
  }

  if (body.logEntries) {
    logEntries = body.logEntries.map((e) => ({
      ...e,
      message: sanitizeForRunStorage(e.message, 4000),
    }));
  }

  const errorSummary =
    body.errorSummary === undefined
      ? undefined
      : body.errorSummary === null
        ? null
        : sanitizeForRunStorage(body.errorSummary);

  const nextStatus = body.status ?? existing.status;
  let nextFinishedAt = existing.finishedAt;
  if (body.finishedAt !== undefined) {
    nextFinishedAt = body.finishedAt ? new Date(body.finishedAt) : null;
  } else if (isTerminal(nextStatus) && !existing.finishedAt) {
    nextFinishedAt = new Date();
  }

  const wasTerminal = isTerminal(existing.status);
  const willBeTerminal = isTerminal(nextStatus);

  const telemetryTouched =
    body.telemetrySummary !== undefined ||
    body.appendTelemetrySample !== undefined ||
    body.telemetrySamples !== undefined;

  const telemetryJson = telemetryTouched
    ? (runTelemetryToJson(
        mergeRunTelemetry(existing.telemetry, {
          telemetrySummary: body.telemetrySummary,
          appendTelemetrySample: body.appendTelemetrySample,
          telemetrySamples: body.telemetrySamples,
        })
      ) as Prisma.InputJsonValue)
    : undefined;

  return {
    nextStatus,
    nextFinishedAt,
    logEntries,
    telemetryJson,
    errorSummary,
    wasTerminal,
    willBeTerminal,
  };
}
