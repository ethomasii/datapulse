/**
 * Run telemetry: live + historical rows/bytes/progress samples for Fivetran-style UX.
 * Stored as JSON on `EltPipelineRun.telemetry` — gateway and managed workers PATCH the same shape.
 */

import type { DbtRunManifest } from "@/lib/elt/dbt-run-manifest";
import { sanitizeDbtRunManifest } from "@/lib/elt/dbt-run-manifest";

export const TELEMETRY_SAMPLES_MAX = 2000;

export type TelemetrySystemMetrics = {
  cpuPercent?: number;
  memoryMb?: number;
  networkBytesIn?: number;
  networkBytesOut?: number;
};

export type TelemetrySummary = {
  rowsLoaded?: number;
  bytesLoaded?: number;
  progress?: number;
  currentPhase?: string;
  currentResource?: string;
  /** ISO timestamp of last summary update */
  updatedAt?: string;
  /** Worker process metrics when reported */
  system?: TelemetrySystemMetrics;
};

export type TelemetrySample = {
  /** ISO time; optional on PATCH — server fills when omitted. */
  at?: string;
  rows?: number;
  bytes?: number;
  rowsDelta?: number;
  bytesDelta?: number;
  progress?: number;
  phase?: string;
  resource?: string;
  system?: TelemetrySystemMetrics;
};

export type ResourceRollup = {
  resource: string;
  rows?: number;
  bytes?: number;
};

export type RunTelemetry = {
  summary: TelemetrySummary;
  samples: TelemetrySample[];
  /** Per-resource rollup from samples (optional, set on terminal PATCH). */
  resources?: ResourceRollup[];
  /** dbt model/test results from the transform phase (v2). */
  dbt?: DbtRunManifest;
  /** Data contract violations evaluated after a succeeded run. */
  contractViolations?: ContractViolationSummary[];
  /** Numeric rollup was inferred from structured log lines (no telemetry summary on the run). */
  derivedFromLogs?: boolean;
};

export type ContractViolationSummary = {
  contractSlug: string;
  contractName: string;
  assetKey: string;
  issues: string[];
};

function finiteNonNeg(n: unknown): number | undefined {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return undefined;
  return n;
}

function finiteAny(n: unknown): number | undefined {
  if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
  return n;
}

function str(n: unknown, max: number): string | undefined {
  if (typeof n !== "string") return undefined;
  const t = n.trim();
  if (!t) return undefined;
  return t.length > max ? t.slice(0, max) : t;
}

function sanitizeContractViolations(raw: unknown): ContractViolationSummary[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ContractViolationSummary[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const contractSlug = str(o.contractSlug, 120);
    const contractName = str(o.contractName, 200);
    const assetKey = str(o.assetKey, 512);
    const issuesRaw = o.issues;
    if (!contractSlug || !contractName || !assetKey || !Array.isArray(issuesRaw)) continue;
    const issues = issuesRaw
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean)
      .slice(0, 20);
    if (!issues.length) continue;
    out.push({ contractSlug, contractName, assetKey, issues });
  }
  return out.length ? out : undefined;
}

function sanitizeSystem(raw: unknown): TelemetrySystemMetrics | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const cpuPercent = finiteNonNeg(o.cpuPercent);
  let cpu = cpuPercent;
  if (cpu !== undefined && cpu > 100) cpu = 100;
  const memoryMb = finiteNonNeg(o.memoryMb);
  const networkBytesIn = finiteNonNeg(o.networkBytesIn);
  const networkBytesOut = finiteNonNeg(o.networkBytesOut);
  const out: TelemetrySystemMetrics = {};
  if (cpu !== undefined) out.cpuPercent = cpu;
  if (memoryMb !== undefined) out.memoryMb = memoryMb;
  if (networkBytesIn !== undefined) out.networkBytesIn = networkBytesIn;
  if (networkBytesOut !== undefined) out.networkBytesOut = networkBytesOut;
  return Object.keys(out).length > 0 ? out : undefined;
}

function sanitizeSummary(raw: Record<string, unknown>): TelemetrySummary {
  const rowsLoaded = finiteNonNeg(raw.rowsLoaded);
  const bytesLoaded = finiteNonNeg(raw.bytesLoaded);
  let progress = finiteNonNeg(raw.progress);
  if (progress !== undefined && progress > 100) progress = 100;
  const system = sanitizeSystem(raw.system);
  return {
    ...(rowsLoaded !== undefined ? { rowsLoaded } : {}),
    ...(bytesLoaded !== undefined ? { bytesLoaded } : {}),
    ...(progress !== undefined ? { progress } : {}),
    ...(str(raw.currentPhase, 256) !== undefined ? { currentPhase: str(raw.currentPhase, 256) } : {}),
    ...(str(raw.currentResource, 512) !== undefined ? { currentResource: str(raw.currentResource, 512) } : {}),
    ...(str(raw.updatedAt, 64) !== undefined ? { updatedAt: str(raw.updatedAt, 64) } : {}),
    ...(system ? { system } : {}),
  };
}

