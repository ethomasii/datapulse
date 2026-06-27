/**
 * Client-side preview table helpers — sort, filter, profile mini-charts.
 */

export type SortDirection = "asc" | "desc";

export function filterPreviewRows(
  rows: Record<string, unknown>[],
  search: string
): Record<string, unknown>[] {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    Object.values(row).some((v) => v != null && String(v).toLowerCase().includes(q))
  );
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number" && Number.isFinite(a) && Number.isFinite(b)) {
    return a - b;
  }
  const na = Number(String(a).replace(/,/g, ""));
  const nb = Number(String(b).replace(/,/g, ""));
  if (Number.isFinite(na) && Number.isFinite(nb) && String(a).trim() !== "" && String(b).trim() !== "") {
    return na - nb;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function sortPreviewRows(
  rows: Record<string, unknown>[],
  column: string,
  direction: SortDirection
): Record<string, unknown>[] {
  const sorted = [...rows].sort((a, b) => compareValues(a[column], b[column]));
  return direction === "desc" ? sorted.reverse() : sorted;
}

/** Normalized bin heights (0–1) for a numeric/date sample. */
export function histogramBinHeights(values: unknown[], binCount = 8): number[] {
  const nums = values
    .map((v) => {
      if (v instanceof Date) return v.getTime();
      if (typeof v === "number" && Number.isFinite(v)) return v;
      const n = Number(String(v).replace(/,/g, ""));
      return Number.isFinite(n) ? n : null;
    })
    .filter((n): n is number => n != null);
  if (!nums.length) return Array.from({ length: binCount }, () => 0);

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const counts = Array.from({ length: binCount }, () => 0);
  for (const n of nums) {
    const idx = Math.min(binCount - 1, Math.floor(((n - min) / span) * binCount));
    counts[idx]! += 1;
  }
  const peak = Math.max(...counts, 1);
  return counts.map((c) => c / peak);
}

export type ValueShare = { value: string; share: number };

/** Top categorical values by frequency in the sample. */
export function topValueShares(values: unknown[], limit = 4): ValueShare[] {
  const nonNull = values.filter((v) => v != null && v !== "");
  if (!nonNull.length) return [];
  const counts = new Map<string, number>();
  for (const v of nonNull) {
    const key = String(v).slice(0, 48);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, share: count / values.length }));
}

export type ProfileChartKind = "numeric" | "categorical" | "boolean" | "date";

export function profileChartKind(
  columnType: string | undefined,
  sampleValues: unknown[]
): ProfileChartKind {
  const nonNull = sampleValues.filter((v) => v != null && v !== "");
  if (!nonNull.length) return "categorical";

  const boolTokens = new Set(nonNull.map((v) => String(v).toLowerCase()));
  if (
    boolTokens.size <= 2 &&
    [...boolTokens].every((t) => t === "true" || t === "false" || t === "0" || t === "1")
  ) {
    return "boolean";
  }

  if (columnType && /date|time|timestamp/i.test(columnType)) return "date";

  const nums = nonNull
    .map((v) => {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      const n = Number(String(v).replace(/,/g, ""));
      return Number.isFinite(n) ? n : null;
    })
    .filter((n): n is number => n != null);
  if (nums.length >= nonNull.length * 0.85) return "numeric";

  return "categorical";
}

export function booleanShares(values: unknown[]): { trueShare: number; falseShare: number } {
  let t = 0;
  let f = 0;
  for (const v of values) {
    if (v == null || v === "") continue;
    const s = String(v).toLowerCase();
    if (s === "true" || s === "1") t += 1;
    else if (s === "false" || s === "0") f += 1;
  }
  const total = t + f || 1;
  return { trueShare: t / total, falseShare: f / total };
}
