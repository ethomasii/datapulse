/**
 * Pipeline-level metrics aggregation — slice/dice runs by pipeline, env, tool, time.
 */

import { effectiveRunTelemetry, formatBytes, formatRows } from "@/lib/elt/run-telemetry";
import { resourceSyncStats } from "@/lib/elt/pipeline-health";

export type MetricsQuery = {
  days?: number;
  pipelineId?: string;
  environment?: string;
  status?: string;
  tool?: string;
  sourceType?: string;
  destinationType?: string;
};

export type MetricsTimeBucket = {
  date: string;
  runs: number;
  succeeded: number;
  failed: number;
  rowsLoaded: number;
  bytesLoaded: number;
  avgDurationMs: number | null;
};

export type MetricsPipelineRow = {
  pipelineId: string;
  pipelineName: string;
  tool: string;
  sourceType: string;
  destinationType: string;
  enabled: boolean;
  runs: number;
  succeeded: number;
  failed: number;
  successRate: number | null;
  rowsLoaded: number;
  bytesLoaded: number;
  avgDurationMs: number | null;
  p95DurationMs: number | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
};

export type MetricsBreakdownRow = {
  key: string;
  label: string;
  runs: number;
  succeeded: number;
  rowsLoaded: number;
  bytesLoaded: number;
  successRate: number | null;
};

export type PipelineMetricsResponse = {
  windowDays: number;
  filters: MetricsQuery;
  totals: {
    runs: number;
    succeeded: number;
    failed: number;
    cancelled: number;
    running: number;
    successRate: number | null;
    rowsLoaded: number;
    bytesLoaded: number;
    avgDurationMs: number | null;
    p50DurationMs: number | null;
    p95DurationMs: number | null;
  };
  timeSeries: MetricsTimeBucket[];
  byPipeline: MetricsPipelineRow[];
  byEnvironment: MetricsBreakdownRow[];
  byTool: MetricsBreakdownRow[];
  bySourceType: MetricsBreakdownRow[];
  byDestinationType: MetricsBreakdownRow[];
  byTrigger: MetricsBreakdownRow[];
};

type RunInput = {
  id: string;
  status: string;
  environment: string;
  startedAt: Date;
  finishedAt: Date | null;
  triggeredBy: string | null;
  telemetry: unknown;
  logEntries: unknown;
  pipeline: {
    id: string;
    name: string;
    tool: string;
    sourceType: string;
    destinationType: string;
    enabled: boolean;
  } | null;
};

function durationMs(run: RunInput): number | null {
  if (!run.finishedAt) return null;
  return run.finishedAt.getTime() - run.startedAt.getTime();
}

function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? null;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function triggerBucket(triggeredBy: string | null): string {
  if (!triggeredBy) return "unknown";
  if (triggeredBy.startsWith("monitor:")) return "monitor";
  if (triggeredBy === "cron" || triggeredBy.startsWith("cron:")) return "schedule";
  if (triggeredBy === "incoming_webhook" || triggeredBy.startsWith("webhook")) return "webhook";
  if (triggeredBy === "manual") return "manual";
  return "other";
}

function triggerLabel(key: string): string {
  const labels: Record<string, string> = {
    monitor: "Monitor",
    schedule: "Schedule",
    webhook: "Webhook",
    manual: "Manual",
    other: "Other",
    unknown: "Unknown",
  };
  return labels[key] ?? key;
}

function aggregateBreakdown(
  runs: RunInput[],
  keyFn: (r: RunInput) => string,
  labelFn: (key: string) => string
): MetricsBreakdownRow[] {
  const map = new Map<string, { runs: number; succeeded: number; rows: number; bytes: number }>();
  for (const run of runs) {
    const key = keyFn(run);
    const prev = map.get(key) ?? { runs: 0, succeeded: 0, rows: 0, bytes: 0 };
    const tel = effectiveRunTelemetry(run.telemetry, run.logEntries);
    prev.runs += 1;
    if (run.status === "succeeded") prev.succeeded += 1;
    prev.rows += tel.summary.rowsLoaded ?? 0;
    prev.bytes += tel.summary.bytesLoaded ?? 0;
    map.set(key, prev);
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({
      key,
      label: labelFn(key),
      runs: v.runs,
      succeeded: v.succeeded,
      rowsLoaded: v.rows,
      bytesLoaded: v.bytes,
      successRate: v.runs > 0 ? Math.round((v.succeeded / v.runs) * 100) : null,
    }))
    .sort((a, b) => b.runs - a.runs);
}

