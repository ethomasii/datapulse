/**
 * Run telemetry: live + historical rows/bytes/progress samples for Fivetran-style UX.
 * Stored as JSON on `EltPipelineRun.telemetry` — gateway and managed workers PATCH the same shape.
 */

export const TELEMETRY_SAMPLES_MAX = 2000;

export type TelemetrySummary = {
  rowsLoaded?: number;
  bytesLoaded?: number;
  progress?: number;
  currentPhase?: string;
  currentResource?: string;
  /** ISO timestamp of last summary update */
  updatedAt?: string;
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
};

export type RunTelemetry = {
  summary: TelemetrySummary;
  samples: TelemetrySample[];
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

function sanitizeSummary(raw: Record<string, unknown>): TelemetrySummary {
  const rowsLoaded = finiteNonNeg(raw.rowsLoaded);
  const bytesLoaded = finiteNonNeg(raw.bytesLoaded);
  let progress = finiteNonNeg(raw.progress);
  if (progress !== undefined && progress > 100) progress = 100;
  return {
    ...(rowsLoaded !== undefined ? { rowsLoaded } : {}),
    ...(bytesLoaded !== undefined ? { bytesLoaded } : {}),
    ...(progress !== undefined ? { progress } : {}),
    ...(str(raw.currentPhase, 256) !== undefined ? { currentPhase: str(raw.currentPhase, 256) } : {}),
    ...(str(raw.currentResource, 512) !== undefined ? { currentResource: str(raw.currentResource, 512) } : {}),
    ...(str(raw.updatedAt, 64) !== undefined ? { updatedAt: str(raw.updatedAt, 64) } : {}),
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
  const out: TelemetrySample = { at };
  if (rows !== undefined) out.rows = rows;
  if (bytes !== undefined) out.bytes = bytes;
  if (rowsDelta !== undefined) out.rowsDelta = rowsDelta;
  if (bytesDelta !== undefined) out.bytesDelta = bytesDelta;
  if (progress !== undefined) out.progress = progress;
  if (phase) out.phase = phase;
  if (resource) out.resource = resource;
  return out;
}

export function emptyRunTelemetry(): RunTelemetry {
  return { summary: {}, samples: [] };
}

export function parseRunTelemetry(raw: unknown): RunTelemetry {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyRunTelemetry();
  }
  const o = raw as Record<string, unknown>;
  const summaryRaw = o.summary;
  const summary =
    summaryRaw && typeof summaryRaw === "object" && !Array.isArray(summaryRaw)
      ? sanitizeSummary(summaryRaw as Record<string, unknown>)
      : {};
  const samplesRaw = o.samples;
  const samples: TelemetrySample[] = [];
  if (Array.isArray(samplesRaw)) {
    for (const item of samplesRaw) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const s = sanitizeSample(item as Record<string, unknown>, new Date().toISOString());
      if (s) samples.push(s);
    }
  }
  return { summary, samples: samples.slice(-TELEMETRY_SAMPLES_MAX) };
}

export type TelemetryPatchInput = {
  telemetrySummary?: Partial<TelemetrySummary>;
  appendTelemetrySample?: Partial<TelemetrySample>;
  telemetrySamples?: TelemetrySample[];
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

  return { summary, samples };
}

export function runTelemetryToJson(t: RunTelemetry): Record<string, unknown> {
  return { summary: t.summary, samples: t.samples };
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
