/** Typed helpers for `CatalogEntry.metadata` JSON. */

export type AssetColumnSource = "dbt" | "dlt" | "sling" | "warehouse" | "inferred" | "manual";

export type AssetColumnDef = {
  name: string;
  type?: string;
  description?: string;
  source?: AssetColumnSource;
};

export type CatalogEntryMetadata = {
  columns?: AssetColumnDef[];
  /** Pipeline / connector inferred description (non-AI). */
  inferredDescription?: string;
  /** ISO timestamp when AI last generated catalog description. */
  aiGeneratedAt?: string;
  /** Last catalog import that refreshed inferred fields. */
  lastImportedAt?: string;
  columnSources?: string[];
};

function isColumnDef(v: unknown): v is AssetColumnDef {
  return Boolean(v && typeof v === "object" && typeof (v as AssetColumnDef).name === "string");
}

export function parseCatalogMetadata(raw: unknown): CatalogEntryMetadata {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const columns = Array.isArray(o.columns)
    ? o.columns.filter(isColumnDef).map((c) => ({
        name: String(c.name).trim(),
        ...(c.type ? { type: String(c.type).slice(0, 128) } : {}),
        ...(c.description ? { description: String(c.description).slice(0, 2000) } : {}),
        ...(c.source ? { source: c.source as AssetColumnSource } : {}),
      }))
    : undefined;
  return {
    ...(columns?.length ? { columns } : {}),
    ...(typeof o.inferredDescription === "string" && o.inferredDescription.trim()
      ? { inferredDescription: o.inferredDescription.trim().slice(0, 4000) }
      : {}),
    ...(typeof o.aiGeneratedAt === "string" ? { aiGeneratedAt: o.aiGeneratedAt } : {}),
    ...(typeof o.lastImportedAt === "string" ? { lastImportedAt: o.lastImportedAt } : {}),
    ...(Array.isArray(o.columnSources)
      ? { columnSources: o.columnSources.map((s) => String(s)).slice(0, 8) }
      : {}),
  };
}

/** Merge column lists — manual/warehouse beat inferred; dedupe by name (case-insensitive). */
export function mergeAssetColumns(
  ...lists: (AssetColumnDef[] | undefined)[]
): AssetColumnDef[] {
  const rank: Record<AssetColumnSource | "unknown", number> = {
    manual: 5,
    warehouse: 4,
    dbt: 3,
    sling: 2,
    dlt: 2,
    inferred: 1,
    unknown: 0,
  };
  const byName = new Map<string, AssetColumnDef>();
  for (const list of lists) {
    if (!list?.length) continue;
    for (const col of list) {
      const key = col.name.toLowerCase();
      const existing = byName.get(key);
      const src = col.source ?? "inferred";
      const existingRank = rank[existing?.source ?? "unknown"];
      const newRank = rank[src];
      if (!existing || newRank >= existingRank) {
        byName.set(key, col);
      }
    }
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function columnSourceLabels(sources: string[] | undefined): string {
  if (!sources?.length) return "";
  return sources.join(", ");
}
