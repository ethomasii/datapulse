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
function pandasReadTable(table) {
  return [
    "import pandas as pd",
    "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
    "    _sql = _dest_client.sql_client()",
    `    _df = pd.read_sql('SELECT * FROM ${escapePyString(table)}', _sql._engine)`
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
function outputParts(output) {
  const outSchema = output.includes(".") ? output.split(".")[0] : "public";
  const outName = output.includes(".") ? output.split(".").pop() : output;
  return { outSchema, outName };
}
var countRecordsComponent = {
  id: "count_records",
  aliases: ["row_count", "aggregate_count"],
  name: "Count records",
  category: "transformation",
  description: "Count rows, optionally grouped.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "group_by", label: "Group by", type: "string_list" },
    { key: "output_column", label: "Count column name", type: "string", default: "row_count" },
    { key: "output_table", label: "Output table", type: "string", required: true }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config);
    const groupBy = strList(config.group_by ?? config.groupby);
    const outCol = String(config.output_column ?? "row_count").trim();
    if (!table || !output) {
      return { warnings: ["count_records: table and output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const aggLine = groupBy.length ? `_df = _df.groupby([${groupBy.map((c) => JSON.stringify(c)).join(", ")}], as_index=False).size().rename(columns={0: ${JSON.stringify(outCol)}})` : `_df = pd.DataFrame({${JSON.stringify(outCol)}: [len(_df)]})`;
    const python = [
      `# \u2500\u2500 count_records: ${table} \u2192 ${output} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    ${aggLine}`,
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[count_records] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[count_records] failed: {_e}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-gKMp94/count_records.ts
function compile(config) {
  return countRecordsComponent.compile(config);
}
export {
  compile
};
