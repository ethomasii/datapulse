/** Source/destination catalog — derived from ALL_DLT_SOURCES so every view stays in sync. */

import { ALL_DLT_SOURCES } from "@/lib/elt/dlt-hub-registry";

// Build SOURCE_GROUPS from the registry, preserving a sensible category order.
const CATEGORY_ORDER = [
  "APIs & SaaS",
  "CRM & Sales",
  "Marketing",
  "Analytics",
  "Support & Ops",
  "Developer & Code",
  "Cloud Storage",
  "Databases",
  "Messaging & Queues",
  "Files",
  "Other",
];

function buildSourceGroups(): Record<string, readonly string[]> {
  // Collect slugs per category from the registry
  const grouped: Record<string, string[]> = {};
  for (const src of ALL_DLT_SOURCES) {
    const cat = src.category ?? "Other";
    (grouped[cat] ??= []).push(src.slug);
  }

  // Also include storage / file / database types not in the registry
  // (used by Sling replication pipelines)
  const extras: Record<string, string[]> = {
    "Cloud Storage": ["s3", "gcs", "azure_blob", "iceberg"],
    Databases: ["postgres", "mysql", "mongodb", "mssql", "oracle", "duckdb", "sqlite"],
    Files: ["csv", "json", "parquet"],
  };
  for (const [cat, slugs] of Object.entries(extras)) {
    const existing = new Set(grouped[cat] ?? []);
    for (const s of slugs) {
      if (!existing.has(s)) (grouped[cat] ??= []).push(s);
    }
  }

  // Sort by canonical category order, then alphabetically within each
  const result: Record<string, readonly string[]> = {};
  const seen = new Set<string>();
  for (const cat of CATEGORY_ORDER) {
    if (grouped[cat]?.length) {
      result[cat] = Array.from(new Set(grouped[cat])).sort();
      result[cat].forEach((s) => seen.add(s));
    }
  }
  // Any remaining categories not in CATEGORY_ORDER
  for (const [cat, slugs] of Object.entries(grouped)) {
    if (!result[cat] && slugs.length) {
      result[cat] = Array.from(new Set(slugs)).sort();
    }
  }
  return result;
}

export const SOURCE_GROUPS: Record<string, readonly string[]> = buildSourceGroups();

export const DESTINATION_GROUPS: Record<string, readonly string[]> = {
  "Cloud Warehouses": ["snowflake", "bigquery", "redshift", "databricks", "motherduck"],
  Databases: ["postgres", "mysql", "duckdb", "clickhouse", "mssql", "sqlite"],
  "Cloud Storage": ["s3", "gcs", "azure_blob", "iceberg"],
};

export const SOURCE_TYPES = Array.from(new Set(Object.values(SOURCE_GROUPS).flat())) as string[];

export const DESTINATION_TYPES = Array.from(new Set(Object.values(DESTINATION_GROUPS).flat())) as string[];

/** Flat option list for ConnectorCombobox — all pipeline sources (111+) */
export const SOURCE_OPTIONS: { slug: string; label: string; category: string }[] =
  Object.entries(SOURCE_GROUPS).flatMap(([category, slugs]) =>
    (slugs as string[]).map((slug) => ({
      slug,
      label: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/_/g, " "),
      category,
    }))
  );

/** Flat option list for ConnectorCombobox — pipeline destinations */
export const DESTINATION_OPTIONS: { slug: string; label: string; category: string }[] =
  Object.entries(DESTINATION_GROUPS).flatMap(([category, slugs]) =>
    (slugs as string[]).map((slug) => ({
      slug,
      label: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/_/g, " "),
      category,
    }))
  );
