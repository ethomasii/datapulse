/**
 * Parse DuckDB / MotherDuck table refs from canvas and asset pickers.
 * UI may send schema.table or database.schema.table (catalog prefix).
 */

export type DuckdbTableRef = {
  /** Target catalog when ref includes a database prefix */
  database?: string;
  schema: string;
  table: string;
  /** schema.table within the target database */
  qualified: string;
};

export function parseDuckdbTableRef(
  tableRef: string,
  defaultDatabase?: string
): DuckdbTableRef | null {
  const parts = tableRef.trim().split(".").filter(Boolean);
  if (parts.length < 2) return null;

  if (parts.length === 2) {
    const schema = parts[0]!;
    const table = parts[1]!;
    return {
      database: defaultDatabase?.trim() || undefined,
      schema,
      table,
      qualified: `${schema}.${table}`,
    };
  }

  const database = parts[0]!.trim();
  const schema = parts[parts.length - 2]!;
  const table = parts[parts.length - 1]!;
  return {
    database,
    schema,
    table,
    qualified: `${schema}.${table}`,
  };
}

/** Drop leading catalog segment from database.schema.table refs. */
export function stripDuckdbCatalogPrefix(tableRef: string): string {
  const parsed = parseDuckdbTableRef(tableRef);
  if (!parsed) return tableRef.trim();
  const parts = tableRef.trim().split(".").filter(Boolean);
  return parts.length >= 3 ? parsed.qualified : tableRef.trim();
}