function sanitizeSample(raw: Record<string, unknown>, defaultAt: string): TelemetrySample | null {
  const at = str(raw.at, 64) ?? defaultAt;
  const rows = finiteNonNeg(raw.rows);
  const bytes = finiteNonNeg(raw.bytes);
  const rowsDelta = finiteAny(raw.rowsDelta);
  const bytesDelta = finiteAny(raw.bytesDelta);
  let progress = finiteNonNeg(raw.progress);
  if (progress !== undefined && progress > 100) progress = 100;
  const phase = str(raw.phase, 128);
  const resource = str(raw.resource, 512);
  const system = sanitizeSystem(raw.system);
  const out: TelemetrySample = { at };
  if (rows !== undefined) out.rows = rows;
  if (bytes !== undefined) out.bytes = bytes;
  if (rowsDelta !== undefined) out.rowsDelta = rowsDelta;
  if (bytesDelta !== undefined) out.bytesDelta = bytesDelta;
  if (progress !== undefined) out.progress = progress;
  if (phase) out.phase = phase;
  if (resource) out.resource = resource;
  if (system) out.system = system;
  return out;
}

export function emptyRunTelemetry(): RunTelemetry {
  return { summary: {}, samples: [] };
}

function summaryRollupIsEmpty(s: TelemetrySummary): boolean {
  return (
    s.rowsLoaded === undefined &&
    s.bytesLoaded === undefined &&
    s.progress === undefined &&
    s.updatedAt === undefined &&
    s.currentPhase === undefined &&
    s.currentResource === undefined
  );
}

/**
 * Best-effort rollup when runners only appended human-readable log lines (no telemetry PATCH).
 * Prefers a final "N rows loaded" line; otherwise the largest "rows processed so far" value.
 */
export function deriveTelemetrySummaryFromLogEntries(rawLogs: unknown): TelemetrySummary | null {
  if (!Array.isArray(rawLogs) || rawLogs.length === 0) return null;
  let rowsFinal: number | undefined;
  let maxRowsSoFar = 0;
  let sawSoFar = false;
  let lastAt: string | undefined;

  for (const entry of rawLogs) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const at = typeof (entry as { at?: unknown }).at === "string" ? (entry as { at: string }).at : undefined;
    const message =
      typeof (entry as { message?: unknown }).message === "string" ? (entry as { message: string }).message : "";
    if (!message) continue;
    if (at) lastAt = at;

    const completed = message.match(/\b([\d,]+)\s*rows\s+loaded\b/i);
    if (completed) {
      const n = Number.parseInt(completed[1].replace(/,/g, ""), 10);
      if (Number.isFinite(n) && n >= 0) rowsFinal = n;
    }
    const soFar = message.match(/rows\s+processed\s+so\s+far:\s*([\d,]+)/i);
    if (soFar) {
      const n = Number.parseInt(soFar[1].replace(/,/g, ""), 10);
      if (Number.isFinite(n) && n >= 0) {
        sawSoFar = true;
        maxRowsSoFar = Math.max(maxRowsSoFar, n);
      }
    }
  }

  const out: TelemetrySummary = {};
  if (rowsFinal !== undefined) out.rowsLoaded = rowsFinal;
  else if (sawSoFar) out.rowsLoaded = maxRowsSoFar;
  if (lastAt) out.updatedAt = lastAt;
  return Object.keys(out).length > 0 ? out : null;
}

/** Parse stored telemetry; unwrap JSON strings; accept legacy rollup fields at the JSON root. */
export function parseRunTelemetry(raw: unknown): RunTelemetry {
  let v: unknown = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v) as unknown;
    } catch {
      return emptyRunTelemetry();
    }
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    return emptyRunTelemetry();
  }
  const o = v as Record<string, unknown>;
  const summaryRaw = o.summary;
  let summary =
    summaryRaw && typeof summaryRaw === "object" && !Array.isArray(summaryRaw)
      ? sanitizeSummary(summaryRaw as Record<string, unknown>)
      : {};
  if (summaryRollupIsEmpty(summary)) {
    const fromRoot = sanitizeSummary(o);
    if (!summaryRollupIsEmpty(fromRoot)) summary = fromRoot;
  }
  const samplesRaw = o.samples;
  const samples: TelemetrySample[] = [];
  if (Array.isArray(samplesRaw)) {
    for (const item of samplesRaw) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const s = sanitizeSample(item as Record<string, unknown>, new Date().toISOString());
      if (s) samples.push(s);
    }
  }
  const dbt = sanitizeDbtRunManifest(o.dbt) ?? undefined;
  const contractViolations = sanitizeContractViolations(o.contractViolations);
  const resourcesRaw = o.resources;
  let resources: ResourceRollup[] | undefined;
  if (Array.isArray(resourcesRaw)) {
    resources = resourcesRaw
      .filter((r) => r && typeof r === "object" && typeof (r as ResourceRollup).resource === "string")
      .map((r) => {
        const row = r as ResourceRollup;
        return {
          resource: row.resource.slice(0, 512),
          ...(finiteNonNeg(row.rows) !== undefined ? { rows: finiteNonNeg(row.rows) } : {}),
          ...(finiteNonNeg(row.bytes) !== undefined ? { bytes: finiteNonNeg(row.bytes) } : {}),
        };
      });
  }
  return {
    summary,
    samples: samples.slice(-TELEMETRY_SAMPLES_MAX),
    ...(resources?.length ? { resources } : {}),
    ...(dbt ? { dbt } : {}),
    ...(contractViolations?.length ? { contractViolations } : {}),
  };
}

