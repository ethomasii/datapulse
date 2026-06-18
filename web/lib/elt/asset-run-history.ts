/**
 * Correlate pipeline runs with catalog assets — history, per-asset metrics, activity events.
 */

import type { WorkspaceAsset } from "@/lib/elt/pipeline-assets";
import { effectiveRunTelemetry, formatRows, parseRunTelemetry } from "@/lib/elt/run-telemetry";
import { resourcesTouchedFromTelemetry } from "@/lib/elt/asset-level-freshness";
import { latestRunPerSlice, parseSliceFromTriggeredBy } from "@/lib/elt/slice-trigger";

export type AssetRunHistoryRow = {
  runId: string;
  status: string;
  environment: string;
  startedAt: string;
  finishedAt: string | null;
  triggeredBy: string | null;
  partitionColumn: string | null;
  partitionValue: string | null;
  durationMs: number | null;
  touched: boolean;
  rowsLoaded: number | null;
  bytesLoaded: number | null;
  currentPhase: string | null;
};

export type AssetMetricsBucket = {
  date: string;
  runs: number;
  succeeded: number;
  rowsLoaded: number;
  bytesLoaded: number;
};

export type AssetSliceRow = {
  column: string;
  value: string;
  status: string;
  runId: string;
  startedAt: string;
  finishedAt: string | null;
};

export type AssetActivityEvent = {
  id: string;
  type: "run" | "slice" | "catalog" | "comment" | "github";
  at: string;
  title: string;
  detail?: string;
  href?: string;
  status?: string;
};

type RunInput = {
  id: string;
  status: string;
  environment: string;
  startedAt: Date;
  finishedAt: Date | null;
  triggeredBy: string | null;
  partitionColumn: string | null;
  partitionValue: string | null;
  telemetry: unknown;
  logEntries: unknown;
};

function normalizeResourceKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "_");
}

function assetResourceCandidates(asset: WorkspaceAsset): string[] {
  return [
    normalizeResourceKey(asset.name),
    normalizeResourceKey(asset.displayName),
    asset.landingQualified ? normalizeResourceKey(asset.landingQualified.split(".").pop() ?? "") : "",
  ].filter(Boolean);
}

function resourceRowsForAsset(
  asset: WorkspaceAsset,
  telemetryRaw: unknown
): { rows?: number; bytes?: number } {
  const parsed = parseRunTelemetry(telemetryRaw);
  const candidates = new Set(assetResourceCandidates(asset));
  let rows: number | undefined;
  let bytes: number | undefined;

  for (const r of parsed.resources ?? []) {
    const key = normalizeResourceKey(r.resource);
    if (candidates.has(key) || key === "_total") {
      if (typeof r.rows === "number") rows = Math.max(rows ?? 0, r.rows);
      if (typeof r.bytes === "number") bytes = Math.max(bytes ?? 0, r.bytes);
    }
  }

  for (const s of parsed.samples) {
    if (!s.resource) continue;
    const key = normalizeResourceKey(s.resource);
    if (!candidates.has(key) && key !== "_total") continue;
    if (typeof s.rows === "number") rows = Math.max(rows ?? 0, s.rows);
    if (typeof s.bytes === "number") bytes = Math.max(bytes ?? 0, s.bytes);
  }

  if (rows === undefined && bytes === undefined && parsed.summary.currentResource) {
    const key = normalizeResourceKey(parsed.summary.currentResource);
    if (candidates.has(key) || key === "_total") {
      rows = parsed.summary.rowsLoaded;
      bytes = parsed.summary.bytesLoaded;
    }
  }

  return { rows, bytes };
}

export function runTouchesAsset(asset: WorkspaceAsset, run: RunInput): boolean {
  if (asset.kind === "source") return true;

  const tel = effectiveRunTelemetry(run.telemetry, run.logEntries);
  const resources = resourcesTouchedFromTelemetry(run.telemetry);

  if (asset.kind === "transform" || asset.kind === "post_transform") {
    const model = tel.dbt?.models.find((m) => m.name.toLowerCase() === asset.name.toLowerCase());
    if (model) return true;
    if (run.status === "succeeded" && !tel.dbt) {
      return asset.kind === "transform" && resources.size === 0;
    }
    return false;
  }

  const candidates = assetResourceCandidates(asset);
  for (const c of candidates) {
    if (resources.has(c)) return true;
    for (const r of Array.from(resources)) {
      if (r.includes(c) || c.includes(r)) return true;
    }
  }

  return false;
}

