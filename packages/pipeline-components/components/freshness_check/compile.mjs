// web/lib/elt/native-components/definitions/freshness-check.ts
var freshnessCheckComponent = {
  id: "freshness_check",
  name: "Freshness check",
  category: "check",
  description: "Assert table was updated within max lag minutes (SQL post-check).",
  compileTarget: "quality",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    {
      key: "timestamp_column",
      label: "Timestamp column",
      type: "string",
      required: true,
      placeholder: "updated_at"
    },
    {
      key: "max_lag_minutes",
      label: "Max lag (minutes)",
      type: "number",
      default: 1440
    }
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const tsCol = String(config.timestamp_column ?? config.partition_date_column ?? "updated_at").trim();
    const maxLag = Number(config.max_lag_minutes ?? config.freshness_max_lag_minutes ?? 1440);
    if (!table) {
      return { warnings: ["freshness_check: table is required"], tests: [] };
    }
    const tests = [`${table}.${tsCol} freshness_${maxLag}m`];
    const sql = [
      `-- freshness_check ${table}
SELECT MAX(${tsCol}) AS latest FROM ${table} HAVING MAX(${tsCol}) < NOW() - INTERVAL '${Math.max(1, Math.floor(maxLag))} minutes'`
    ];
    return { tests, sql, quality: [{ table, not_null: [tsCol] }] };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-SfOGBH/freshness_check.ts
function compile(config) {
  return freshnessCheckComponent.compile(config);
}
export {
  compile
};
