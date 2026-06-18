import type { NativeComponentDefinition } from "../types";
import { strList } from "./_pandas-helpers";

export const uniqueCheckComponent: NativeComponentDefinition = {
  id: "unique_check",
  name: "Unique check",
  category: "check",
  description: "Assert column(s) are unique on a table.",
  compileTarget: "quality",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "unique", label: "Unique columns", type: "string_list", required: true },
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const unique = strList(config.unique ?? config.columns);
    if (!table || !unique.length) {
      return { warnings: ["unique_check: table and unique columns required"], tests: [] };
    }
    const tests = unique.map((col) => `${table}.${col} unique`);
    const sql = unique.map(
      (col) =>
        `-- unique_check ${table}.${col}\nSELECT ${col}, COUNT(*) AS c FROM ${table} GROUP BY ${col} HAVING COUNT(*) > 1`
    );
    return { tests, quality: [{ table, unique }], sql };
  },
};
