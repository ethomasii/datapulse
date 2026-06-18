/**
 * Fivetran-style pipeline health rollup from recent runs and telemetry.
 */

import type { RunTelemetry } from "@/lib/elt/run-telemetry";
import { effectiveRunTelemetry, formatRows } from "@/lib/elt/run-telemetry";
import { dbtFailedTests } from "@/lib/elt/dbt-run-manifest";
import { parseRunTelemetry } from "@/lib/elt/run-telemetry";

export type PipelineHealthStatus = "healthy" | "degraded" | "failing" | "unknown";

export type PipelineHealthSummary = {
  pipelineId: string;
  pipelineName: string;
  enabled: boolean;
  status: PipelineHealthStatus;
  label: string;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  successRate7d: number | null;
  runs7d: number;
  avgRowsLoaded: number | null;
  lastRowsLoaded: number | null;
  lastDurationMs: number | null;
  dbtTestFailures: number;
  currentPhase: string | null;
  issues: string[];
};

type RunRow = {
  id: string;
  pipelineId: string | null;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  telemetry: unknown;
  logEntries: unknown;
  errorSummary: string | null;
};

function runDurationMs(run: RunRow): number | null {
  if (!run.finishedAt) return null;
  return run.finishedAt.getTime() - run.startedAt.getTime();
}

function telemetryForRun(run: RunRow): RunTelemetry {
  return effectiveRunTelemetry(run.telemetry, run.logEntries);
}

export function computePipelineHealth(
  pipelineId: string,
  pipelineName: string,
  enabled: boolean,
  runs: RunRow[]
): PipelineHealthSummary {
  const pipelineRuns = runs
    .filter((r) => r.pipelineId === pipelineId)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const runs7d = pipelineRuns.filter((r) => r.startedAt.getTime() >= sevenDaysAgo);
  const succeeded7d = runs7d.filter((r) => r.status === "succeeded").length;
  const successRate7d = runs7d.length > 0 ? Math.round((succeeded7d / runs7d.length) * 100) : null;

  const last = pipelineRuns[0];
  const lastTelemetry = last ? telemetryForRun(last) : null;
  const lastRows = lastTelemetry?.summary.rowsLoaded ?? null;
  const rowsSamples = runs7d
    .map((r) => telemetryForRun(r).summary.rowsLoaded)
    .filter((n): n is number => typeof n === "number");
  const avgRowsLoaded =
    rowsSamples.length > 0 ? Math.round(rowsSamples.reduce((a, b) => a + b, 0) / rowsSamples.length) : null;

  const dbtFailures = lastTelemetry?.dbt ? dbtFailedTests(lastTelemetry.dbt).length : 0;
  const issues: string[] = [];

  if (!enabled) issues.push("Pipeline is disabled");
  if (last?.status === "failed") issues.push(last.errorSummary?.slice(0, 120) ?? "Last run failed");
  if (last?.status === "running") issues.push("Run in progress");
  if (dbtFailures > 0) issues.push(`${dbtFailures} dbt test failure(s) on last run`);
  if (successRate7d !== null && successRate7d < 80 && runs7d.length >= 3) {
    issues.push(`${successRate7d}% success rate over 7 days`);
  }
  if (runs7d.length === 0 && enabled) issues.push("No runs in the last 7 days");

  let status: PipelineHealthStatus = "unknown";
  if (!last) status = "unknown";
  else if (last.status === "failed" || dbtFailures > 0) status = "failing";
  else if (issues.length > 0 || (successRate7d !== null && successRate7d < 95)) status = "degraded";
  else if (last.status === "succeeded") status = "healthy";

  const label =
    status === "healthy"
      ? "Healthy"
      : status === "degraded"
        ? "Degraded"
        : status === "failing"
          ? "Failing"
          : "No runs yet";

  return {
    pipelineId,
    pipelineName,
    enabled,
    status,
    label,
    lastRunAt: last ? (last.finishedAt ?? last.startedAt).toISOString() : null,
    lastRunStatus: last?.status ?? null,
    successRate7d,
    runs7d: runs7d.length,
    avgRowsLoaded,
    lastRowsLoaded: lastRows,
    lastDurationMs: last ? runDurationMs(last) : null,
    dbtTestFailures: dbtFailures,
    currentPhase: lastTelemetry?.summary.currentPhase ?? null,
    issues,
  };
}

export function formatHealthRows(n: number | null): string {
  if (n === null) return "—";
  return formatRows(n);
}

/** Extract resource-level sync stats from run telemetry samples. */
export function resourceSyncStats(telemetryRaw: unknown): { resource: string; rows?: number }[] {
  const t = parseRunTelemetry(telemetryRaw);
  const byResource = new Map<string, number>();
  for (const s of t.samples) {
    if (s.resource && typeof s.rows === "number") {
      byResource.set(s.resource, Math.max(byResource.get(s.resource) ?? 0, s.rows));
    }
  }
  return Array.from(byResource.entries()).map(([resource, rows]) => ({ resource, rows }));
}
