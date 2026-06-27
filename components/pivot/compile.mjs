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
var pivotComponent = {
  id: "pivot",
  aliases: ["pivot_table", "pivot_transform", "cross_tab"],
  name: "Pivot table",
  category: "transformation",
  description: "Pivot long data to wide format (pandas pivot_table).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "index", label: "Index columns", type: "string_list", required: true },
    { key: "columns", label: "Pivot column", type: "string", required: true },
    { key: "values", label: "Values column", type: "string", required: true },
    { key: "aggfunc", label: "Aggregation", type: "select", options: ["sum", "mean", "count", "min", "max"], default: "sum" },
    { key: "output_table", label: "Output table", type: "string", required: true }
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? "").trim();
    const index = strList(config.index ?? config.index_cols);
    const columns = String(config.columns ?? config.pivot_column ?? "").trim();
    const values = String(config.values ?? config.value_column ?? "").trim();
    const aggfunc = String(config.aggfunc ?? "sum").trim();
    if (!table || !output || !index.length || !columns || !values) {
      return { warnings: ["pivot: table, index, columns, values, output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const indexPy = `[${index.map((c) => JSON.stringify(c)).join(", ")}]`;
    const python = [
      `# \u2500\u2500 pivot: ${table} \u2192 ${output} \u2500\u2500`,
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _df = _df.pivot_table(index=${indexPy}, columns=${JSON.stringify(columns)}, values=${JSON.stringify(values)}, aggfunc="${escapePyString(aggfunc)}").reset_index()`,
      `    _df.columns = [str(c) for c in _df.columns]`,
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[pivot] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[pivot] failed: {_e}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/pivot.ts
function compile(config) {
  return pivotComponent.compile(config);
}
export {
  compile
};
