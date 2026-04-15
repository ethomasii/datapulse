/** `triggeredBy` for slice backfills from Run slices / API: `backfill:partition:<column>:<value>` */

export const SLICE_BACKFILL_PREFIX = "backfill:partition:";

export type ParsedSliceTrigger = {
  column: string;
  value: string;
};

export function parseSliceFromTriggeredBy(triggeredBy: string | null | undefined): ParsedSliceTrigger | null {
  if (!triggeredBy || !triggeredBy.startsWith(SLICE_BACKFILL_PREFIX)) return null;
  const rest = triggeredBy.slice(SLICE_BACKFILL_PREFIX.length);
  const i = rest.indexOf(":");
  if (i === -1) return null;
  return { column: rest.slice(0, i), value: rest.slice(i + 1) };
}

export type RunRowForSlice = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  triggeredBy: string | null;
  environment: string;
};

/** Latest run per `column::value` (most recent startedAt wins). */
export function latestRunPerSlice(runs: RunRowForSlice[]): Map<string, RunRowForSlice & { parsed: ParsedSliceTrigger }> {
  const map = new Map<string, RunRowForSlice & { parsed: ParsedSliceTrigger }>();
  for (const r of runs) {
    const parsed = parseSliceFromTriggeredBy(r.triggeredBy);
    if (!parsed) continue;
    const key = `${parsed.column}::${parsed.value}`;
    const existing = map.get(key);
    if (!existing || new Date(r.startedAt).getTime() > new Date(existing.startedAt).getTime()) {
      map.set(key, { ...r, parsed });
    }
  }
  return map;
}
