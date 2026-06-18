// web/lib/elt/escape-py.ts
function escapePyString(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// web/lib/elt/native-components/definitions/_config-helpers.ts
function inputTable(config) {
  return String(
    config.table ?? config.upstream_asset_key ?? config.input_table ?? config.source_table ?? ""
  ).trim();
}
function outputTable(config, fallback = "") {
  return String(config.output_table ?? config.asset_name ?? fallback).trim();
}

// web/lib/elt/native-components/definitions/_pandas-helpers.ts
function parseTableParts(table) {
  const parts = table.split(".");
  if (parts.length > 1) {
    return { schema: parts[0], name: parts.slice(1).join(".") };
  }
  return { schema: "public", name: table };
}
function pandasReadTable(table) {
  return [
    "import pandas as pd",
    "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
    "    _sql = _dest_client.sql_client()",
    `    _df = pd.read_sql('SELECT * FROM ${escapePyString(table)}', _sql._engine)`
  ];
}
function pandasWriteTable(outputTable2, label) {
  const { schema, name } = parseTableParts(outputTable2);
  return [
    `    _df.to_sql("${escapePyString(name)}", _sql._engine, schema="${escapePyString(schema)}", if_exists="replace", index=False)`,
    `    print(f"[${label}] wrote {len(_df)} rows to ${escapePyString(outputTable2)}")`
  ];
}
function strList(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// web/lib/elt/native-components/definitions/more-transforms.ts
var rankComponent = {
  id: "rank",
  name: "Rank rows",
  category: "transformation",
  description: "Rank rows by column with optional grouping (pandas rank).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "column", label: "Rank column", type: "string", required: true },
    { key: "group_by", label: "Group by", type: "string_list" },
    { key: "method", label: "Tie method", type: "select", options: ["average", "min", "max", "first", "dense"], default: "average" },
    { key: "ascending", label: "Ascending", type: "boolean", default: true },
    { key: "output_column", label: "Output column name", type: "string", default: "rank" },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config, table);
    const column = String(config.column ?? "").trim();
    const groupBy = strList(config.group_by ?? config.groupby);
    const method = String(config.method ?? "average").trim();
    const ascending = config.ascending !== false;
    const outCol = String(config.output_column ?? "rank").trim();
    if (!table || !column) {
      return { warnings: ["rank: table and column required"], python: [] };
    }
    const ascPy = ascending ? "True" : "False";
    const rankExpr = groupBy.length > 0 ? `_df.groupby([${groupBy.map((c) => JSON.stringify(c)).join(", ")}])[${JSON.stringify(column)}].rank(method=${JSON.stringify(method)}, ascending=${ascPy})` : `_df[${JSON.stringify(column)}].rank(method=${JSON.stringify(method)}, ascending=${ascPy})`;
    const python = [
      `# \u2500\u2500 rank: ${table} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _df[${JSON.stringify(outCol)}] = ${rankExpr}`,
      ...pandasWriteTable(output, "rank"),
      "except Exception as _e:",
      '    print(f"[rank] failed: {_e}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-owfwbk/rank.ts
function compile(config) {
  return rankComponent.compile(config);
}
export {
  compile
};