function inferSummaryFromSamples(samples: TelemetrySample[]): TelemetrySummary | null {
  if (samples.length === 0) return null;
  const last = samples[samples.length - 1];
  const out: TelemetrySummary = {};
  if (typeof last.rows === "number") out.rowsLoaded = last.rows;
  if (typeof last.bytes === "number") out.bytesLoaded = last.bytes;
  if (typeof last.progress === "number") out.progress = last.progress;
  if (typeof last.at === "string" && last.at) out.updatedAt = last.at;
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Telemetry for UI: parsed JSON; if rollup is empty, fill from the last sample and/or structured logs.
 */
export function effectiveRunTelemetry(telemetryRaw: unknown, logEntriesRaw: unknown): RunTelemetry {
  const base = parseRunTelemetry(telemetryRaw);
  if (!summaryRollupIsEmpty(base.summary)) return base;
  const fromSamples = inferSummaryFromSamples(base.samples);
  if (fromSamples) {
    return { summary: { ...base.summary, ...fromSamples }, samples: base.samples };
  }
  const fromLogs = deriveTelemetrySummaryFromLogEntries(logEntriesRaw);
  if (!fromLogs) return base;
  return {
    summary: { ...base.summary, ...fromLogs },
    samples: base.samples,
    derivedFromLogs: true,
  };
}

export type TelemetryPatchInput = {
  telemetrySummary?: Partial<TelemetrySummary>;
  appendTelemetrySample?: Partial<TelemetrySample>;
  telemetrySamples?: TelemetrySample[];
  dbtManifest?: DbtRunManifest;
  resources?: ResourceRollup[];
};

export function mergeRunTelemetry(existingRaw: unknown, patch: TelemetryPatchInput): RunTelemetry {
  const base = parseRunTelemetry(existingRaw);
  let summary: TelemetrySummary = { ...base.summary };
  let samples = [...base.samples];

  if (patch.telemetrySamples !== undefined) {
    const next: TelemetrySample[] = [];
    for (const item of patch.telemetrySamples) {
      const s = sanitizeSample(
        { ...item } as Record<string, unknown>,
        typeof item.at === "string" && item.at ? item.at : new Date().toISOString()
      );
      if (s) next.push(s);
    }
    samples = next.slice(-TELEMETRY_SAMPLES_MAX);
  }

  if (patch.telemetrySummary !== undefined) {
    const partial = sanitizeSummary(patch.telemetrySummary as Record<string, unknown>);
    summary = { ...summary, ...partial, updatedAt: new Date().toISOString() };
  }

  if (patch.appendTelemetrySample !== undefined && patch.telemetrySamples === undefined) {
    const s = sanitizeSample(
      patch.appendTelemetrySample as Record<string, unknown>,
      patch.appendTelemetrySample.at ?? new Date().toISOString()
    );
    if (s) {
      samples = [...samples, s].slice(-TELEMETRY_SAMPLES_MAX);
      summary = { ...summary, updatedAt: new Date().toISOString() };
    }
  }

  let dbt = base.dbt;
  if (patch.dbtManifest !== undefined) {
    const sanitized = sanitizeDbtRunManifest(patch.dbtManifest);
    if (sanitized) dbt = sanitized;
  }

  let resources = base.resources;
  if (patch.resources !== undefined) {
    resources = patch.resources.slice(0, 500);
  }

  return { summary, samples, ...(resources?.length ? { resources } : {}), ...(dbt ? { dbt } : {}) };
}

export function runTelemetryToJson(t: RunTelemetry): Record<string, unknown> {
  return {
    summary: t.summary,
    samples: t.samples,
    ...(t.resources?.length ? { resources: t.resources } : {}),
    ...(t.dbt ? { dbt: t.dbt } : {}),
    ...(t.contractViolations?.length ? { contractViolations: t.contractViolations } : {}),
    ...(t.derivedFromLogs ? { derivedFromLogs: true } : {}),
  };
}

export type PhaseTimelineEntry = {
  phase: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
};

/** Derive phase durations from telemetry samples. */
export function phaseTimeline(samples: TelemetrySample[]): PhaseTimelineEntry[] {
  const entries: PhaseTimelineEntry[] = [];
  for (const s of samples) {
    if (!s.phase || !s.at) continue;
    const last = entries[entries.length - 1];
    if (last && last.phase === s.phase && !last.endedAt) continue;
    if (last && !last.endedAt) {
      last.endedAt = s.at;
      last.durationMs = Date.parse(s.at) - Date.parse(last.startedAt);
    }
    entries.push({ phase: s.phase, startedAt: s.at });
  }
  return entries;
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatRows(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}
