import type { NativeComponentDefinition } from "../types";

function strList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export const dqCheckComponent: NativeComponentDefinition = {
  id: "dq_check",
  aliases: ["great_expectations_check", "soda_check"],
  name: "Data quality check",
  category: "check",
  description: "not_null and unique checks on a table (runs as post-load SQL validation).",
  compileTarget: "quality",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "not_null", label: "Not null columns", type: "string_list" },
    { key: "unique", label: "Unique columns", type: "string_list" },
  ],
  compile(config) {
    const table = String(config.table ?? config.table_name ?? "").trim();
    if (!table) {
      return { warnings: ["dq_check: table is required"], tests: [] };
    }
    const notNull = strList(config.not_null);
    const unique = strList(config.unique);
    const tests: string[] = [];
    for (const col of notNull) tests.push(`${table}.${col} not_null`);
    for (const col of unique) tests.push(`${table}.${col} unique`);

    const sql: string[] = [];
    for (const col of notNull) {
      sql.push(
        `-- dq_check not_null ${table}.${col}\nSELECT COUNT(*) AS violations FROM ${table} WHERE ${col} IS NULL HAVING COUNT(*) > 0`
      );
    }

    return {
      tests,
      quality: [{ table, ...(notNull.length ? { not_null: notNull } : {}), ...(unique.length ? { unique } : {}) }],
      sql: sql.length ? sql : undefined,
    };
  },
};
