// web/lib/elt/escape-py.ts
function escapePyString(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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

// web/lib/elt/native-components/definitions/analytics-transforms.ts
function outputParts(output) {
  const outSchema = output.includes(".") ? output.split(".")[0] : "public";
  const outName = output.includes(".") ? output.split(".").pop() : output;
  return { outSchema, outName };
}
var dataCleansingComponent = {
  id: "data_cleansing",
  aliases: ["clean_data", "data_cleaning"],
  name: "Data cleansing",
  category: "transformation",
  description: "Trim strings, optional lowercase, drop all-null rows.",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "string_columns", label: "String columns to trim", type: "string_list" },
    { key: "lowercase_columns", label: "Columns to lowercase", type: "string_list" },
    { key: "drop_null_rows", label: "Drop rows where all values null", type: "boolean", default: true },
    { key: "output_table", label: "Output table", type: "string" }
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? table).trim();
    const trimCols = strList(config.string_columns ?? config.trim_columns);
    const lowerCols = strList(config.lowercase_columns);
    const dropNull = config.drop_null_rows !== false;
    if (!table) return { warnings: ["data_cleansing: table required"], python: [] };
    const { outSchema, outName } = outputParts(output);
    const lines = [
      `# \u2500\u2500 data_cleansing: ${table} \u2192 ${output} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`)
    ];
    for (const col of trimCols) {
      lines.push(`    if ${JSON.stringify(col)} in _df.columns:`);
      lines.push(`        _df[${JSON.stringify(col)}] = _df[${JSON.stringify(col)}].astype(str).str.strip()`);
    }
    for (const col of lowerCols) {
      lines.push(`    if ${JSON.stringify(col)} in _df.columns:`);
      lines.push(`        _df[${JSON.stringify(col)}] = _df[${JSON.stringify(col)}].astype(str).str.lower()`);
    }
    if (dropNull) lines.push("    _df = _df.dropna(how='all')");
    lines.push(
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[data_cleansing] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[data_cleansing] failed: {_e}")',
      "    raise"
    );
    return { python: lines };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-gKMp94/data_cleansing.ts
function compile(config) {
  return dataCleansingComponent.compile(config);
}
export {
  compile
};