export function computePipelineMetrics(
  runs: RunInput[],
  pipelines: Array<{
    id: string;
    name: string;
    tool: string;
    sourceType: string;
    destinationType: string;
    enabled: boolean;
  }>,
  query: MetricsQuery
): PipelineMetricsResponse {
  const windowDays = Math.min(90, Math.max(1, query.days ?? 30));
  const since = Date.now() - windowDays * 24 * 60 * 60 * 1000;

  let filtered = runs.filter((r) => r.startedAt.getTime() >= since && r.pipeline);

  if (query.pipelineId) filtered = filtered.filter((r) => r.pipeline?.id === query.pipelineId);
  if (query.environment) filtered = filtered.filter((r) => r.environment === query.environment);
  if (query.status) filtered = filtered.filter((r) => r.status === query.status);
  if (query.tool) filtered = filtered.filter((r) => r.pipeline?.tool === query.tool);
  if (query.sourceType) filtered = filtered.filter((r) => r.pipeline?.sourceType === query.sourceType);
  if (query.destinationType) {
    filtered = filtered.filter((r) => r.pipeline?.destinationType === query.destinationType);
  }

  const durations: number[] = [];
  let totalRows = 0;
  let totalBytes = 0;
  let succeeded = 0;
  let failed = 0;
  let cancelled = 0;
  let running = 0;

  const bucketMap = new Map<string, MetricsTimeBucket>();

  for (const run of filtered) {
    const tel = effectiveRunTelemetry(run.telemetry, run.logEntries);
    totalRows += tel.summary.rowsLoaded ?? 0;
    totalBytes += tel.summary.bytesLoaded ?? 0;
    if (run.status === "succeeded") succeeded += 1;
    else if (run.status === "failed") failed += 1;
    else if (run.status === "cancelled") cancelled += 1;
    else if (run.status === "running") running += 1;

    const dur = durationMs(run);
    if (dur !== null) durations.push(dur);

    const dk = dayKey(run.startedAt);
    const bucket = bucketMap.get(dk) ?? {
      date: dk,
      runs: 0,
      succeeded: 0,
      failed: 0,
      rowsLoaded: 0,
      bytesLoaded: 0,
      avgDurationMs: null,
    };
    bucket.runs += 1;
    if (run.status === "succeeded") bucket.succeeded += 1;
    if (run.status === "failed") bucket.failed += 1;
    bucket.rowsLoaded += tel.summary.rowsLoaded ?? 0;
    bucket.bytesLoaded += tel.summary.bytesLoaded ?? 0;
    bucketMap.set(dk, bucket);
  }

  const sortedDurations = [...durations].sort((a, b) => a - b);
  const avgDuration =
    durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

  // Per-day avg duration
  const durationsByDay = new Map<string, number[]>();
  for (const run of filtered) {
    const dur = durationMs(run);
    if (dur === null) continue;
    const dk = dayKey(run.startedAt);
    const arr = durationsByDay.get(dk) ?? [];
    arr.push(dur);
    durationsByDay.set(dk, arr);
  }
  for (const [dk, durs] of Array.from(durationsByDay.entries())) {
    const bucket = bucketMap.get(dk);
    if (bucket && durs.length) {
      bucket.avgDurationMs = Math.round(durs.reduce((a, b) => a + b, 0) / durs.length);
    }
  }

  const timeSeries = Array.from(bucketMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const pipelineMap = new Map(pipelines.map((p) => [p.id, p]));
  const byPipelineId = new Map<
    string,
    {
      runs: RunInput[];
      rows: number;
      bytes: number;
      durations: number[];
      lastRun: RunInput | null;
    }
  >();

  for (const run of filtered) {
    const pid = run.pipeline!.id;
    const prev = byPipelineId.get(pid) ?? { runs: [], rows: 0, bytes: 0, durations: [], lastRun: null };
    prev.runs.push(run);
    const tel = effectiveRunTelemetry(run.telemetry, run.logEntries);
    prev.rows += tel.summary.rowsLoaded ?? 0;
    prev.bytes += tel.summary.bytesLoaded ?? 0;
    const dur = durationMs(run);
    if (dur !== null) prev.durations.push(dur);
    if (!prev.lastRun || run.startedAt > prev.lastRun.startedAt) prev.lastRun = run;
    byPipelineId.set(pid, prev);
  }

  const byPipeline: MetricsPipelineRow[] = Array.from(byPipelineId.entries())
    .map(([pipelineId, agg]) => {
      const meta = pipelineMap.get(pipelineId);
      const succ = agg.runs.filter((r) => r.status === "succeeded").length;
      const durs = [...agg.durations].sort((a, b) => a - b);
      return {
        pipelineId,
        pipelineName: meta?.name ?? pipelineId,
        tool: meta?.tool ?? "—",
        sourceType: meta?.sourceType ?? "—",
        destinationType: meta?.destinationType ?? "—",
        enabled: meta?.enabled ?? true,
        runs: agg.runs.length,
        succeeded: succ,
        failed: agg.runs.filter((r) => r.status === "failed").length,
        successRate: agg.runs.length > 0 ? Math.round((succ / agg.runs.length) * 100) : null,
        rowsLoaded: agg.rows,
        bytesLoaded: agg.bytes,
        avgDurationMs: durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : null,
        p95DurationMs: percentile(durs, 95),
        lastRunAt: agg.lastRun ? (agg.lastRun.finishedAt ?? agg.lastRun.startedAt).toISOString() : null,
        lastRunStatus: agg.lastRun?.status ?? null,
      };
    })
    .sort((a, b) => b.runs - a.runs);

  const totalRuns = filtered.length;

  return {
    windowDays,
    filters: query,
    totals: {
      runs: totalRuns,
      succeeded,
      failed,
      cancelled,
      running,
      successRate: totalRuns > 0 ? Math.round((succeeded / totalRuns) * 100) : null,
      rowsLoaded: totalRows,
      bytesLoaded: totalBytes,
      avgDurationMs: avgDuration,
      p50DurationMs: percentile(sortedDurations, 50),
      p95DurationMs: percentile(sortedDurations, 95),
    },
    timeSeries,
    byPipeline,
    byEnvironment: aggregateBreakdown(filtered, (r) => r.environment, (k) => k),
    byTool: aggregateBreakdown(filtered, (r) => r.pipeline?.tool ?? "unknown", (k) => k),
    bySourceType: aggregateBreakdown(filtered, (r) => r.pipeline?.sourceType ?? "unknown", (k) => k),
    byDestinationType: aggregateBreakdown(
      filtered,
      (r) => r.pipeline?.destinationType ?? "unknown",
      (k) => k
    ),
    byTrigger: aggregateBreakdown(filtered, (r) => triggerBucket(r.triggeredBy), triggerLabel),
  };
}

/** Load runs + compute metrics for a single workspace user (alert evaluation, cron). */
export async function fetchPipelineMetricsForUser(
  userId: string,
  query: MetricsQuery = {}
): Promise<PipelineMetricsResponse> {
  const { db } = await import("@/lib/db/client");
  const windowDays = Math.min(90, Math.max(1, query.days ?? 30));
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const pipelines = await db.eltPipeline.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      tool: true,
      sourceType: true,
      destinationType: true,
      enabled: true,
    },
  });

  const runs = await db.eltPipelineRun.findMany({
    where: {
      userId,
      startedAt: { gte: since },
      pipelineId: { not: null },
    },
    orderBy: { startedAt: "desc" },
    take: 5000,
    select: {
      id: true,
      status: true,
      environment: true,
      startedAt: true,
      finishedAt: true,
      triggeredBy: true,
      telemetry: true,
      logEntries: true,
      pipeline: {
        select: {
          id: true,
          name: true,
          tool: true,
          sourceType: true,
          destinationType: true,
          enabled: true,
        },
      },
    },
  });

  return computePipelineMetrics(runs, pipelines, { ...query, days: windowDays });
}

export { formatBytes, formatRows, resourceSyncStats };
