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
  /** Dominant categorical value in the profile sample. */
  topValue?: string;
  topValueShare?: number;
};

export type SummarizeRowset = {
  columns: string[];
  rows: unknown[][];
};

export type ColumnTypeHint = {
  name: string;
  type?: string;
};

const NUMERIC_TYPE =
  /^(tinyint|smallint|integer|int|int2|int4|int8|bigint|hugeint|utinyint|usmallint|uinteger|ubigint|float|float4|float8|double|decimal|numeric|real|number|money)/i;

function rowField(rowset: SummarizeRowset, row: unknown[], field: string): unknown {
  const idx = rowset.columns.findIndex((c) => c.toLowerCase() === field.toLowerCase());
  return idx >= 0 ? row[idx] : undefined;
}

function toNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function toStringValue(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s || undefined;
}

export function profileKindForType(type: string | undefined, sampleValues: unknown[]): ColumnProfileKind {
  if (type && NUMERIC_TYPE.test(type.trim())) return "numeric";
  const nums = sampleValues
    .filter((v) => v != null && v !== "")
    .map((v) => toNumber(v))
    .filter((n): n is number => n != null);
  if (!nums.length) return "other";
  const nonNull = sampleValues.filter((v) => v != null && v !== "");
  return nums.length >= nonNull.length * 0.9 ? "numeric" : "other";
}

function quantile(sorted: number[], q: number): number | undefined {
  if (!sorted.length) return undefined;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  if (next !== undefined) return sorted[base]! + rest * (next - sorted[base]!);
  return sorted[base];
}

function topValueFromSample(values: unknown[]): { topValue?: string; topValueShare?: number } {
  const nonNull = values.filter((v) => v != null && v !== "");
  if (!nonNull.length) return {};
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
  return {
    topValue: topValue.slice(0, 40),
    topValueShare: topCount / values.length,
  };
}

/** Build column profiles from a bounded row sample (all warehouse types). */
export function computeColumnProfilesFromSample(
  columns: ColumnTypeHint[],
  rows: Record<string, unknown>[]
): Record<string, ColumnProfile> {
  const out: Record<string, ColumnProfile> = {};
  if (!columns.length) return out;

  for (const col of columns) {
    const values = rows.map((r) => r[col.name]);
    const nonNull = values.filter((v) => v != null && v !== "");
    const nullPct =
      values.length === 0 ? 0 : Math.round(((values.length - nonNull.length) / values.length) * 1000) / 10;
    const kind = profileKindForType(col.type, values);
    const profile: ColumnProfile = {
      name: col.name,
      type: col.type?.trim() || "unknown",
      kind,
      nullPct,
      approxUnique: new Set(nonNull.map((v) => String(v))).size,
    };

    if (kind === "numeric") {
      const nums = nonNull.map((v) => toNumber(v)).filter((n): n is number => n != null);
      if (nums.length) {
        const sorted = [...nums].sort((a, b) => a - b);
        profile.min = sorted[0];
        profile.max = sorted[sorted.length - 1];
        profile.q25 = quantile(sorted, 0.25);
        profile.q50 = quantile(sorted, 0.5);
        profile.q75 = quantile(sorted, 0.75);
        profile.avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      }
    } else {
      Object.assign(profile, topValueFromSample(values));
    }
    out[col.name] = profile;
  }
  return out;
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
    const kind = profileKindForType(type, []);
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

/** Merge preview rows into profiles (categorical top values when missing). */
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
    if (base.kind === "numeric" || base.topValue) {
      next[col] = base;
      continue;
    }
    const values = rows.map((r) => r[col]);
    const nonNull = values.filter((v) => v != null && v !== "");
    if (!nonNull.length) {
      next[col] = { ...base, nullPct: 100 };
      continue;
    }
    const nullPct = Math.round(((values.length - nonNull.length) / values.length) * 1000) / 10;
    next[col] = {
      ...base,
      nullPct: base.nullPct || nullPct,
      ...topValueFromSample(values),
    };
  }
  return next;
}
