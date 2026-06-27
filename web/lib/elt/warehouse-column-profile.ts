/**
 * Column profile types + parsers safe for client bundles.
 */

export type ColumnProfileKind = "numeric" | "other";

export type ColumnProfile = {
  name: string;
  type: string;
  kind: ColumnProfileKind;
  nullPct: number;
  approxUnique?: number;
  min?: number;
  max?: number;
  q25?: number;
  q50?: number;
  q75?: number;
  avg?: number;
  /** Filled client-side from preview sample rows for categorical columns. */
  topValue?: string;
  topValueShare?: number;
};

export type SummarizeRowset = {
  columns: string[];
  rows: unknown[][];
};

const NUMERIC_TYPE =
  /^(tinyint|smallint|integer|bigint|hugeint|utinyint|usmallint|uinteger|ubigint|float|double|decimal|numeric|real)/i;

function rowField(rowset: SummarizeRowset, row: unknown[], field: string): unknown {
  const idx = rowset.columns.findIndex((c) => c.toLowerCase() === field.toLowerCase());
  return idx >= 0 ? row[idx] : undefined;
}

function toNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function toStringValue(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s || undefined;
}

function profileKind(type: string): ColumnProfileKind {
  return NUMERIC_TYPE.test(type.trim()) ? "numeric" : "other";
}

/** Parse DuckDB SUMMARIZE rowset into column profiles keyed by column name. */
export function parseSummarizeRowset(rowset: SummarizeRowset): Record<string, ColumnProfile> {
  const out: Record<string, ColumnProfile> = {};
  for (const row of rowset.rows) {
    if (!Array.isArray(row)) continue;
    const name = toStringValue(rowField(rowset, row, "column_name"));
    if (!name) continue;
    const type = toStringValue(rowField(rowset, row, "column_type")) ?? "unknown";
    const nullPct = toNumber(rowField(rowset, row, "null_percentage")) ?? 0;
    const approxUnique = toNumber(rowField(rowset, row, "approx_unique"));
    const kind = profileKind(type);
    const profile: ColumnProfile = {
      name,
      type,
      kind,
      nullPct: Math.max(0, Math.min(100, nullPct)),
      approxUnique: approxUnique != null ? Math.round(approxUnique) : undefined,
    };
    if (kind === "numeric") {
      profile.min = toNumber(rowField(rowset, row, "min"));
      profile.max = toNumber(rowField(rowset, row, "max"));
      profile.q25 = toNumber(rowField(rowset, row, "q25"));
      profile.q50 = toNumber(rowField(rowset, row, "q50"));
      profile.q75 = toNumber(rowField(rowset, row, "q75"));
      profile.avg = toNumber(rowField(rowset, row, "avg"));
    }
    out[name] = profile;
  }
  return out;
}

/** Enrich categorical profiles with the dominant value from preview sample rows. */
export function enrichProfilesFromSampleRows(
  profiles: Record<string, ColumnProfile>,
  columns: string[],
  rows: Record<string, unknown>[]
): Record<string, ColumnProfile> {
  if (!rows.length) return profiles;
  const next = { ...profiles };
  for (const col of columns) {
    const base = next[col] ?? {
      name: col,
      type: "unknown",
      kind: "other" as const,
      nullPct: 0,
    };
    if (base.kind === "numeric") continue;
    const values = rows.map((r) => r[col]);
    const nonNull = values.filter((v) => v != null && v !== "");
    if (!nonNull.length) {
      next[col] = { ...base, nullPct: 100 };
      continue;
    }
    const counts = new Map<string, number>();
    for (const v of nonNull) {
      const key = String(v);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let topValue = "";
    let topCount = 0;
    counts.forEach((n, k) => {
      if (n > topCount) {
        topValue = k;
        topCount = n;
      }
    });
    const nullPct = Math.round(((values.length - nonNull.length) / values.length) * 1000) / 10;
    next[col] = {
      ...base,
      nullPct: base.nullPct || nullPct,
      topValue: topValue.slice(0, 40),
      topValueShare: topCount / values.length,
    };
  }
  return next;
}