export function buildAssetRunHistory(asset: WorkspaceAsset, runs: RunInput[]): AssetRunHistoryRow[] {
  return runs.map((run) => {
    const tel = effectiveRunTelemetry(run.telemetry, run.logEntries);
    const touched = runTouchesAsset(asset, run);
    const resourceStats = touched ? resourceRowsForAsset(asset, run.telemetry) : {};
    const durationMs =
      run.finishedAt !== null ? run.finishedAt.getTime() - run.startedAt.getTime() : null;

    return {
      runId: run.id,
      status: run.status,
      environment: run.environment,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      triggeredBy: run.triggeredBy,
      partitionColumn: run.partitionColumn,
      partitionValue: run.partitionValue,
      durationMs,
      touched,
      rowsLoaded:
        resourceStats.rows ??
        (touched ? (tel.summary.rowsLoaded ?? null) : null),
      bytesLoaded:
        resourceStats.bytes ??
        (touched ? (tel.summary.bytesLoaded ?? null) : null),
      currentPhase: tel.summary.currentPhase ?? null,
    };
  });
}

export function buildAssetMetricsTimeSeries(
  history: AssetRunHistoryRow[],
  windowDays: number
): { buckets: AssetMetricsBucket[]; totals: { runs: number; succeeded: number; rowsLoaded: number; bytesLoaded: number } } {
  const since = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const touched = history.filter(
    (h) => h.touched && Date.parse(h.startedAt) >= since
  );

  const map = new Map<string, AssetMetricsBucket>();
  for (const row of touched) {
    const date = row.startedAt.slice(0, 10);
    const bucket = map.get(date) ?? {
      date,
      runs: 0,
      succeeded: 0,
      rowsLoaded: 0,
      bytesLoaded: 0,
    };
    bucket.runs += 1;
    if (row.status === "succeeded") bucket.succeeded += 1;
    bucket.rowsLoaded += row.rowsLoaded ?? 0;
    bucket.bytesLoaded += row.bytesLoaded ?? 0;
    map.set(date, bucket);
  }

  const buckets = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  const totals = {
    runs: touched.length,
    succeeded: touched.filter((r) => r.status === "succeeded").length,
    rowsLoaded: touched.reduce((a, r) => a + (r.rowsLoaded ?? 0), 0),
    bytesLoaded: touched.reduce((a, b) => a + (b.bytesLoaded ?? 0), 0),
  };

  return { buckets, totals };
}

export function buildAssetSliceRows(runs: RunInput[]): AssetSliceRow[] {
  const sliceRuns = runs.map((r) => ({
    id: r.id,
    status: r.status,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
    triggeredBy: r.triggeredBy,
    environment: r.environment,
  }));
  const map = latestRunPerSlice(sliceRuns);
  return Array.from(map.values())
    .map((row) => ({
      column: row.parsed.column,
      value: row.parsed.value,
      status: row.status,
      runId: row.id,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
    }))
    .sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
}

export function buildAssetActivityEvents(input: {
  history: AssetRunHistoryRow[];
  catalogUpdatedAt?: string | null;
  catalogDescription?: string | null;
  comments: Array<{ id: string; body: string; authorName: string | null; createdAt: Date }>;
  githubCommits: Array<{ sha: string; message: string; author: string; at: string; htmlUrl: string }>;
}): AssetActivityEvent[] {
  const events: AssetActivityEvent[] = [];

  for (const run of input.history) {
    const slice = parseSliceFromTriggeredBy(run.triggeredBy);
    const sliceLabel = slice ? ` · slice ${slice.value}` : "";
    events.push({
      id: `run:${run.runId}`,
      type: slice ? "slice" : "run",
      at: run.startedAt,
      title: `${run.status}${run.touched ? "" : " (pipeline)"}${sliceLabel}`,
      detail: [
        run.rowsLoaded !== null ? `${formatRows(run.rowsLoaded)} rows` : null,
        run.partitionValue ? `partition=${run.partitionValue}` : null,
        run.triggeredBy,
      ]
        .filter(Boolean)
        .join(" · "),
      href: `/runs?run=${encodeURIComponent(run.runId)}`,
      status: run.status,
    });
  }

  if (input.catalogUpdatedAt) {
    events.push({
      id: `catalog:${input.catalogUpdatedAt}`,
      type: "catalog",
      at: input.catalogUpdatedAt,
      title: "Catalog metadata updated",
      detail: input.catalogDescription?.slice(0, 120) ?? undefined,
    });
  }

  for (const c of input.comments) {
    events.push({
      id: `comment:${c.id}`,
      type: "comment",
      at: c.createdAt.toISOString(),
      title: `${c.authorName ?? "User"} commented`,
      detail: c.body.slice(0, 200),
    });
  }

  for (const g of input.githubCommits) {
    events.push({
      id: `github:${g.sha}`,
      type: "github",
      at: g.at,
      title: g.message.split("\n")[0]?.slice(0, 120) ?? "Git commit",
      detail: `${g.author} · pipeline declaration`,
      href: g.htmlUrl,
    });
  }

  return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
