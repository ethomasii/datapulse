// web/lib/elt/native-components/definitions/_pandas-helpers.ts
function strList(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// web/lib/elt/native-components/definitions/unique-check.ts
var uniqueCheckComponent = {
  id: "unique_check",
  name: "Unique check",
  category: "check",
  description: "Assert column(s) are unique on a table.",
  compileTarget: "quality",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "unique", label: "Unique columns", type: "string_list", required: true }
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const unique = strList(config.unique ?? config.columns);
    if (!table || !unique.length) {
      return { warnings: ["unique_check: table and unique columns required"], tests: [] };
    }
    const tests = unique.map((col) => `${table}.${col} unique`);
    const sql = unique.map(
      (col) => `-- unique_check ${table}.${col}
SELECT ${col}, COUNT(*) AS c FROM ${table} GROUP BY ${col} HAVING COUNT(*) > 1`
    );
    return { tests, quality: [{ table, unique }], sql };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-0FtTsZ/unique_check.ts
function compile(config) {
  return uniqueCheckComponent.compile(config);
}
export {
  compile
};
