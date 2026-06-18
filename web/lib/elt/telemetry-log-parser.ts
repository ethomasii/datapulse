/**
 * Parse structured `[eltpulse]` markers and common dlt/Sling log lines into telemetry patches.
 * Shared by managed Node executor and can mirror Python worker regexes.
 */

import type { PatchRunBody } from "@/lib/elt/run-types";

const PHASE_MARKER = /\[eltpulse\]\s+phase:(\w+)/i;
const RESOURCE_MARKER = /\[eltpulse\]\s+resource:([^\s]+)\s+rows:(\d+)(?:\s+bytes:(\d+))?/i;
const ROWS_LOADED = /\b([\d,]+)\s*rows\s+loaded\b/i;
const ROWS_SO_FAR = /rows\s+processed\s+so\s+far:\s*([\d,]+)/i;
const BYTES_LOADED = /\b([\d,]+)\s*bytes\s+loaded\b/i;

const PHASE_PROGRESS: Record<string, number> = {
  extract: 15,
  load: 70,
  dbt: 90,
  done: 100,
  failed: 100,
};

function parseIntLoose(raw: string): number | undefined {
  const n = Number.parseInt(raw.replace(/,/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export type ParsedLogTelemetry = {
  patch: Partial<PatchRunBody>;
};

/** Build PATCH body fragments from one log line (may be empty). */
export function parseLogLineForTelemetry(line: string): ParsedLogTelemetry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const phaseMatch = trimmed.match(PHASE_MARKER);
  if (phaseMatch) {
    const phase = phaseMatch[1].toLowerCase();
    const progress = PHASE_PROGRESS[phase] ?? 50;
    return {
      patch: {
        telemetrySummary: { currentPhase: phase, progress },
        appendTelemetrySample: { phase, progress },
      },
    };
  }

  const resourceMatch = trimmed.match(RESOURCE_MARKER);
  if (resourceMatch) {
    const resource = resourceMatch[1];
    const rows = parseIntLoose(resourceMatch[2]);
    const bytes = resourceMatch[3] ? parseIntLoose(resourceMatch[3]) : undefined;
    return {
      patch: {
        telemetrySummary: {
          currentResource: resource,
          ...(rows !== undefined ? { rowsLoaded: rows } : {}),
          ...(bytes !== undefined ? { bytesLoaded: bytes } : {}),
        },
        appendTelemetrySample: {
          resource,
          ...(rows !== undefined ? { rows } : {}),
          ...(bytes !== undefined ? { bytes } : {}),
        },
      },
    };
  }

  const rowsLoaded = trimmed.match(ROWS_LOADED);
  if (rowsLoaded) {
    const rows = parseIntLoose(rowsLoaded[1]);
    if (rows !== undefined) {
      return {
        patch: {
          telemetrySummary: { rowsLoaded: rows },
          appendTelemetrySample: { rows },
        },
      };
    }
  }

  const rowsSoFar = trimmed.match(ROWS_SO_FAR);
  if (rowsSoFar) {
    const rows = parseIntLoose(rowsSoFar[1]);
    if (rows !== undefined) {
      return {
        patch: {
          telemetrySummary: { rowsLoaded: rows },
          appendTelemetrySample: { rows },
        },
      };
    }
  }

  const bytesLoaded = trimmed.match(BYTES_LOADED);
  if (bytesLoaded) {
    const bytes = parseIntLoose(bytesLoaded[1]);
    if (bytes !== undefined) {
      return {
        patch: {
          telemetrySummary: { bytesLoaded: bytes },
          appendTelemetrySample: { bytes },
        },
      };
    }
  }

  return null;
}

/** Merge resource rollups from samples for storage on terminal PATCH. */
export function buildResourceRollup(
  samples: Array<{ resource?: string; rows?: number; bytes?: number }>
): { resource: string; rows?: number; bytes?: number }[] {
  const byResource = new Map<string, { rows?: number; bytes?: number }>();
  for (const s of samples) {
    if (!s.resource) continue;
    const prev = byResource.get(s.resource) ?? {};
    byResource.set(s.resource, {
      rows: Math.max(prev.rows ?? 0, s.rows ?? 0) || undefined,
      bytes: Math.max(prev.bytes ?? 0, s.bytes ?? 0) || undefined,
    });
  }
  return Array.from(byResource.entries()).map(([resource, v]) => ({ resource, ...v }));
}
